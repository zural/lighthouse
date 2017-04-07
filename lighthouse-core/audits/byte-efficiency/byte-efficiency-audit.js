/**
 * @license
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

const Audit = require('../audit');
const Formatter = require('../../report/formatter');

const KB_IN_BYTES = 1024;
const WASTEFUL_THRESHOLD_IN_BYTES = 20 * KB_IN_BYTES;

/**
 * @fileoverview Used as the base for all byte efficiency audits. Computes total bytes
 *    and estimated time saved. Subclass and override `audit_` to return results.
 */
class UnusedBytes extends Audit {
  /**
   * @param {number} bytes
   * @return {string}
   */
  static bytesToKbString(bytes) {
    return Math.round(bytes / KB_IN_BYTES).toLocaleString() + ' KB';
  }

  /**
   * @param {number} bytes
   * @param {number} percent
   * @return {string}
   */
  static toSavingsString(bytes = 0, percent = 0) {
    const kbDisplay = UnusedBytes.bytesToKbString(bytes);
    const percentDisplay = Math.round(percent).toLocaleString() + '%';
    return `${kbDisplay} _${percentDisplay}_`;
  }

  /**
   * @param {number} bytes
   * @param {number} networkThroughput measured in bytes/second
   * @return {string}
   */
  static bytesToMsString(bytes, networkThroughput) {
    return (Math.round(bytes / networkThroughput * 100) * 10).toLocaleString() + 'ms';
  }

  /**
   * @param {!Artifacts} artifacts
   * @return {!Promise<!AuditResult>}
   */
  static audit(artifacts) {
    const networkRecords = artifacts.networkRecords[Audit.DEFAULT_PASS];
    return artifacts.requestNetworkThroughput(networkRecords).then(networkThroughput => {
      return Promise.resolve(UnusedBytes.audit_(artifacts)).then(result => {
        return UnusedBytes.createAuditResult(result, networkThroughput);
      });
    });
  }

  /**
   * @param {{debugString: (string|undefined), passes: (boolean|undefined),
   *     tableHeadings: !Object, results: !Array<!Object>}} result
   * @param {number} networkThroughput
   * @return {!AuditResult}
   */
  static createAuditResult(result, networkThroughput) {
    const debugString = result.debugString;
    const results = result.results
        .map(item => {
          item.wastedKb = UnusedBytes.bytesToKbString(item.wastedBytes);
          item.wastedMs = UnusedBytes.bytesToMsString(item.wastedBytes, networkThroughput);
          item.totalKb = UnusedBytes.bytesToKbString(item.totalBytes);
          item.totalMs = UnusedBytes.bytesToMsString(item.totalBytes, networkThroughput);
          item.potentialSavings = UnusedBytes.toSavingsString(item.wastedBytes, item.wastedPercent);
          return item;
        })
        .sort((itemA, itemB) => itemB.wastedBytes - itemA.wastedBytes);

    const wastedBytes = results.reduce((sum, item) => sum + item.wastedBytes, 0);

    let displayValue = result.displayValue || '';
    if (typeof result.displayValue === 'undefined' && wastedBytes) {
      const wastedKbDisplay = UnusedBytes.bytesToKbString(wastedBytes);
      const wastedMsDisplay = UnusedBytes.bytesToMsString(wastedBytes, networkThroughput);
      displayValue = `Potential savings of ${wastedKbDisplay} (~${wastedMsDisplay})`;
    }

    return {
      debugString,
      displayValue,
      rawValue: typeof result.passes === 'undefined' ?
          wastedBytes < WASTEFUL_THRESHOLD_IN_BYTES :
          !!result.passes,
      extendedInfo: {
        formatter: Formatter.SUPPORTED_FORMATS.TABLE,
        value: {results, tableHeadings: result.tableHeadings}
      }
    };
  }

  /* eslint-disable no-unused-vars */
  /**
   * @param {!Artifacts} artifacts
   * @return {{results: !Array<Object>, tableHeadings: Object,
   *     passes: (boolean|undefined), debugString: (string|undefined)}}
   */
  static audit_(artifacts) {
    throw new Error('audit_ unimplemented');
  }
  /* eslint-enable no-unused-vars */
}

module.exports = UnusedBytes;
