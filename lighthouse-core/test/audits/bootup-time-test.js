/**
 * @license Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

/* eslint-env mocha */
const BootupTime = require('../../audits/bootup-time.js');
const fs = require('fs');
const assert = require('assert');

// sadly require(file) is not working correctly.
// traceParser parser returns preact trace data the same as JSON.parse
// fails when require is used
const acceptableTrace = JSON.parse(
  fs.readFileSync(__dirname + '/../fixtures/traces/progressive-app-m60.json')
);
const errorTrace = JSON.parse(
  fs.readFileSync(__dirname + '/../fixtures/traces/airhorner_no_fcp.json')
);

describe('Performance: bootup-time audit', () => {
  it('should compute the correct BootupTime values', (done) => {
    const artifacts = {
      traces: {
        [BootupTime.DEFAULT_PASS]: acceptableTrace,
      },
    };

    const output = BootupTime.audit(artifacts);
    assert.equal(output.details.items.length, 7);
    assert.equal(output.score, true);
    assert.equal(Math.round(output.rawValue), 155);

    const valueOf = name => output.extendedInfo.value[name];
    assert.deepEqual(valueOf('https://www.google-analytics.com/analytics.js'), {evaluate: 40.1, compile: 9.6});
    assert.deepEqual(valueOf('https://pwa.rocks/script.js'), {evaluate: 31.8, compile: 1.3});
    assert.deepEqual(valueOf('https://www.googletagmanager.com/gtm.js?id=GTM-Q5SW'), {evaluate: 25, compile: 5.5});
    assert.deepEqual(valueOf('https://www.google-analytics.com/plugins/ua/linkid.js'), {evaluate: 25.2, compile: 1.2});
    assert.deepEqual(valueOf('https://pwa.rocks/'), {evaluate: 6.1, compile: 1.2});
    assert.deepEqual(valueOf('https://www.google-analytics.com/cx/api.js?experiment=jdCfRmudTmy-0USnJ8xPbw'), {evaluate: 1.2, compile: 3});
    assert.deepEqual(valueOf('https://www.google-analytics.com/cx/api.js?experiment=qvpc5qIfRC2EMnbn6bbN5A'), {evaluate: 1, compile: 2.5});

    done();
  });

  it('should get no data when no events are present', () => {
    const artifacts = {
      traces: {
        [BootupTime.DEFAULT_PASS]: errorTrace,
      },
    };

    const output = BootupTime.audit(artifacts);
    assert.equal(output.details.items.length, 0);
    assert.equal(output.score, true);
    assert.equal(Math.round(output.rawValue), 0);
  });
});
