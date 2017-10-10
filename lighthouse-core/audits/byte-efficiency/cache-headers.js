/**
 * @license Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const parseCacheControl = require('parse-cache-control');
const ByteEfficiencyAudit = require('./byte-efficiency-audit');
const WebInspector = require('../../lib/web-inspector');
const URL = require('../../lib/url-shim');

// Ignore assets that have low likelihood for cache miss.
const IGNORE_THRESHOLD_IN_PERCENT = 0.1;
// Discount the wasted bytes by some multiplier to reflect that these savings are only for repeat visits.
const WASTED_BYTES_DISCOUNT_MULTIPLIER = 0.1;

const SECONDS_IN_MINUTE = 60;
const SECONDS_IN_HOUR = 60 * SECONDS_IN_MINUTE;
const SECONDS_IN_DAY = 24 * SECONDS_IN_HOUR;

const CACHEABLE_STATUS_CODES = new Set([200, 203, 206]);

const STATIC_RESOURCE_TYPES = new Set([
  WebInspector.resourceTypes.Font,
  WebInspector.resourceTypes.Image,
  WebInspector.resourceTypes.Media,
  WebInspector.resourceTypes.Script,
  WebInspector.resourceTypes.Stylesheet,
]);

// This array contains the hand wavy distribution of the age of a resource in hours at the time of
// cache hit at 0th, 10th, 20th, 30th, etc percentiles. This is used to compute `wastedMs` since there
// are clearly diminishing returns to cache duration i.e. 6 months is not 2x better than 3 months.
// Based on UMA stats for HttpCache.StaleEntry.Validated.Age, see https://www.desmos.com/calculator/7v0qh1nzvh
// Example: a max-age of 12 hours already covers ~50% of cases, doubling to 24 hours covers ~10% more.
const RESOURCE_AGE_IN_HOURS_DECILES = [0, 0.2, 1, 3, 8, 12, 24, 48, 72, 168, 8760, Infinity];

class CacheHeaders extends ByteEfficiencyAudit {
  /**
   * @return {!AuditMeta}
   */
  static get meta() {
    return {
      category: 'Caching',
      name: 'cache-headers',
      informative: true,
      helpText:
        'A well-defined cache policy can speed up repeat visits to your page. ' +
        '[Learn more](https://developers.google.com/speed/docs/insights/LeverageBrowserCaching).',
      description: 'Leverage browser caching',
      requiredArtifacts: ['devtoolsLogs'],
    };
  }

  /**
   * Converts a time in seconds into a duration string, i.e. `1d 2h 13m 52s`
   * @param {number} maxAgeInSeconds
   * @return {string}
   */
  static toDurationDisplay(maxAgeInSeconds) {
    if (maxAgeInSeconds === 0) {
      return 'None';
    }

    const parts = [];
    const unitLabels = [
      ['d', SECONDS_IN_DAY],
      ['h', SECONDS_IN_HOUR],
      ['m', SECONDS_IN_MINUTE],
      ['s', 1],
    ];

    for (const [label, unit] of unitLabels) {
      const numberOfUnits = Math.floor(maxAgeInSeconds / unit);
      if (numberOfUnits > 0) {
        maxAgeInSeconds -= numberOfUnits * unit;
        parts.push(`${numberOfUnits}\xa0${label}`);
      }
    }

    return parts.join(' ');
  }

  /**
   * Computes the percent likelihood that a return visit will be within the cache lifetime, based on
   * Chrome UMA stats see the note above.
   * @param {number} maxAgeInSeconds
   * @return {number}
   */
  static getCacheHitLikelihood(maxAgeInSeconds) {
    const maxAgeInHours = maxAgeInSeconds / 3600;
    const upperDecileIndex = RESOURCE_AGE_IN_HOURS_DECILES.findIndex(
      decile => decile >= maxAgeInHours
    );
    if (upperDecileIndex === 11) return 1;
    if (upperDecileIndex === 0) return 0;

    const upperDecile = RESOURCE_AGE_IN_HOURS_DECILES[upperDecileIndex];
    const lowerDecile = RESOURCE_AGE_IN_HOURS_DECILES[upperDecileIndex - 1];

    const tenthsPlace = upperDecileIndex;
    // approximate the position between deciles as linear
    const hundredthsPlace = 10 * (maxAgeInHours - lowerDecile) / (upperDecile - lowerDecile);
    return tenthsPlace / 10 + hundredthsPlace / 100;
  }

  /**
   * Computes the user-specified cache lifetime, 0 if explicit no-cache policy is in effect, and null if not
   * user-specified. See https://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html.
   *
   * @param {!Map<string,string>} headers
   * @param {!Object} cacheControl Follows the potential settings of cache-control, see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control
   * @return {?number}
   */
  static computeCacheLifetimeInSeconds(headers, cacheControl) {
    // Pragma controls caching if cache-control is not set, see https://tools.ietf.org/html/rfc7234#section-5.4
    if (!cacheControl && (headers.get('pragma') || '').includes('no-cache')) {
      return 0;
    }

    // Cache-Control takes precendence over expires
    if (cacheControl) {
      if (cacheControl['no-cache'] || cacheControl['no-store']) return 0;
      if (Number.isFinite(cacheControl['max-age'])) return Math.max(cacheControl['max-age'], 0);
    }

    if (headers.has('expires')) {
      const expires = new Date(headers.get('expires')).getTime();
      if (!expires) return 0;
      return Math.max(0, (Date.now() - expires) / 1000);
    }

    return null;
  }

  /**
   * Given a network record, returns whether we believe the asset is cacheable, i.e. it was a network
   * request that satisifed the conditions:
   *
   *  1. Has a cacheable status code
   *  2. Has a resource type that corresponds to static assets (image, script, stylesheet, etc).
   *  3. It does not have a query string.
   *
   * @param {!WebInspector.NetworkRequest} record
   * @return {boolean}
   */
  static isCacheableAsset(record) {
    const resourceUrl = record._url;
    return (
      CACHEABLE_STATUS_CODES.has(record.statusCode) &&
      STATIC_RESOURCE_TYPES.has(record._resourceType) &&
      !resourceUrl.includes('?') &&
      !resourceUrl.includes('data:')
    );
  }

  /**
   * @param {!Artifacts} artifacts
   * @return {!AuditResult}
   */
  static audit_(artifacts) {
    const devtoolsLogs = artifacts.devtoolsLogs[ByteEfficiencyAudit.DEFAULT_PASS];
    return artifacts.requestNetworkRecords(devtoolsLogs).then(records => {
      const results = [];
      for (const record of records) {
        if (!CacheHeaders.isCacheableAsset(record)) continue;

        const headers = new Map();
        for (const header of record._responseHeaders) {
          headers.set(header.name, header.value);
        }

        // Ignore assets that have an etag since they will not be re-downloaded as long as they are valid.
        if (headers.has('etag')) continue;

        const cacheControl = parseCacheControl(headers.get('cache-control'));
        let cacheLifetimeInSeconds = CacheHeaders.computeCacheLifetimeInSeconds(
          headers,
          cacheControl
        );

        // Ignore assets with an explicit no-cache policy
        if (cacheLifetimeInSeconds === 0) continue;
        cacheLifetimeInSeconds = cacheLifetimeInSeconds || 0;

        let cacheMissLikelihood = 1 - CacheHeaders.getCacheHitLikelihood(cacheLifetimeInSeconds);
        if (cacheMissLikelihood < IGNORE_THRESHOLD_IN_PERCENT) continue;

        const totalBytes = record._transferSize;
        const wastedBytes = cacheMissLikelihood * totalBytes * WASTED_BYTES_DISCOUNT_MULTIPLIER;
        const cacheLifetimeDisplay = CacheHeaders.toDurationDisplay(cacheLifetimeInSeconds);
        cacheMissLikelihood = `${Math.round(cacheMissLikelihood * 100)}%`;

        results.push({
          url: URL.elideDataURI(record._url),
          cacheLifetimeInSeconds,
          cacheLifetimeDisplay,
          cacheMissLikelihood,
          totalBytes,
          wastedBytes,
        });
      }

      const headings = [
        {key: 'url', itemType: 'url', text: 'URL'},
        {key: 'cacheLifetimeDisplay', itemType: 'text', text: 'Cache Lifetime'},
        {key: 'cacheMissLikelihood', itemType: 'text', text: 'Cache Miss Likelihood (%)'},
        {key: 'totalKb', itemType: 'text', text: 'Size (KB)'},
      ];

      return {
        results,
        headings,
      };
    });
  }
}

module.exports = CacheHeaders;
