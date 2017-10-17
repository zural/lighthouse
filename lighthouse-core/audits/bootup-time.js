/**
 * @license Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const Audit = require('./audit');
const DevtoolsTimelineModel = require('../lib/traces/devtools-timeline-model');
const WebInspector = require('../lib/web-inspector');
const Util = require('../report/v2/renderer/util.js');

class BootupTime extends Audit {
  /**
   * @return {!AuditMeta}
   */
  static get meta() {
    return {
      category: 'Performance',
      name: 'bootup-time',
      description: 'JavaScript boot-up time is high (> 4s)',
      failureDescription: 'JavaScript boot-up time is too high.',
      helpText: 'Consider reducing the time spent parsing, compiling and executing JS. ' +
        'You may find delivering smaller JS payloads helps with this.',
      requiredArtifacts: ['traces'],
    };
  }

  /**
   * @param {!Array<TraceEvent>=} trace
   * @return {!Map<string, Number>}
   */
  static getExecutionTimingsByURL(trace) {
    const timelineModel = new DevtoolsTimelineModel(trace);
    const bottomUpByName = timelineModel.bottomUpGroupBy('URL');
    const result = new Map();

    bottomUpByName.children.forEach((perUrlNode, url) => {
      // when url is "", we skip it
      if (!url) {
        return;
      }

      const tasks = {};
      perUrlNode.children.forEach((perTaskPerUrlNode) => {
        const taskGroup = WebInspector.TimelineUIUtils.eventStyle(perTaskPerUrlNode.event);
        tasks[taskGroup.title] = tasks[taskGroup.title] || 0;
        tasks[taskGroup.title] += Number((perTaskPerUrlNode.selfTime || 0).toFixed(1));
      });
      result.set(url, tasks);
    });

    return result;
  }

  /**
   * @param {!Artifacts} artifacts
   * @return {!AuditResult}
   */
  static audit(artifacts) {
    const trace = artifacts.traces[BootupTime.DEFAULT_PASS];
    const bootupTimings = BootupTime.getExecutionTimingsByURL(trace);

    let totalBootupTime = 0;

    const extendedInfo = {};
    const headings = [
      {key: 'url', itemType: 'url', text: 'URL'},
    ];
    const results = Array.from(bootupTimings).map(([url, durations]) => {
      totalBootupTime += durations.evaluate + durations.compile;
      extendedInfo[url] = durations;

      Object.keys(durations).forEach(key => {
        headings.push({ key, itemType: 'text', text: key });
      });

      return Object.assign({}, {
        url: url,
      }, durations);
    });

    const tableDetails = BootupTime.makeTableDetails(headings, results);

    return {
      score: totalBootupTime < 4000,
      rawValue: totalBootupTime,
      displayValue: Util.formatMilliseconds(totalBootupTime),
      details: tableDetails,
      extendedInfo: {
        value: extendedInfo,
      },
    };
  }
}

module.exports = BootupTime;
