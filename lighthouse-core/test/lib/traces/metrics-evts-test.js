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

const Metrics = require('../../../lib/traces/metrics-evts');
const assetSaver = require('../../../lib/asset-saver');
const assert = require('assert');

const dbwTrace = require('../../fixtures/traces/dbw_tester.json');
const dbwResults = require('../../fixtures/dbw_tester-perf-results.json');


/* eslint-env mocha */
describe('metrics events class', () => {
  let evts;
  it('exposes metric definitions', () => {
    assert.equal(Metrics.metricsDefinitions.length, 8, 'eight metrics not exposed');
  });

  it('generates fake trace events', () => {
    evts = new Metrics(dbwTrace.traceEvents, dbwResults.audits).generateFakeEvents();

    const metricsWithoutNavstart = Metrics.metricsDefinitions.length - 1;
    assert.equal(evts.length, 2 * metricsWithoutNavstart, 'All expected fake events not created');

    const definitionsWithoutEvents = Metrics.metricsDefinitions
        .filter(metric => metric.id !== 'navstart')
        .filter(metric => !evts.find(e => e.name === metric.name));
    assert.deepEqual(definitionsWithoutEvents, [], 'metrics are missing fake events');

    const eventsWithoutDefinitions = evts
        .filter(evt => !Metrics.metricsDefinitions.find(metric => metric.name === evt.name));
    assert.deepEqual(eventsWithoutDefinitions, [], 'fake events without a metric definition');
  });

  it('generates fake trace events that are valid', () => {
    const vizCompleteEvts = evts.filter(e => e.name.includes('Visually Complete 100'));
    assert.equal(vizCompleteEvts.length, 2, 'Two visually complete 100% events not found');
    assert.equal(vizCompleteEvts[0].id, vizCompleteEvts[1].id, 'UT trace ids don\'t match');

    evts.forEach(e => {
      assert.equal(typeof e.pid, 'number');
      assert.equal(typeof e.tid, 'number');
      assert.equal(typeof e.ts, 'number');
      assert.equal(typeof e.id, 'string');
      assert.equal(typeof e.cat, 'string');
      assert.equal(typeof e.name, 'string');
      assert.equal(typeof e.ph, 'string');
      assert.equal(typeof e.args, 'object');
    });
  });
});

describe('assetSaver prepareAssets', () => {
  it('adds fake events to trace', () => {
    const countEvents = trace => trace.traceEvents.length;
    const mockArtifacts = {
      traces: {
        defaultPass: dbwTrace
      },
      requestScreenshots: () => Promise.resolve([]),
    };
    const beforeCount = countEvents(dbwTrace);
    return assetSaver.prepareAssets(mockArtifacts, dbwResults).then(preparedAssets => {
      const afterCount = countEvents(preparedAssets[0].traceData);
      const metricsSansNavStart = Metrics.metricsDefinitions.length - 1;
      assert.equal(afterCount, beforeCount + (2 * metricsSansNavStart), 'unexpected event count');
    });
  });
});
