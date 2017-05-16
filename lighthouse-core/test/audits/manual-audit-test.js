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
'use strict';
const fs = require('fs');
const assert = require('assert');

/* eslint-env mocha */
const manualAuditsPath = __dirname + '/../../audits/manual/';
const auditsModules = fs.readdirSync(manualAuditsPath)
  .map(filename => manualAuditsPath + filename)
  .map(require);

describe('Manual Audits', () => {
  it('sets defaults', () => {
    auditsModules.forEach(audit => {
      assert.strictEqual(audit.meta.requiredArtifacts.length, 0);
      assert.strictEqual(audit.meta.informative, true);
      assert.strictEqual(audit.meta.manual, true);
      assert.strictEqual(audit.meta.informative, true);
    });
  });

  it('returns empty results', () => {
    auditsModules.forEach(audit => {
      const result = audit.audit();
      assert.strictEqual(result.rawValue, false);
      assert.strictEqual(result.displayValue, undefined);
    });
  });
});
