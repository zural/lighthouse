/**
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

const Config = require('../../config/config');
const assert = require('assert');
const path = require('path');
const defaultConfig = require('../../config/default.json');
const log = require('../../lib/log');
const Gatherer = require('../../gather/gatherers/gatherer');
const Audit = require('../../audits/audit');

/* eslint-env mocha */

describe('Config', () => {
  it('returns new object', () => {
    const config = {
      audits: ['is-on-https']
    };
    const newConfig = new Config(config);
    assert.notEqual(config, newConfig);
  });

  it('doesn\'t change directly injected plugins', () => {
    class MyGatherer extends Gatherer {}
    class MyAudit extends Audit {
      static get meta() {
        return {
          name: 'MyAudit',
          category: 'mine',
          description: 'My audit',
          requiredArtifacts: []
        };
      }
      static audit() {}
    }
    const config = {
      passes: [{
        gatherers: [MyGatherer]
      }],
      audits: [MyAudit]
    };
    const newConfig = new Config(config);
    assert.equal(MyGatherer, newConfig.passes[0].gatherers[0]);
    assert.equal(MyAudit, newConfig.audits[0]);
  });

  it('uses the default config when no config is provided', () => {
    const config = new Config();
    const originalConfig = JSON.parse(JSON.stringify(defaultConfig));
    assert.deepStrictEqual(originalConfig.aggregations, config.aggregations);
    assert.equal(originalConfig.audits.length, config.audits.length);
  });

  it('warns when a passName is used twice', () => {
    const unlikelyPassName = 'unlikelyPassName';
    const configJson = {
      passes: [{
        recordNetwork: true,
        passName: unlikelyPassName,
        gatherers: []
      }, {
        recordNetwork: true,
        passName: unlikelyPassName,
        gatherers: []
      }],
      audits: []
    };

    return new Promise((resolve, reject) => {
      const warningListener = function(args) {
        const warningMsg = args[1];
        if (new RegExp(`overwrite.+${unlikelyPassName}`).test(warningMsg)) {
          log.events.removeListener('warning', warningListener);
          resolve();
        }
      };
      log.events.addListener('warning', warningListener);

      const _ = new Config(configJson);
    });
  });

  it('warns when traced twice with no passNames specified', () => {
    const configJson = {
      passes: [{
        recordNetwork: true,
        gatherers: []
      }, {
        recordNetwork: true,
        gatherers: []
      }],
      audits: []
    };

    return new Promise((resolve, reject) => {
      const warningListener = function(args) {
        const warningMsg = args[1];
        if (new RegExp(`overwrite.+${Audit.DEFAULT_PASS}`).test(warningMsg)) {
          log.events.removeListener('warning', warningListener);
          resolve();
        }
      };
      log.events.addListener('warning', warningListener);

      const _ = new Config(configJson);
    });
  });

  it('throws for unknown gatherers', () => {
    const config = {
      passes: [{
        gatherers: ['fuzz']
      }],
      audits: [
        'is-on-https'
      ]
    };

    return assert.throws(_ => new Config(config),
        /Unable to locate/);
  });

  it('doesn\'t mutate old gatherers when filtering passes', () => {
    const configJSON = {
      passes: [{
        gatherers: [
          'url',
          'https',
          'viewport'
        ]
      }],
      audits: ['is-on-https']
    };

    const _ = new Config(configJSON);
    assert.equal(configJSON.passes[0].gatherers.length, 3);
  });

  it('contains new copies of auditResults and aggregations', () => {
    const configJSON = JSON.parse(JSON.stringify(defaultConfig));
    configJSON.auditResults = [{
      value: 1,
      rawValue: 1.0,
      optimalValue: 1.0,
      name: 'Test Audit',
      extendedInfo: {
        formatter: 'Supported formatter',
        value: {
          a: 1
        }
      }
    }];

    const config = new Config(configJSON);
    assert.notEqual(config, configJSON, 'Objects are strictly different');
    assert.ok(config.aggregations, 'Aggregations array exists');
    assert.ok(config.auditResults, 'Audits array exists');
    assert.deepStrictEqual(config.aggregations, configJSON.aggregations, 'Aggregations match');
    assert.notEqual(config.aggregations, configJSON.aggregations, 'Aggregations not same object');
    assert.notEqual(config.auditResults, configJSON.auditResults, 'Audits not same object');
    assert.deepStrictEqual(config.auditResults, configJSON.auditResults, 'Audits match');
  });

  it('expands audits', () => {
    const config = new Config({
      audits: ['user-timings']
    });

    assert.ok(Array.isArray(config.audits));
    assert.equal(config.audits.length, 1);
    return assert.equal(typeof config.audits[0], 'function');
  });

  it('throws when an audit is not found', () => {
    return assert.throws(_ => new Config({
      audits: ['/fake-path/non-existent-audit']
    }), /locate audit/);
  });

  it('throws on a non-absolute config path', () => {
    const configPath = '../../config/default.json';

    return assert.throws(_ => new Config({
      audits: []
    }, configPath), /absolute path/);
  });

  it('loads an audit relative to a config path', () => {
    const configPath = __filename;

    return assert.doesNotThrow(_ => new Config({
      audits: ['../fixtures/valid-custom-audit']
    }, configPath));
  });

  it('loads an audit from node_modules/', () => {
    return assert.throws(_ => new Config({
      // Use a lighthouse dep as a stand in for a module.
      audits: ['mocha']
    }), function(err) {
      // Should throw an audit validation error, but *not* an audit not found error.
      return !/locate audit/.test(err) && /audit\(\) method/.test(err);
    });
  });

  it('loads an audit relative to the working directory', () => {
    // Construct an audit URL relative to current working directory, regardless
    // of where test was started from.
    const absoluteAuditPath = path.resolve(__dirname, '../fixtures/valid-custom-audit');
    assert.doesNotThrow(_ => require.resolve(absoluteAuditPath));
    const relativePath = path.relative(process.cwd(), absoluteAuditPath);

    return assert.doesNotThrow(_ => new Config({
      audits: [relativePath]
    }));
  });

  it('throws but not for missing audit when audit has a dependency error', () => {
    return assert.throws(_ => new Config({
      audits: [path.resolve(__dirname, '../fixtures/invalid-audits/require-error.js')]
    }), function(err) {
      // We're expecting not to find parent class Audit, so only reject on our
      // own custom locate audit error, not the usual MODULE_NOT_FOUND.
      return !/locate audit/.test(err) && err.code === 'MODULE_NOT_FOUND';
    });
  });

  it('throws when it finds invalid audits', () => {
    const basePath = path.resolve(__dirname, '../fixtures/invalid-audits');
    assert.throws(_ => new Config({
      audits: [basePath + '/missing-audit']
    }), /audit\(\) method/);

    assert.throws(_ => new Config({
      audits: [basePath + '/missing-category']
    }), /meta.category property/);

    assert.throws(_ => new Config({
      audits: [basePath + '/missing-name']
    }), /meta.name property/);

    assert.throws(_ => new Config({
      audits: [basePath + '/missing-description']
    }), /meta.description property/);

    assert.throws(_ => new Config({
      audits: [basePath + '/missing-required-artifacts']
    }), /meta.requiredArtifacts property/);

    return assert.throws(_ => new Config({
      audits: [basePath + '/missing-generate-audit-result']
    }), /generateAuditResult\(\) method/);
  });

  describe('select passes needed by gatherers', () => {
    it('selects correct passes', () => {
      const defaultPasses = JSON.parse(JSON.stringify(defaultConfig)).passes;
      const requiredGatherers = new Set(['traces', 'networkRecords']);
      const actualPasses = Config.selectPassesNeededByGatherers(defaultPasses, requiredGatherers);
      assert.equal(actualPasses.length, 1, 'Pass filtering failed');
    });
  });

  describe('buildConfigFromTags', () => {
    function buildConfigFromTags(chosenTags) {
      const runConfig = JSON.parse(JSON.stringify(defaultConfig));
      Config.rebuildConfigFromTags(runConfig, chosenTags);
      return runConfig;
    }

    it('for pwa preset', () => {
      const expectedConfig = {'passes': [{'recordNetwork': true, 'recordTrace': true, 'gatherers': ['url', 'https', 'viewport', 'theme-color', 'manifest', 'content-width']}, {'passName': 'offlinePass', 'recordNetwork': true, 'gatherers': ['service-worker', 'offline']}, {'gatherers': ['http-redirect', 'html-without-javascript']}], 'audits': ['is-on-https', 'redirects-http', 'service-worker', 'works-offline', 'viewport', 'without-javascript', 'first-meaningful-paint', 'speed-index-metric', 'estimated-input-latency', 'time-to-interactive', 'manifest-exists', 'manifest-background-color', 'manifest-theme-color', 'manifest-icons-min-192', 'manifest-icons-min-144', 'manifest-name', 'manifest-short-name', 'manifest-start-url', 'theme-color-meta', 'content-width'], 'aggregations': [{'name': 'Progressive Web App', 'description': 'These audits validate the aspects of a Progressive Web App.', 'id': 'pwa_parent', 'tags': ['pwa'], 'scored': true, 'categorizable': true, 'items': [{'name': 'App can load on offline/flaky connections', 'description': 'Ensuring your web app can respond when the network connection is unavailable or flaky is critical to providing your users a good experience. This is achieved through use of a [Service Worker](https://developers.google.com/web/fundamentals/primers/service-worker/).', 'tags': ['pwa'], 'audits': {'service-worker': {'expectedValue': true, 'weight': 1}, 'works-offline': {'expectedValue': true, 'weight': 1}}}, {'name': 'Page load performance is fast', 'description': 'Users notice if sites and apps don\'t perform well. These top-level metrics capture the most important perceived performance concerns.', 'id': 'perf_metrics', 'tags': ['pwa', 'perf'], 'audits': {'first-meaningful-paint': {'expectedValue': 100, 'weight': 1}, 'speed-index-metric': {'expectedValue': 100, 'weight': 1}, 'estimated-input-latency': {'expectedValue': 100, 'weight': 1}, 'time-to-interactive': {'expectedValue': 100, 'weight': 1}}}, {'name': 'Site is progressively enhanced', 'description': 'Progressive enhancement means that everyone can access the basic content and functionality of a page in any browser, and those without certain browser features may receive a reduced but still functional experience.', 'id': 'progressive_enhancement', 'tags': ['pwa'], 'audits': {'without-javascript': {'expectedValue': true, 'weight': 1}}}, {'name': 'Network connection is secure', 'description': 'Security is an important part of the web for both developers and users. Moving forward, Transport Layer Security (TLS) support will be required for many APIs.', 'id': 'network_security', 'tags': ['pwa'], 'audits': {'is-on-https': {'expectedValue': true, 'weight': 1}, 'redirects-http': {'expectedValue': true, 'weight': 1}}}, {'name': 'User can be prompted to Add to Homescreen', 'description': 'While users can manually add your site to their homescreen in the browser menu, the [prompt (aka app install banner)](https://developers.google.com/web/updates/2015/03/increasing-engagement-with-app-install-banners-in-chrome-for-android) will proactively prompt the user to install the app if the below requirements are met and the user has visited your site at least twice (with at least five minutes between visits).', 'tags': ['pwa'], 'id': 'a2hs', 'see': 'https://github.com/GoogleChrome/lighthouse/issues/23', 'audits': {'service-worker': {'expectedValue': true, 'weight': 1}, 'manifest-exists': {'expectedValue': true, 'weight': 1}, 'manifest-start-url': {'expectedValue': true, 'weight': 1}, 'manifest-icons-min-144': {'expectedValue': true, 'weight': 1}, 'manifest-short-name': {'expectedValue': true, 'weight': 1}}}, {'name': 'Installed web app will launch with custom splash screen', 'description': 'A default splash screen will be constructed, but meeting these requirements guarantee a high-quality and customizable [splash screen](https://developers.google.com/web/updates/2015/10/splashscreen) the user sees between tapping the home screen icon and your app\'s first paint.', 'tags': ['pwa'], 'id': 'splash_screen', 'see': 'https://github.com/GoogleChrome/lighthouse/issues/24', 'audits': {'manifest-exists': {'expectedValue': true, 'weight': 1}, 'manifest-name': {'expectedValue': true, 'weight': 1}, 'manifest-background-color': {'expectedValue': true, 'weight': 1}, 'manifest-theme-color': {'expectedValue': true, 'weight': 1}, 'manifest-icons-min-192': {'expectedValue': true, 'weight': 1}}}, {'name': 'Address bar matches brand colors', 'description': 'The browser address bar can be themed to match your site. A `theme-color` [meta tag](https://developers.google.com/web/updates/2014/11/Support-for-theme-color-in-Chrome-39-for-Android) will upgrade the address bar when a user browses the site, and the [manifest theme-color](https://developers.google.com/web/updates/2015/08/using-manifest-to-set-sitewide-theme-color) will apply the same theme site-wide once it\'s been added to homescreen.', 'tags': ['pwa'], 'id': 'omnibox', 'audits': {'manifest-exists': {'expectedValue': true, 'weight': 1}, 'theme-color-meta': {'expectedValue': true, 'weight': 1}, 'manifest-theme-color': {'expectedValue': true, 'weight': 1}}}, {'name': 'Design is mobile-friendly', 'description': 'Users increasingly experience your app on mobile devices, so it\'s important to ensure that the experience can adapt to smaller screens.', 'id': 'mobile_friendly', 'tags': ['pwa'], 'audits': {'viewport': {'expectedValue': true, 'weight': 1}, 'content-width': {'expectedValue': true, 'weight': 1}}}]}]};
      assert.deepStrictEqual(buildConfigFromTags(['pwa']), expectedConfig, 'cannot handle just pwa');
    });

    it('for perf preset', () => {
      const expectedConfig = {'passes': [{'recordNetwork': true, 'recordTrace': true, 'gatherers': []}], 'audits': ['first-meaningful-paint', 'speed-index-metric', 'estimated-input-latency', 'time-to-interactive', 'user-timings', 'critical-request-chains'], 'aggregations': [{'name': 'Page load performance is fast', 'description': 'Users notice if sites and apps don\'t perform well. These top-level metrics capture the most important perceived performance concerns.', 'id': 'perf_metrics', 'tags': ['pwa', 'perf'], 'scored': false, 'categorizable': false, 'items': [{'audits': {'first-meaningful-paint': {'expectedValue': 100, 'weight': 1}, 'speed-index-metric': {'expectedValue': 100, 'weight': 1}, 'estimated-input-latency': {'expectedValue': 100, 'weight': 1}, 'time-to-interactive': {'expectedValue': 100, 'weight': 1}}}]}, {'name': 'Performance Metrics', 'description': 'These encapsulate your app\'s performance.', 'id': 'perf_diagnostics', 'tags': ['perf'], 'scored': false, 'categorizable': false, 'items': [{'audits': {'critical-request-chains': {'expectedValue': 0, 'weight': 1}, 'user-timings': {'expectedValue': 0, 'weight': 1}}}]}]};
      const perfConfig = buildConfigFromTags(['perf']);
      assert.deepStrictEqual(perfConfig, expectedConfig, 'cannot handle just perf');
      assert.equal(perfConfig.passes.length, 1, 'more than one pass created for perf');
    });

    it('for best_practices preset', () => {
      const expectedConfig = {'passes': [{'recordNetwork': true, 'recordTrace': true, 'gatherers': ['url', 'https', 'manifest', 'accessibility']}, {'recordNetwork': true, 'passName': 'dbw', 'gatherers': ['styles', 'css-usage', 'dobetterweb/all-event-listeners', 'dobetterweb/anchors-with-no-rel-noopener', 'dobetterweb/appcache', 'dobetterweb/console-time-usage', 'dobetterweb/datenow', 'dobetterweb/document-write', 'dobetterweb/geolocation-on-start', 'dobetterweb/notification-on-start', 'dobetterweb/tags-blocking-first-paint', 'dobetterweb/websql']}], 'audits': ['is-on-https', 'manifest-display', 'manifest-short-name-length', 'unused-css-rules', 'accessibility/aria-allowed-attr', 'accessibility/aria-required-attr', 'accessibility/aria-valid-attr-value', 'accessibility/aria-valid-attr', 'accessibility/color-contrast', 'accessibility/image-alt', 'accessibility/label', 'accessibility/tabindex', 'dobetterweb/external-anchors-use-rel-noopener', 'dobetterweb/appcache-manifest', 'dobetterweb/geolocation-on-start', 'dobetterweb/link-blocking-first-paint', 'dobetterweb/no-console-time', 'dobetterweb/no-datenow', 'dobetterweb/no-document-write', 'dobetterweb/no-mutation-events', 'dobetterweb/no-old-flexbox', 'dobetterweb/no-websql', 'dobetterweb/notification-on-start', 'dobetterweb/script-blocking-first-paint', 'dobetterweb/uses-http2', 'dobetterweb/uses-passive-event-listeners'], 'aggregations': [{'name': 'Best Practices', 'description': 'We\'ve compiled some recommendations for modernizing your web app and avoiding performance pitfalls. These audits do not affect your score but are worth a look.', 'id': 'best_practices_parent', 'tags': ['best_practices'], 'scored': false, 'categorizable': true, 'items': [{'name': 'Using modern offline features', 'id': 'modern_offline', 'tags': ['best_practices'], 'audits': {'appcache-manifest': {'expectedValue': false}, 'no-websql': {'expectedValue': false}}}, {'name': 'Using modern protocols', 'id': 'modern_network', 'tags': ['best_practices'], 'audits': {'is-on-https': {'expectedValue': false}, 'uses-http2': {'expectedValue': false, 'description': 'Resources made by this application should be severed over HTTP/2 for improved performance.'}}}, {'name': 'Using bytes efficiently', 'id': 'byte_efficiency', 'tags': ['best_practices'], 'audits': {'unused-css-rules': {}}}, {'name': 'Using modern CSS features', 'id': 'modern_css', 'tags': ['best_practices'], 'audits': {'no-old-flexbox': {'expectedValue': false}}}, {'name': 'Using modern JavaScript features', 'id': 'modern_js', 'tags': ['best_practices'], 'audits': {'uses-passive-event-listeners': {'expectedValue': true}, 'no-mutation-events': {'expectedValue': false}}}, {'name': 'Avoiding APIs that harm the user experience', 'id': 'ux_harmful_apis', 'tags': ['best_practices'], 'audits': {'no-document-write': {'expectedValue': false}, 'link-blocking-first-paint': {'expectedValue': false}, 'script-blocking-first-paint': {'expectedValue': false}, 'external-anchors-use-rel-noopener': {'expectedValue': true}, 'geolocation-on-start': {'expectedValue': false}, 'notification-on-start': {'expectedValue': false}}}, {'name': 'Accessibility', 'id': 'a11y', 'tags': ['best_practices'], 'audits': {'aria-allowed-attr': {'expectedValue': true, 'weight': 1}, 'aria-required-attr': {'expectedValue': true, 'weight': 1}, 'aria-valid-attr': {'expectedValue': true, 'weight': 1}, 'aria-valid-attr-value': {'expectedValue': true, 'weight': 1}, 'color-contrast': {'expectedValue': true, 'weight': 1}, 'image-alt': {'expectedValue': true, 'weight': 1}, 'label': {'expectedValue': true, 'weight': 1}, 'tabindex': {'expectedValue': true, 'weight': 1}}}, {'name': 'Other', 'id': 'other_best_practices', 'tags': ['best_practices'], 'audits': {'manifest-short-name-length': {'expectedValue': true, 'weight': 1}, 'manifest-display': {'expectedValue': true, 'weight': 1}}}]}, {'name': 'Fancier stuff', 'description': 'A list of newer features that you could be using in your app. These audits do not affect your score and are just suggestions.', 'id': 'fancy_best_practices', 'tags': ['best_practices'], 'scored': false, 'categorizable': true, 'items': [{'name': 'New JavaScript features', 'audits': {'no-datenow': {'expectedValue': false}, 'no-console-time': {'expectedValue': false}}}]}]};
      assert.deepStrictEqual(buildConfigFromTags(['best_practices']), expectedConfig, 'cannot handle just best_practices');
    });

    it('for selecting all', () => {
      const expectedConfig = JSON.parse(JSON.stringify(defaultConfig));
      assert.deepStrictEqual(buildConfigFromTags(['pwa', 'perf', 'best_practices']), expectedConfig, 'cannot handle just all tags selected');
    });

    it('for perf + best_practices', () => {
      const expectedConfig = {'passes': [{'recordNetwork': true, 'recordTrace': true, 'gatherers': ['url', 'https', 'manifest', 'accessibility']}, {'recordNetwork': true, 'passName': 'dbw', 'gatherers': ['styles', 'css-usage', 'dobetterweb/all-event-listeners', 'dobetterweb/anchors-with-no-rel-noopener', 'dobetterweb/appcache', 'dobetterweb/console-time-usage', 'dobetterweb/datenow', 'dobetterweb/document-write', 'dobetterweb/geolocation-on-start', 'dobetterweb/notification-on-start', 'dobetterweb/tags-blocking-first-paint', 'dobetterweb/websql']}], 'audits': ['is-on-https', 'manifest-display', 'first-meaningful-paint', 'speed-index-metric', 'estimated-input-latency', 'time-to-interactive', 'user-timings', 'critical-request-chains', 'manifest-short-name-length', 'unused-css-rules', 'accessibility/aria-allowed-attr', 'accessibility/aria-required-attr', 'accessibility/aria-valid-attr-value', 'accessibility/aria-valid-attr', 'accessibility/color-contrast', 'accessibility/image-alt', 'accessibility/label', 'accessibility/tabindex', 'dobetterweb/external-anchors-use-rel-noopener', 'dobetterweb/appcache-manifest', 'dobetterweb/geolocation-on-start', 'dobetterweb/link-blocking-first-paint', 'dobetterweb/no-console-time', 'dobetterweb/no-datenow', 'dobetterweb/no-document-write', 'dobetterweb/no-mutation-events', 'dobetterweb/no-old-flexbox', 'dobetterweb/no-websql', 'dobetterweb/notification-on-start', 'dobetterweb/script-blocking-first-paint', 'dobetterweb/uses-http2', 'dobetterweb/uses-passive-event-listeners'], 'aggregations': [{'name': 'Page load performance is fast', 'description': 'Users notice if sites and apps don\'t perform well. These top-level metrics capture the most important perceived performance concerns.', 'id': 'perf_metrics', 'tags': ['pwa', 'perf'], 'scored': false, 'categorizable': false, 'items': [{'audits': {'first-meaningful-paint': {'expectedValue': 100, 'weight': 1}, 'speed-index-metric': {'expectedValue': 100, 'weight': 1}, 'estimated-input-latency': {'expectedValue': 100, 'weight': 1}, 'time-to-interactive': {'expectedValue': 100, 'weight': 1}}}]}, {'name': 'Best Practices', 'description': 'We\'ve compiled some recommendations for modernizing your web app and avoiding performance pitfalls. These audits do not affect your score but are worth a look.', 'id': 'best_practices_parent', 'tags': ['best_practices'], 'scored': false, 'categorizable': true, 'items': [{'name': 'Using modern offline features', 'id': 'modern_offline', 'tags': ['best_practices'], 'audits': {'appcache-manifest': {'expectedValue': false}, 'no-websql': {'expectedValue': false}}}, {'name': 'Using modern protocols', 'id': 'modern_network', 'tags': ['best_practices'], 'audits': {'is-on-https': {'expectedValue': false}, 'uses-http2': {'expectedValue': false, 'description': 'Resources made by this application should be severed over HTTP/2 for improved performance.'}}}, {'name': 'Using bytes efficiently', 'id': 'byte_efficiency', 'tags': ['best_practices'], 'audits': {'unused-css-rules': {}}}, {'name': 'Using modern CSS features', 'id': 'modern_css', 'tags': ['best_practices'], 'audits': {'no-old-flexbox': {'expectedValue': false}}}, {'name': 'Using modern JavaScript features', 'id': 'modern_js', 'tags': ['best_practices'], 'audits': {'uses-passive-event-listeners': {'expectedValue': true}, 'no-mutation-events': {'expectedValue': false}}}, {'name': 'Avoiding APIs that harm the user experience', 'id': 'ux_harmful_apis', 'tags': ['best_practices'], 'audits': {'no-document-write': {'expectedValue': false}, 'link-blocking-first-paint': {'expectedValue': false}, 'script-blocking-first-paint': {'expectedValue': false}, 'external-anchors-use-rel-noopener': {'expectedValue': true}, 'geolocation-on-start': {'expectedValue': false}, 'notification-on-start': {'expectedValue': false}}}, {'name': 'Accessibility', 'id': 'a11y', 'tags': ['best_practices'], 'audits': {'aria-allowed-attr': {'expectedValue': true, 'weight': 1}, 'aria-required-attr': {'expectedValue': true, 'weight': 1}, 'aria-valid-attr': {'expectedValue': true, 'weight': 1}, 'aria-valid-attr-value': {'expectedValue': true, 'weight': 1}, 'color-contrast': {'expectedValue': true, 'weight': 1}, 'image-alt': {'expectedValue': true, 'weight': 1}, 'label': {'expectedValue': true, 'weight': 1}, 'tabindex': {'expectedValue': true, 'weight': 1}}}, {'name': 'Other', 'id': 'other_best_practices', 'tags': ['best_practices'], 'audits': {'manifest-short-name-length': {'expectedValue': true, 'weight': 1}, 'manifest-display': {'expectedValue': true, 'weight': 1}}}]}, {'name': 'Performance Metrics', 'description': 'These encapsulate your app\'s performance.', 'id': 'perf_diagnostics', 'tags': ['perf'], 'scored': false, 'categorizable': false, 'items': [{'audits': {'critical-request-chains': {'expectedValue': 0, 'weight': 1}, 'user-timings': {'expectedValue': 0, 'weight': 1}}}]}, {'name': 'Fancier stuff', 'description': 'A list of newer features that you could be using in your app. These audits do not affect your score and are just suggestions.', 'id': 'fancy_best_practices', 'tags': ['best_practices'], 'scored': false, 'categorizable': true, 'items': [{'name': 'New JavaScript features', 'audits': {'no-datenow': {'expectedValue': false}, 'no-console-time': {'expectedValue': false}}}]}]};
      assert.deepStrictEqual(buildConfigFromTags(['perf', 'best_practices']), expectedConfig, 'cannot handle perf + best practices');
    });
  });

  it('expands artifacts', () => {
    const config = new Config({
      artifacts: {
        traces: {
          defaultPass: path.resolve(__dirname, '../fixtures/traces/trace-user-timings.json')
        },
        performanceLog: path.resolve(__dirname, '../fixtures/perflog.json')
      }
    });
    const traceUserTimings = require('../fixtures/traces/trace-user-timings.json');
    assert.deepStrictEqual(config.artifacts.traces.defaultPass.traceEvents, traceUserTimings);
    assert.equal(config.artifacts.networkRecords.defaultPass.length, 76);
  });

  it('expands artifacts with multiple named passes', () => {
    const config = new Config({
      artifacts: {
        traces: {
          defaultPass: path.resolve(__dirname, '../fixtures/traces/trace-user-timings.json'),
          otherPass: path.resolve(__dirname, '../fixtures/traces/trace-user-timings.json')
        },
        performanceLog: {
          defaultPass: path.resolve(__dirname, '../fixtures/perflog.json'),
          otherPass: path.resolve(__dirname, '../fixtures/perflog.json')
        }
      }
    });
    const traceUserTimings = require('../fixtures/traces/trace-user-timings.json');
    assert.deepStrictEqual(config.artifacts.traces.defaultPass.traceEvents, traceUserTimings);
    assert.deepStrictEqual(config.artifacts.traces.otherPass.traceEvents, traceUserTimings);
    assert.equal(config.artifacts.networkRecords.defaultPass.length, 76);
    assert.equal(config.artifacts.networkRecords.otherPass.length, 76);
  });

  it('handles traces with no TracingStartedInPage events', () => {
    const config = new Config({
      artifacts: {
        traces: {
          defaultPass: path.resolve(__dirname,
                           '../fixtures/traces/trace-user-timings-no-tracingstartedinpage.json')
        },
        performanceLog: path.resolve(__dirname, '../fixtures/perflog.json')
      }
    });

    assert.ok(config.artifacts.traces.defaultPass.traceEvents.find(
          e => e.name === 'TracingStartedInPage' && e.args.data.page === '0xhad00p'));
  });
});
