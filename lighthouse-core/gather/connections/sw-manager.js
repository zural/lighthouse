/**
 * @license Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const SWSession = require('./sw-session');

/**
 * @overview Sending messages to subtargets is "fun".
 * @see https://github.com/cyrus-and/chrome-remote-interface/wiki/Inspect-subtargets-like-a-service-worker
 */
class SWManager {
  constructor(connection, {subtargetType}) {
    this._connection = connection;
    this._subtargetType = subtargetType;
    this._subtargets = [];
  }

  listen() {
    const opts = {autoAttach: true, waitForDebuggerOnStart: true};

    this._connection.on('notification', event => {
      if (event.method === 'Target.attachedToTarget') this.onTargetAttached(event.params);
      if (event.method === 'Target.detachedFromTarget') this.onTargetDetached(event.params);
    });

    return this._connection
      .sendCommand('Target.setAutoAttach', opts)
      .then(_ => this._connection.sendCommand('Runtime.runIfWaitingForDebugger'));
  }

  sendCommandToSubtargets(method, params) {
    if (this._subtargets.length === 0) {
      console.warn(`No subtargets yet for ${method}`);
    }
    // Some protocol domains are not supported by the dedicated worker but by the SW page
    // Note: Log and Network are technically supported in both, but not completely,
    // so we pick where we'd prefer each to run.
    let destinationType;
    const methodDomain = method.split('.')[0];
    if (['Runtime', 'Profiler', 'Debugger', ' HeapProfiler'].includes(methodDomain)) {
      destinationType = 'worker';
    } else if (['Log', 'Network', 'Target'].includes(methodDomain)) {
      destinationType = 'service_worker';
    } else {
      const err = new Error(`Unknown subtarget destination for ${method} message`);
      err.fatal = true;
      throw err;
    }
    return this._dispatchToSubTargets(destinationType, method, params);
  }

  _dispatchToSubTargets(destination, method, params) {
    const _flatten = arr => [].concat(...arr);

    const p = this._subtargets.map(({session, manager}) => {
      if (destination === this._subtargetType) {
        return session.sendCommand(method, params);
      } else {
        if (!manager) {
          console.log('ruh roh');
          console.log(this._subtargetType, manager, session);
        }
        return manager._dispatchToSubTargets(destination, method, params);
      }
    });
    return Promise.all(p).then(arr => _flatten(arr));
  }

  onTargetAttached({sessionId, targetInfo}) {
    if (targetInfo.type !== this._subtargetType) return;

    // setup message passing to wrap/unwrap Target messages
    const session = new SWSession(sessionId, targetInfo, this._connection);

    // `service_worker` targets are phantom pages. The SW JS context is within a `worker` target
    // So we'll do this again, autoattaching, and looking for `worker` subtargets
    let manager;
    if (this._subtargetType === 'service_worker') {
      manager = new SWManager(session, {subtargetType: 'worker'});
      manager.listen();
    }

    this._subtargets.push({session, manager});
  }

  onTargetDetached(data) {
    const detatchedSessionId = data.sessionId;
    this._subtargets = this._subtargets.filter(
      ({session}) => session.sessionId() !== detatchedSessionId
    );
  }
}

module.exports = SWManager;
