/**
 * @license Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const Connection = require('./connection.js');

class SWSession extends Connection {
  constructor(sessionId, targetInfo, parentConnection) {
    super();
    this._targetInfo = targetInfo;
    this._sessionId = sessionId;
    this._parent = parentConnection;

    this._parent.on('notification', this._onEvent.bind(this));
  }

  sessionId() {
    return this._sessionId;
  }

  _onEvent({method, params}) {
    if (method === 'Target.receivedMessageFromTarget' && params.sessionId === this._sessionId) {
      this.handleRawMessage(params.message);
    }
  }

  /**
   * The public API of this connection looks identical, with .sendCommand() and .on()
   * However internally, we wrap incoming commands within a `sendMessageToTarget` command
   * that is issued through the parent target
   * @override
   * @param {string} message
   */
  sendRawMessage(message) {
    // get the message string here. i'm going to send it with page's connection.
    return this._parent.sendCommand('Target.sendMessageToTarget', {
      sessionId: this._sessionId,
      message,
    });
  }
}

module.exports = SWSession;
