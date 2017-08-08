/**
 * @license Copyright 2016 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as chromeFinder from './chrome-finder';
import {DEFAULT_FLAGS} from './flags';
import {makeTmpDir, defaults, delay} from './utils';
import * as net from 'net';
const rimraf = require('rimraf');
const log = require('lighthouse-logger');
const spawn = childProcess.spawn;
const execSync = childProcess.execSync;
const isWindows = process.platform === 'win32';
const _SIGINT = 'SIGINT';
const _SIGINT_EXIT_CODE = 130;
const _SUPPORTED_PLATFORMS = new Set(['darwin', 'linux', 'win32']);

type SupportedPlatforms = 'darwin'|'linux'|'win32';

export interface Options {
  startingUrl?: string;
  chromeFlags?: Array<string>;
  port?: number;
  handleSIGINT?: boolean;
  chromePath?: string;
  userDataDir?: string;
  logLevel?: string;
  enableExtensions?: boolean;
}

export interface LaunchedChrome {
  pid: number;
  port: number;
  kill: () => Promise<{}>;
  browserWs: string|null;
}

export interface ModuleOverrides {
  fs?: typeof fs;
  rimraf?: typeof rimraf;
  spawn?: typeof childProcess.spawn;
}

export async function launch(opts: Options = {}): Promise<LaunchedChrome> {
  opts.handleSIGINT = defaults(opts.handleSIGINT, true);

  const instance = new Launcher(opts);

  // Kill spawned Chrome process in case of ctrl-C.
  if (opts.handleSIGINT) {
    process.on(_SIGINT, async () => {
      await instance.kill();
      process.exit(_SIGINT_EXIT_CODE);
    });
  }

  await instance.launch();

  return {
    pid: instance.pid!,
    port: instance.port!,
    browserWs: instance.browserWs,
    kill: async () => instance.kill()
  };
}

export class Launcher {
  private tmpDirandPidFileReady = false;
  private pollInterval: number = 500;
  private pidFile: string;
  private startingUrl: string;
  private outStream?: NodeJS.WritableStream;
  private errStream?: NodeJS.WritableStream;
  private chromePath?: string;
  private enableExtensions?: boolean;
  private chromeFlags: string[];
  private requestedPort?: number;
  private chrome?: childProcess.ChildProcess;
  private fs: typeof fs;
  private rimraf: typeof rimraf;
  private spawn: typeof childProcess.spawn;

  userDataDir?: string;
  port?: number;
  pid?: number;
  browserWs: string|null;


  constructor(private opts: Options = {}, moduleOverrides: ModuleOverrides = {}) {
    this.fs = moduleOverrides.fs || fs;
    this.rimraf = moduleOverrides.rimraf || rimraf;
    this.spawn = moduleOverrides.spawn || spawn;

    log.setLevel(defaults(this.opts.logLevel, 'silent'));

    // choose the first one (default)
    this.startingUrl = defaults(this.opts.startingUrl, 'about:blank');
    this.chromeFlags = defaults(this.opts.chromeFlags, []);
    this.requestedPort = defaults(this.opts.port, 0);
    this.chromePath = this.opts.chromePath;
    this.enableExtensions = defaults(this.opts.enableExtensions, false);
  }

  private get flags() {
    let flags = DEFAULT_FLAGS.concat([
      `--remote-debugging-port=${this.port}`,
      // Place Chrome profile in a custom location we'll rm -rf later
      `--user-data-dir=${this.userDataDir}`
    ]);

    if (this.enableExtensions) {
      flags = flags.filter(flag => flag !== '--disable-extensions');
    }

    if (process.platform === 'linux') {
      flags.push('--disable-setuid-sandbox');
      flags.push('--no-sandbox');
    }

    flags.push(...this.chromeFlags);
    flags.push(this.startingUrl);

    return flags;
  }

  // Wrapper function to enable easy testing.
  makeTmpDir() {
    return makeTmpDir();
  }

  prepare() {
    const platform = process.platform as SupportedPlatforms;
    if (!_SUPPORTED_PLATFORMS.has(platform)) {
      throw new Error(`Platform ${platform} is not supported`);
    }

    this.userDataDir = this.opts.userDataDir || this.makeTmpDir();
    this.outStream = this.fs.createWriteStream(`${this.userDataDir}/chrome-out.log`, {flags: 'a'});
    this.errStream = this.fs.createWriteStream(`${this.userDataDir}/chrome-err.log`, {flags: 'a'});

    // fix for Node4
    // you can't pass a fd to fs.writeFileSync
    this.pidFile = `${this.userDataDir}/chrome.pid`;

    log.verbose('ChromeLauncher', `created ${this.userDataDir}`);

    this.tmpDirandPidFileReady = true;
  }

  async launch() {
    if (this.requestedPort !== 0) {
      this.port = this.requestedPort;

      // If an explict port is passed first look for an open connection...
      try {
        return await this.isDebuggerReady();
      } catch (err) {
        log.log(
            'ChromeLauncher',
            `No debugging port found on port ${this.port}, launching a new Chrome.`);
      }
    }

    if (!this.tmpDirandPidFileReady) {
      this.prepare();
    }

    if (this.chromePath === undefined) {
      const installations = await chromeFinder[process.platform as SupportedPlatforms]();
      if (installations.length === 0) {
        throw new Error('No Chrome Installations Found');
      }

      this.chromePath = installations[0];
    }

    this.pid = await this.spawnProcess(this.chromePath);
    return Promise.resolve();
  }

  private async spawnProcess(execPath: string) {
    // Typescript is losing track of the return type without the explict typing.
    const spawnPromise: Promise<number> = new Promise(async (resolve) => {
      if (this.chrome) {
        log.log('ChromeLauncher', `Chrome already running with pid ${this.chrome.pid}.`);
        return resolve(this.chrome.pid);
      }
      this.port = this.requestedPort;

      log.verbose(
          'ChromeLauncher', `Launching with command:\n"${execPath}" ${this.flags.join(' ')}`);
      const chrome = this.spawn(
          execPath, this.flags, {detached: true, stdio: ['ignore', 'pipe', 'pipe']});

      chrome.stdout.setEncoding('utf8');
      chrome.stderr.setEncoding('utf8');
      chrome.stdout.pipe(this.outStream!);
      chrome.stderr.pipe(this.errStream!);
      const {port, browserWs} = await this.getActivePort(chrome);

      this.port = port;
      this.browserWs = browserWs;
      this.chrome = chrome;
      this.fs.writeFileSync(this.pidFile, chrome.pid.toString());
      log.verbose('ChromeLauncher', `Chrome running with pid ${chrome.pid} on port ${this.port}.`);
      resolve(chrome.pid);
    });

    const pid = await spawnPromise;
    await this.waitUntilReady();
    return pid;
  }

  private async getActivePort(chrome: childProcess.ChildProcess): Promise<{port: number, browserWs: string|null}> {
    const stderr = chrome.stderr;
    let fulfill: Function;
    let p: Promise<{port: number, browserWs: string|null}>|undefined;

    p = new Promise(resolve => { fulfill = resolve;});
    stderr.on('data', (data:string) => {
      // As of https://chromium-review.googlesource.com/c/596719 Chrome will output the full browser WS target rather than simple port
      // "DevTools listening on ws://127.0.0.1:63567/devtools/browser/2f168fe0-2d64-48aa-a22c-6ccaff6e9b24"
      // "DevTools listening on 127.0.0.1:64223"
      const match = data.trim().match(/DevTools listening on (.*:(\d+)(\/.*)?)/);
      if (!match) return;
      const port = Number.parseInt(match[2], 10)
      const targetURL = match[1];
      let browserWs : string|null;

      if (typeof targetURL === 'string' && targetURL.startsWith('ws://'))
        browserWs = targetURL;
      else
        browserWs = null;
      return fulfill({port, browserWs});
    });
    return p;
  }

  private cleanup(client?: net.Socket) {
    if (client) {
      client.removeAllListeners();
      client.end();
      client.destroy();
      client.unref();
    }
  }

  // resolves if ready, rejects otherwise
  private isDebuggerReady(): Promise<{}> {
    return new Promise((resolve, reject) => {
      const client = net.createConnection(this.port!);
      client.once('error', err => {
        this.cleanup(client);
        reject(err);
      });
      client.once('connect', () => {
        this.cleanup(client);
        resolve();
      });
    });
  }

  // resolves when debugger is ready, rejects after 10 polls
  private waitUntilReady() {
    const launcher = this;

    return new Promise((resolve, reject) => {
      let retries = 0;
      let waitStatus = 'Waiting for browser.';

      const poll = () => {
        if (retries === 0) {
          log.log('ChromeLauncher', waitStatus);
        }
        retries++;
        waitStatus += '..';
        log.log('ChromeLauncher', waitStatus);

        launcher.isDebuggerReady()
            .then(() => {
              log.log('ChromeLauncher', waitStatus + `${log.greenify(log.tick)}`);
              resolve();
            })
            .catch(err => {
              if (retries > 10) {
                log.error('ChromeLauncher', err.message);
                const stderr =
                    this.fs.readFileSync(`${this.userDataDir}/chrome-err.log`, {encoding: 'utf-8'});
                log.error(
                    'ChromeLauncher', `Logging contents of ${this.userDataDir}/chrome-err.log`);
                log.error('ChromeLauncher', stderr);
                return reject(err);
              }
              delay(launcher.pollInterval).then(poll);
            });
      };
      poll();

    });
  }

  kill() {
    return new Promise(resolve => {
      if (this.chrome) {
        this.chrome.on('close', () => {
          this.destroyTmp().then(resolve);
        });

        log.log('ChromeLauncher', 'Killing all Chrome Instances');
        try {
          if (isWindows) {
            execSync(`taskkill /pid ${this.chrome.pid} /T /F`);
          } else {
            process.kill(-this.chrome.pid);
          }
        } catch (err) {
          log.warn('ChromeLauncher', `Chrome could not be killed ${err.message}`);
        }

        delete this.chrome;
      } else {
        // fail silently as we did not start chrome
        resolve();
      }
    });
  }

  destroyTmp() {
    return new Promise(resolve => {
      // Only clean up the tmp dir if we created it.
      if (this.userDataDir === undefined || this.opts.userDataDir !== undefined) {
        return resolve();
      }

      if (this.outStream) {
        this.outStream.end();
        delete this.outStream;
      }

      if (this.errStream) {
        this.errStream.end();
        delete this.errStream;
      }

      this.rimraf(this.userDataDir, () => resolve());
    });
  }
};
