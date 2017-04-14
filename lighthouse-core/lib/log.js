/**
 * @license
 * Copyright 2016 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

const debug = require('debug');
const EventEmitter = require('events').EventEmitter;
const isWindows = process.platform === 'win32';

// process.browser is set when browserify'd via the `process` npm module
const isBrowser = process.browser;

const colors = {
  red: isBrowser ? 'crimson' : 1,
  yellow: isBrowser ? 'gold' : 3,
  cyan: isBrowser ? 'darkturquoise' : 6,
  green: isBrowser ? 'forestgreen' : 2,
  blue: isBrowser ? 'steelblue' : 4,
  magenta: isBrowser ? 'palevioletred' : 5
};

// whitelist non-red/yellow colors for debug()
debug.colors = [colors.cyan, colors.green, colors.blue, colors.magenta];

/**
 * @private
 */
class Emitter extends EventEmitter {
  /**
   * Fires off all status updates. Listen with
   * `require('lib/log').events.addListener('status', callback)`
   * @param {string} title
   * @param {!Array<*>} argsArray
   */
  issueStatus(title, argsArray) {
    if (title === 'status' || title === 'statusEnd') {
      this.emit(title, [title, ...argsArray]);
    }
  }

  /**
   * Fires off all warnings. Listen with
   * `require('lib/log').events.addListener('warning', callback)`
   * @param {string} title
   * @param {!Array<*>} argsArray
   */
  issueWarning(title, argsArray) {
    this.emit('warning', [title, ...argsArray]);
  }
}

const logEmitter = new Emitter();

/**
 * @const {!Object<string, !debug.logger>}
 */
const loggersByTitle = {};

const loggingBufferColumns = 25;

class Log {
  /**
   * @param {string} title
   * @param {!Array<*>} argsArray
   * @private
   */
  static _logToStdErr(title, argsArray) {
    const log = Log.loggerfn(title);
    log(...argsArray);
  }

  /**
   * @param {string} title
   * @return {function(...*)}
   * @private
   */
  static loggerfn(title) {
    let log = loggersByTitle[title];
    if (!log) {
      log = debug.debug(title);
      loggersByTitle[title] = log;
      // errors with red, warnings with yellow.
      if (title.endsWith('error')) {
        log.color = colors.red;
      } else if (title.endsWith('warn')) {
        log.color = colors.yellow;
      }
    }
    return /** @type {function(...*)} */ (log);
  }

  /**
   * @param {string} level
   */
  static setLevel(level) {
    switch (level) {
      case 'silent':
        debug.enable('-*');
        break;
      case 'verbose':
        debug.enable('*');
        break;
      case 'error':
        debug.enable('-*, *:error');
        break;
      default:
        debug.enable('*, -*:verbose');
    }
  }

  /**
   * A simple formatting utility for event logging.
   * @param {string} prefix
   * @param {{method: string, params: *}} data A JSON-serializable object of event data to log.
   * @param {string=} level Optional logging level. Defaults to 'log'.
   */
  static formatProtocol(prefix, data, level) {
    const columns = (!process || process.browser) ? Infinity : process.stdout.columns;
    const maxLength = columns - data.method.length - prefix.length - loggingBufferColumns;
    // IO.read blacklisted here to avoid logging megabytes of trace data
    const snippet = (data.params && data.method !== 'IO.read') ?
      JSON.stringify(data.params).substr(0, maxLength) : '';
    Log._logToStdErr(`${prefix}:${level || ''}`, [data.method, snippet]);
  }

  /**
   * @param {string} title
   * @param {...*} args
   */
  static log(title, ...args) {
    logEmitter.issueStatus(title, args);
    Log._logToStdErr(title, args);
  }

  /**
   * @param {string} title
   * @param {...*} args
   */
  static warn(title, ...args) {
    logEmitter.issueWarning(title, args);
    Log._logToStdErr(`${title}:warn`, args);
  }

  /**
   * @param {string} title
   * @param {...*} args
   */
  static error(title, ...args) {
    Log._logToStdErr(`${title}:error`, args);
  }

  /**
   * @param {string} title
   * @param {...*} args
   */
  static verbose(title, ...args) {
    logEmitter.issueStatus(title, args);
    Log._logToStdErr(`${title}:verbose`, args);
  }

  /**
   * @return {!EventEmitter}
   */
  static get events() {
    return logEmitter;
  }

  /**
   * Add surrounding escape sequences to turn a string green when logged.
   * @param {string} str
   * @return {string}
   */
  static greenify(str) {
    return `${Log.green}${str}${Log.reset}`;
  }

  /**
   * Add surrounding escape sequences to turn a string red when logged.
   * @param {string} str
   * @return {string}
   */
  static redify(str) {
    return `${Log.red}${str}${Log.reset}`;
  }

  /**
   * @return {string}
   */
  static get green() {
    return '\x1B[32m';
  }

  /**
   * @return {string}
   */
  static get red() {
    return '\x1B[31m';
  }

  /**
   * @return {string}
   */
  static get yellow() {
    return '\x1b[33m';
  }

  /**
   * @return {string}
   */
  static get purple() {
    return '\x1b[95m';
  }

  /**
   * @return {string}
   */
  static get reset() {
    return '\x1B[0m';
  }

  /**
   * @return {string}
   */
  static get bold() {
    return '\x1b[1m';
  }

  /**
   * @return {string}
   */
  static get tick() {
    return isWindows ? '\u221A' : '✓';
  }

  /**
   * @return {string}
   */
  static get cross() {
    return isWindows ? '\u00D7' : '✘';
  }

  /**
   * @return {string}
   */
  static get whiteSmallSquare() {
    return isWindows ? '\u0387' : '▫';
  }

  /**
   * @return {string}
   */
  static get heavyHorizontal() {
    return isWindows ? '\u2500' : '━';
  }

  /**
   * @return {string}
   */
  static get heavyVertical() {
    return isWindows ? '\u2502 ' : '┃ ';
  }

  /**
   * @return {string}
   */
  static get heavyUpAndRight() {
    return isWindows ? '\u2514' : '┗';
  }

  /**
   * @return {string}
   */
  static get heavyVerticalAndRight() {
    return isWindows ? '\u251C' : '┣';
  }

  /**
   * @return {string}
   */
  static get heavyDownAndHorizontal() {
    return isWindows ? '\u252C' : '┳';
  }

  /**
   * @return {string}
   */
  static get doubleLightHorizontal() {
    return '──';
  }
}

module.exports = Log;
