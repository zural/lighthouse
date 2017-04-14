/**
 * Copyright 2017 Google Inc. All rights reserved.
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

/**
 * @fileoverview externs file for node's global variables.
 * @see https://github.com/google/closure-compiler/blob/master/contrib/nodejs/globals.js
 * @externs
 */

/** @const {string} */
var __filename;

/** @const {string} */
var __dirname;

// TODO(bckenny): hack to work around Closure Compiler NTI issue.
// @see https://github.com/google/closure-compiler/issues/2434
function Window() {}
/** @type {!Window} */
var window;

// http://nodejs.org/api/timers.html

/**
 * The ID returned by setTimeout.
 * @constructor
 */
function TimeoutId() {}

/** @see http://nodejs.org/api/timers.html#timers_unref */
TimeoutId.prototype.unref = function() {};

/** @see http://nodejs.org/api/timers.html#timers_ref */
TimeoutId.prototype.ref = function() {};


/**
 * @param {function()} fn
 * @param {number} ms
 * @return {!TimeoutId}
 * @see http://nodejs.org/api/timers.html#timers_settimeout_callback_delay_arg
 */
function setTimeout(fn, ms) {}

/**
 * @param {!TimeoutId} id
 * @see http://nodejs.org/api/timers.html#timers_cleartimeout_timeoutid
 */
function clearTimeout(id) {}

/**
 * @param {function()} fn
 * @param {number} ms
 * @return {!TimeoutId}
 * @see http://nodejs.org/api/timers.html#timers_setinterval_callback_delay_arg
 */
function setInterval(fn, ms) {}

/**
 * @param {!TimeoutId} id
 * @see http://nodejs.org/api/timers.html#timers_clearinterval_intervalid
 */
function clearInterval(id) {}

/**
 * The ID returned by setImmediate.
 * @constructor
 */
function ImmediateId() {}

/**
 * @param {function()} fn
 * @return {!ImmediateId}
 * @see http://nodejs.org/api/timers.html#timers_setimmediate_callback_delay_arg
 */
function setImmediate(fn) {}

/**
 * @param {!ImmediateId} id
 * @see http://nodejs.org/api/timers.html#timers_clearimmediate_immediateid
 */
function clearImmediate(id) {}


// http://nodejs.org/api/process.html

/** @constructor */
function Process() {}

/**
 * @type {string}
 * @see http://nodejs.org/api/process.html#process_process_arch
 */
Process.prototype.arch;

/**
 * @type {!Array<string>}
 * @see http://nodejs.org/api/process.html#process_process_argv
 */
Process.prototype.argv;

/**
 * Set to true by browserify, undefined in normal node execution.
 * @type {(boolean|undefined)}
 */
Process.prototype.browser;

/**
 * @param {string} directory
 * @see http://nodejs.org/api/process.html#process_process_chdir_directory
 */
Process.prototype.chdir = function(directory) {};

/**
 * @type {boolean}
 * @see http://nodejs.org/api/process.html#process_process_connected
 */
Process.prototype.connected;

/**
 * @param {{user: number, system: number}} previousValue
 * @return {{user: number, system: number}}
 * @see https://nodejs.org/api/process.html#process_process_cpuusage_previousvalue
 */
Process.prototype.cpuUsage = function(previousValue) {};

/**
 * @return {string}
 * @see http://nodejs.org/api/process.html#process_process_cwd
 */
Process.prototype.cwd = function() {};

/**
 * @see http://nodejs.org/api/process.html#process_process_disconnect
 */
Process.prototype.disconnect = function() {};

/**
 * @type {{HOME: string}}
 * @see http://nodejs.org/api/process.html#process_process_env
 */
Process.prototype.env;

/**
 * @param {number=} code
 * @see http://nodejs.org/api/process.html#process_process_exit_code
 */
Process.prototype.exit = function(code) {};

/**
 * @param {number} pid
 * @param {string|number} signal
 * @see http://nodejs.org/api/process.html#process_process_kill_pid_signal
 */
Process.prototype.kill = function(pid, signal) {};

/**
 * @param {function()} fn
 * @see http://nodejs.org/api/process.html#process_process_nexttick_callback_arg
 */
Process.prototype.nextTick = function(fn) {};

/**
 * @type {string}
 * @see http://nodejs.org/api/process.html#process_process_pid
 */
Process.prototype.pid;

/**
 * @type {string}
 * @see http://nodejs.org/api/process.html#process_process_platform
 */
Process.prototype.platform;

/**
 * @type {{name: string, sourceUrl: string, headersUrl: string, libUrl: string, lts: string}}
 * @see http://nodejs.org/api/process.html#process_process_release
 */
Process.prototype.release;

/**
 * @type {{columns: number}}
 * @see https://nodejs.org/api/process.html#process_process_stdout
 */
Process.prototype.stdout;

/**
 * @return {number}
 * @see http://nodejs.org/api/process.html#process_process_uptime
 */
Process.prototype.uptime = function() {};

/**
 * @type {string}
 * @see http://nodejs.org/api/process.html#process_process_version
 */
Process.prototype.version;

/**
 * @type {!Object<string, string>}
 * @see http://nodejs.org/api/process.html#process_process_versions
 */
Process.prototype.versions;

/** @const {!Process} */
var process;

/**
 * @constructor
 */
function Console() {};

/**
 * @param {...*} var_args
 */
Console.prototype.error = function(var_args) {};

/**
 * @param {...*} var_args
 */
Console.prototype.info = function(var_args) {};

/**
 * @param {...*} var_args
 */
Console.prototype.log = function(var_args) {};

/**
 * @param {...*} var_args
 */
Console.prototype.warn = function(var_args) {};

/**
 * @param {...*} var_args
 */
Console.prototype.debug = function(var_args) {};

/**
 * @type {!Console}
 */
var console;
