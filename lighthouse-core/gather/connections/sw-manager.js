/**
 * @license Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const SWSession = require('./sw');

class SWManager {
  constructor(connection, {requiredType}) {
    this._connection = connection;
    this._requiredType = requiredType;
    this._subTargets = [];
  }

  listen() {
    const opts = {autoAttach: true, waitForDebuggerOnStart: true};

    this._connection.on('notification', event => {
      if (event.method === 'Target.attachedToTarget') this.onTargetAttached(event.params);
      if (event.method === 'Target.detachedFromTarget') this.onTargetDetached(event.params);
    });

    return this._connection.sendCommand('Target.setAutoAttach', opts)
      .then(_ => this._connection.sendCommand('Runtime.runIfWaitingForDebugger'));
  }

  sendCommandToSubTargets(method, params) {
    const _flatten = arr => [].concat(...arr);

    const p = this._subTargets.map(({session, manager}) => {
      if (manager) return manager.sendCommandToSubTargets(method, params);
      else return session.sendCommand(method, params);
    });
    return Promise.all(p).then(arr => _flatten(arr));
  }

  onTargetAttached({sessionId, targetInfo}) {
    if (targetInfo.type !== this._requiredType) return;

    // setup message passing to wrap/unwrap Target messages
    const session = new SWSession(sessionId, targetInfo, this._connection);

    // `service_worker` targets are phantom pages. They have a `worker` target within that we want
    let manager;
    if (this._requiredType === 'service_worker') {
      manager = new SWManager(session, {requiredType: 'worker'});
      manager.listen();
    }

    this._subTargets.push({session, manager});
  }

  onTargetDetached(data) {
    const detatchedSessionId = data.sessionId;
    this._subTargets = this._subTargets.filter(({session}) => session.sessionId() !== detatchedSessionId);
  }
}


module.exports = SWManager;
