/**
 * @license Copyright 2016 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const {Launcher} = require('../chrome-launcher');
const assert = require('assert');
const stream = require('stream');

/* eslint-env mocha */
describe('Launcher features', () => {
  describe('getActivePort', () => {
    // A child process-like stub
    function createMockChrome() {
      const mockedStream = new stream.Readable();
      mockedStream._read = _ => {};
      const mockChrome = {
        stderr: mockedStream
      };
      return mockChrome;
    }

    it('can handle Chrome >=62', () => {
      const mockChrome = createMockChrome();

      const p = Launcher.prototype.getActivePort(mockChrome).then(data => {
        assert.deepStrictEqual(data, {
          port: 63567,
          browserWs: 'ws://127.0.0.1:63567/devtools/browser/2f168fe0-2d64-48aa-a22c-6ccaff6e9b24'
        });
      });

      mockChrome.stderr.emit('data', 'DevTools listening on ws://127.0.0.1:63567/devtools/browser/2f168fe0-2d64-48aa-a22c-6ccaff6e9b24');
      mockChrome.stderr.emit('end');
      return p;
    });

    it('can handle Chrome <=61', () => {
      const mockChrome = createMockChrome();

      const p = Launcher.prototype.getActivePort(mockChrome).then(data => {
        assert.deepStrictEqual(data, {
          port: 64223,
          browserWs: null
        });
      });

      mockChrome.stderr.emit('data', 'DevTools listening on 127.0.0.1:64223');
      mockChrome.stderr.emit('end');
      return p;
    });

    it('can handle Chrome dev build (<= 61)', () => {
      const mockChrome = createMockChrome();

      const p = Launcher.prototype.getActivePort(mockChrome).then(data => {
        assert.deepStrictEqual(data, {
          port: 57747,
          browserWs: null
        });
      });

      mockChrome.stderr.emit(
        'data',
        `[50786:50695:0808/133113.866481:ERROR:devtools_http_handler.cc(786)]
            DevTools listening on 127.0.0.1:57747

            `
      );
      mockChrome.stderr.emit('end');
      return p;
    });
  });
});
