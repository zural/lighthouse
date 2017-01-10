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

const log = require('../../../lighthouse-core/lib/log.js');

class Metrics {

  constructor(traceEvents, auditResults) {
    this._traceEvents = traceEvents;
    this._auditResults = auditResults;
    this._fakeEvents = [];
  }

  /**
   * Returns simplified representation of all metrics
   * @return {!Array<{getTs: Function, id: string, name: string}>} metrics to consider
   */
  static get metricsDefinitions() {
    return [
      {
        name: 'Navigation Start',
        id: 'navstart',
        getTs: auditResults => {
          const fmpExt = auditResults['first-meaningful-paint'].extendedInfo;
          return fmpExt.value.timestamps.navStart;
        }
      },
      {
        name: 'First Contentful Paint',
        id: 'ttfcp',
        getTs: auditResults => {
          const fmpExt = auditResults['first-meaningful-paint'].extendedInfo;
          return fmpExt.value.timestamps.fCP;
        }
      },
      {
        name: 'First Meaningful Paint',
        id: 'ttfmp',
        getTs: auditResults => {
          const fmpExt = auditResults['first-meaningful-paint'].extendedInfo;
          return fmpExt.value.timestamps.fMP;
        }
      },
      {
        name: 'Perceptual Speed Index',
        id: 'psi',
        getTs: auditResults => {
          const siExt = auditResults['speed-index-metric'].extendedInfo;
          return siExt.value.timestamps.perceptualSpeedIndex;
        }
      },
      {
        name: 'First Visual Change',
        id: 'fv',
        getTs: auditResults => {
          const siExt = auditResults['speed-index-metric'].extendedInfo;
          return siExt.value.timestamps.firstVisualChange;
        }
      },
      {
        name: 'Visually Complete 85%',
        id: 'vc85',
        getTs: auditResults => {
          const siExt = auditResults['time-to-interactive'].extendedInfo;
          return siExt.value.timestamps.visuallyReady;
        }
      },
      {
        name: 'Visually Complete 100%',
        id: 'vc',
        getTs: auditResults => {
          const siExt = auditResults['speed-index-metric'].extendedInfo;
          return siExt.value.timestamps.visuallyComplete;
        }
      },
      {
        name: 'Time to Interactive',
        id: 'tti',
        getTs: auditResults => {
          const ttiExt = auditResults['time-to-interactive'].extendedInfo;
          return ttiExt.value.timestamps.timeToInteractive;
        }
      }
    ];
  }

  /**
   * Returns simplified representation of all metrics' timestamps from monotonic clock
   * @param {!Array<!AuditResult>} auditResults
   * @return {!Array<{ts: number, id: string, name: string}>} metrics to consider
   */
  gatherMetrics(auditResults) {
    const metricDfns = Metrics.metricsDefinitions;
    const resolvedMetrics = [];
    metricDfns.forEach(metric => {
      // try/catch in case auditResults is missing an audit result
      try {
        resolvedMetrics.push({
          id: metric.id,
          name: metric.name,
          ts: metric.getTs(auditResults)
        });
      } catch (e) {
        log.error('metrics-evts', `${metric.name} timestamp not found: ${e.message}`);
      }
    });
    return resolvedMetrics;
  }

  /**
   * Getter for our navigationStart trace event
   * @return {!TraceEvent} description
   */
  get navigationStartEvt() {
    if (!this._navigationStartEvt) {
      const filteredEvents = this._traceEvents.filter(e => {
        return e.name === 'TracingStartedInPage' || e.cat === 'blink.user_timing';
      });

      const tracingStartedEvt = filteredEvents.filter(e => e.name === 'TracingStartedInPage')[0];
      const navigationStartEvt = filteredEvents.filter(e => {
        return e.name === 'navigationStart' &&
            e.pid === tracingStartedEvt.pid && e.tid === tracingStartedEvt.tid;
      })[0];
      this._navigationStartEvt = navigationStartEvt;
    }
    return this._navigationStartEvt;
  }


  /**
   * Constructs performance.measure trace events, which have start/end events as follows:
   *     { "pid": 89922,"tid":1295,"ts":77176783452,"ph":"b","cat":"blink.user_timing","name":"innermeasure","args":{},"tts":1257886,"id":"0xe66c67"}
   *     { "pid": 89922,"tid":1295,"ts":77176882592,"ph":"e","cat":"blink.user_timing","name":"innermeasure","args":{},"tts":1257898,"id":"0xe66c67"}
   * @param  {!Object} metric
   * @param  {number} navStartTs
   * @return {!Array<!TraceEvent>} Pair of trace events (start/end)
   */
  synthesizeEventPair(metric, navStartTs) {
    if (!metric.ts || metric.id === 'navstart') {
      return [];
    }

    // We'll masquerade our fake events to look mostly like navigationStart
    const eventBase = {
      pid: this.navigationStartEvt.pid,
      tid: this.navigationStartEvt.tid,
      cat: 'blink.user_timing',
      name: metric.name,
      args: {},
      // randomized id is same for the pair
      id: `0x${((Math.random() * 1000000) | 0).toString(16)}`
    };
    const fakeMeasureStartEvent = Object.assign({}, eventBase, {
      ts: navStartTs,
      ph: 'b'
    });
    const fakeMeasureEndEvent = Object.assign({}, eventBase, {
      ts: metric.ts,
      ph: 'e',
    });
    return [fakeMeasureStartEvent, fakeMeasureEndEvent];
  }

  /**
   * @returns {{!Array<!TraceEvent>} User timing raw trace event pairs
   */
  generateFakeEvents() {
    const metrics = this.gatherMetrics(this._auditResults);
    if (metrics.length === 0) {
      log.error('metrics-events', 'Metrics collection had errors, not synthetizing trace events');
      return [];
    }

    // confirm our navStart's correctly match
    const navStartTs = metrics.find(e => e.id === 'navstart').ts;
    if (this.navigationStartEvt.ts !== navStartTs) {
      log.error('metrics-evts', 'Reference navigationStart doesn\'t match fMP\'s navStart');
      return [];
    }

    metrics.forEach(metric => {
      log.log('metrics-evts', `Sythesizing trace events for ${metric.name}`);
      this._fakeEvents.push(...this.synthesizeEventPair(metric, navStartTs));
    });
    return this._fakeEvents;
  }
}

module.exports = Metrics;
