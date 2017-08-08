/**
 * @license Copyright 2016 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

import {Launcher} from '../chrome-launcher';
import {spy, stub} from 'sinon';
import * as assert from 'assert';
import * as stream from 'stream';

const log = require('lighthouse-logger');
const fsMock = {
  writeFileSync: () => {},
  createWriteStream: () => {
    return new stream.Writable()
  }
};

describe('Launcher', () => {
  beforeEach(() => {
    log.setLevel('error');
  });

  afterEach(() => {
    log.setLevel('');
  });

  function createMockChildProcess() {
    const mockedStream = new stream.Readable();
    Object.defineProperty(mockedStream, '_read', {
      value: (size:number) => { size; }
    });
    return {
      pid: 'some_pid',
      stdout: mockedStream,
      stderr: mockedStream
    };
  }

  it('sets default launching flags', async () => {

    const spawnStub = stub().returns(createMockChildProcess());
    const chromeInstance = new Launcher(
        {userDataDir: 'some_path'},
        {fs: fsMock as any, rimraf: spy() as any, spawn: spawnStub as any});
    stub(chromeInstance, 'waitUntilReady').returns(Promise.resolve());
    stub(chromeInstance, 'getActivePort').returns(Promise.resolve({port: 1234, browserWs: null}));

    chromeInstance.prepare();

    try {
      await chromeInstance.launch();
    } catch (err) {
      return Promise.reject(err);
    }

    const chromeFlags = spawnStub.getCall(0).args[1] as string[];

    assert.ok(chromeFlags.find(f => f.startsWith('--remote-debugging-port')))
    assert.ok(chromeFlags.find(f => f.startsWith('--disable-background-networking')))
    assert.strictEqual(chromeFlags[chromeFlags.length - 1], 'about:blank');
  }).timeout(5000);

  it('accepts and uses a custom path', async () => {
    const rimrafMock = spy();
    const chromeInstance =
        new Launcher({userDataDir: 'some_path'}, {fs: fsMock as any, rimraf: rimrafMock as any});

    chromeInstance.prepare();

    await chromeInstance.destroyTmp();
    assert.strictEqual(rimrafMock.callCount, 0);
  });

  it('cleans up the tmp dir after closing', async () => {
    const rimrafMock = stub().callsFake((_, done) => done());

    const chromeInstance = new Launcher({}, {fs: fsMock as any, rimraf: rimrafMock as any});

    chromeInstance.prepare();
    await chromeInstance.destroyTmp();
    assert.strictEqual(rimrafMock.callCount, 1);
  });

  it('does not delete created directory when custom path passed', () => {
    const chromeInstance = new Launcher({userDataDir: 'some_path'}, {fs: fsMock as any});

    chromeInstance.prepare();
    assert.equal(chromeInstance.userDataDir, 'some_path');
  });

  it('defaults to genering a tmp dir when no data dir is passed', () => {
    const chromeInstance = new Launcher({}, {fs: fsMock as any});
    const originalMakeTmp = chromeInstance.makeTmpDir;
    chromeInstance.makeTmpDir = () => 'tmp_dir'
    chromeInstance.prepare()
    assert.equal(chromeInstance.userDataDir, 'tmp_dir');

    // Restore the original fn.
    chromeInstance.makeTmpDir = originalMakeTmp;
  });

  it('doesn\'t fail when killed twice', async () => {
    const chromeInstance = new Launcher();

    await chromeInstance.launch();
    await chromeInstance.kill();
    await chromeInstance.kill();
  }).timeout(5000);

  it('doesn\'t launch multiple chrome processes', async () => {
    const chromeInstance = new Launcher();

    await chromeInstance.launch();
    let pid = chromeInstance.pid!;
    await chromeInstance.launch();
    assert.strictEqual(pid, chromeInstance.pid);
    await chromeInstance.kill();
  }).timeout(5000);

  it('removes --disable-extensions from flags on enableExtensions', async () => {
    const spawnStub = stub().returns(createMockChildProcess());

    const chromeInstance = new Launcher(
        {enableExtensions: true},
        {fs: fsMock as any, rimraf: spy() as any, spawn: spawnStub as any});
    stub(chromeInstance, 'waitUntilReady').returns(Promise.resolve());
    stub(chromeInstance, 'getActivePort').returns(Promise.resolve({port: 1234, browserWs: null}));

    chromeInstance.prepare();

    try {
      await chromeInstance.launch();
    } catch (err) {
      return Promise.reject(err);
    }

    const chromeFlags = spawnStub.getCall(0).args[1] as string[];
    assert.ok(!chromeFlags.includes('--disable-extensions'));
  }).timeout(2000);
});
