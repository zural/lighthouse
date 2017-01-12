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

const ExtensionProtocol = require('../../../lighthouse-core/gather/connections/extension');
const RawProtocol = require('../../../lighthouse-core/gather/connections/raw');
const Runner = require('../../../lighthouse-core/runner');
const Config = require('../../../lighthouse-core/config/config');
const defaultConfig = require('../../../lighthouse-core/config/default.json');
const log = require('../../../lighthouse-core/lib/log');

const ReportGenerator = require('../../../lighthouse-core/report/report-generator');

const STORAGE_KEY = 'lighthousev2_audits';
const SETTINGS_KEY = 'lighthouse_settings';
const isExtension = window.chrome && chrome.runtime;
const _flatten = arr => [].concat(...arr);
const _uniq = arr => Array.from(new Set(arr));

let installedExtensions = [];
let disableExtensionsDuringRun = false;
let lighthouseIsRunning = false;
let latestStatusLog = [];

/**
 * Enables or disables all other installed chrome extensions. The initial list
 * of the user's extension is created when the background page is started.
 * @param {!boolean} enable If true, enables all other installed extensions.
 *     False disables them.
 * @param {!Promise}
 */
function enableOtherChromeExtensions(enable) {
  if (!disableExtensionsDuringRun) {
    return Promise.resolve();
  }

  const str = enable ? 'enabling' : 'disabling';
  log.log('Chrome', `${str} ${installedExtensions.length} extensions.`);

  return Promise.all(installedExtensions.map(info => {
    return new Promise((resolve, reject) => {
      chrome.management.setEnabled(info.id, enable, _ => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        }
        resolve();
      });
    });
  }));
}

/**
 * Filter out any unrequested aggregations from the config. If any audits are
 * no longer needed by any remaining aggregations, filter out those as well.
 * @param {!Object} config Lighthouse config object.
 * @param {!Object<boolean>} aggregationTags Ids of aggregation tags to include.
 */
function getConfigFromTags(config, aggregationTags) {
  // Change tags object to a plain array of tag strings
  const chosenTags = aggregationTags.filter(tag => tag.value).map(tag => tag.id);
  // Provided a config aggregation, should it be included?
  const isAggregationSelected = agg => agg.tags.some(itemTag => chosenTags.includes(itemTag));

  const chosenAggregations = [];
  config.aggregations.forEach(aggregation => {
    if (aggregation.items.length === 1) {
      if (isAggregationSelected(aggregation)) {
        chosenAggregations.push(aggregation);
      }
      return;
    }
    // Keep if the config's aggregation has one of the provided tags
    aggregation.items = aggregation.items.filter(isAggregationSelected);

    // All items were removed, so we're uninterested in the parent aggregation
    if (aggregation.items.length === 0) {
      return;
    }
    // Push child aggregations to top level if they are wanted but parent isn't
    if (!isAggregationSelected(aggregation) && aggregation.items.length) {
      aggregation.items.forEach(item => {
        item.scored = false;
        item.categorizable = false;
        item.items = [{audits: item.audits}];
        delete item.audits;
        chosenAggregations.push(item);
      });
      return;
    };

    log.error('unexpected to be here', aggregation);
  });
  config.aggregations = chosenAggregations;

  // Find audits required for remaining aggregations.
  const requestedItems = _flatten(config.aggregations.map(aggregation => aggregation.items));
  const auditsArray = _flatten(requestedItems.map(item => Object.keys(item.audits)));
  const requestedAuditNames = new Set(auditsArray);

  // The `audits` property in the config is a list of paths of audits to run.
  // `requestedAuditNames` is a list of audit *names*. Map paths to names, then
  // filter out any paths of audits with names that weren't requested.
  const auditObjectsAll = Config.requireAudits(config.audits);
  const auditPathToName = new Map(auditObjectsAll.map((AuditClass, index) => {
    const auditPath = config.audits[index];
    const auditName = AuditClass.meta.name;
    return [auditPath, auditName];
  }));
  config.audits = config.audits.filter(auditPath => {
    const auditName = auditPathToName.get(auditPath);
    return requestedAuditNames.has(auditName);
  });

  const auditObjects = Config.requireAudits(config.audits);
  const requiredGatherers = Config.getGatherersNeededByAudits(auditObjects);
  config.passes = config.passes.filter(pass => {
    // remove any unncessary gatherers
    pass.gatherers = pass.gatherers.filter(gathererName => requiredGatherers.has(gathererName));
    return pass.gatherers.length > 0;
  });
  if (config.passes.length === 0) {
    if (requiredGatherers.has('traces') || requiredGatherers.has('networkRecords')) {
      config.passes.push({
        recordNetwork: requiredGatherers.has('networkRecords'),
        recordTrace: requiredGatherers.has('traces'),
        gatherers: []
      });
    }
  }
}

/**
 * Sets the extension badge text.
 * @param {string=} optUrl If present, sets the badge text to "Testing <url>".
 *     Otherwise, restore the default badge text.
 */
function updateBadgeUI(optUrl) {
  if (isExtension) {
    const manifest = chrome.runtime.getManifest();

    let title = manifest.browser_action.default_title;
    let path = manifest.browser_action.default_icon['38'];

    if (lighthouseIsRunning) {
      title = `Testing ${optUrl}`;
      path = 'images/lh_logo_icon_light.png';
    }

    chrome.browserAction.setTitle({title});
    chrome.browserAction.setIcon({path});
  }
}

/**
 * Removes artifacts from the result object for portability
 * @param {!Object} result Lighthouse results object
 */
function filterOutArtifacts(result) {
  // strip them out, as the networkRecords artifact has circular structures
  result.artifacts = undefined;
}

/**
 * @param {!Connection} connection
 * @param {string} url
 * @param {!Object} options Lighthouse options.
 * @param {!Object<boolean>} aggregationTags Ids of aggregation tags to include.
 * @return {!Promise}
 */
window.runLighthouseForConnection = function(connection, url, options, aggregationTags) {
  // Always start with a freshly parsed default config.
  const runConfig = JSON.parse(JSON.stringify(defaultConfig));

  getConfigFromTags(runConfig, aggregationTags);
  const config = new Config(runConfig);

  // Add url and config to fresh options object.
  const runOptions = Object.assign({}, options, {url, config});

  lighthouseIsRunning = true;
  updateBadgeUI(url);

  return Runner.run(connection, runOptions) // Run Lighthouse.
    .then(result => {
      lighthouseIsRunning = false;
      updateBadgeUI();
      filterOutArtifacts(result);
      return result;
    })
    .catch(err => {
      lighthouseIsRunning = false;
      updateBadgeUI();
      throw err;
    });
};

/**
 * @param {!Object} options Lighthouse options.
 * @param {!Object<boolean>} aggregationTags Ids of aggregation tags to include.
 * @return {!Promise}
 */
window.runLighthouseInExtension = function(options, aggregationTags) {
  // Default to 'info' logging level.
  log.setLevel('info');
  const connection = new ExtensionProtocol();
  return enableOtherChromeExtensions(false)
    .then(_ => connection.getCurrentTabURL())
    .then(url => window.runLighthouseForConnection(connection, url, options, aggregationTags))
    .then(results => {
      return enableOtherChromeExtensions(true).then(_ => {
        const blobURL = window.createReportPageAsBlob(results, 'extension');
        chrome.tabs.create({url: blobURL});
      });
    }).catch(err => {
      return enableOtherChromeExtensions(true).then(_ => {
        throw err;
      });
    });
};

/**
 * @param {!RawProtocol.Port} port
 * @param {string} url
 * @param {!Object} options Lighthouse options.
 * @param {!Object<boolean>} aggregationTags Ids of aggregation tags to include.
 * @return {!Promise}
 */
window.runLighthouseInWorker = function(port, url, options, aggregationTags) {
  // Default to 'info' logging level.
  log.setLevel('info');
  const connection = new RawProtocol(port);
  return window.runLighthouseForConnection(connection, url, options, aggregationTags);
};

/**
 * @param {!Object} results Lighthouse results object
 * @param {!string} reportContext Where the report is going
 * @return {!string} Blob URL of the report (or error page) HTML
 */
window.createReportPageAsBlob = function(results, reportContext) {
  performance.mark('report-start');

  const reportGenerator = new ReportGenerator();
  let html;
  try {
    html = reportGenerator.generateHTML(results, reportContext);
  } catch (err) {
    html = reportGenerator.renderException(err, results);
  }
  const blob = new Blob([html], {type: 'text/html'});
  const blobURL = window.URL.createObjectURL(blob);

  performance.mark('report-end');
  performance.measure('generate report', 'report-start', 'report-end');
  return blobURL;
};

const tagMap = {
  'pwa': 'Progressive Web App audits',
  'perf': 'Performance metrics & diagnostics',
  'best_practices': 'Developer best practices'
};

window.getDefaultAggregationTags = function() {
  return _uniq(_flatten(getDefaultAggregations().map(agg => agg.tags))).map(tag => {
    return {
      id: tag,
      value: true,
      name: tagMap[tag]
    };
  });
};

/**
 * Returns list of aggregation categories (each with a list of its constituent
 * audits) from the default config.
 * @return {!Array<{name: string, audits: !Array<string>}>}
 */
window.getDefaultAggregations = function() {
  return _flatten(
    defaultConfig.aggregations.map(aggregation => {
      if (aggregation.items.length === 1) {
        return {
          name: aggregation.name,
          id: aggregation.id,
          tags: aggregation.tags,
          description: aggregation.description,
          audits: aggregation.items[0].audits,
        };
      }

      return aggregation.items;
    })
  ).map(aggregation => {
    return {
      name: aggregation.name,
      id: aggregation.id,
      tags: aggregation.tags,
      description: aggregation.description,
      audits: Object.keys(aggregation.audits)
    };
  });
};

/**
 * Save currently selected set of aggregation categories to local storage.
 * @param {{selectedTags: !Array<string>, disableExtensions: boolean}} settings
 */
window.saveSettings = function(settings, selectedTags) {
  const storage = {
    [STORAGE_KEY]: {},
    [SETTINGS_KEY]: {}
  };

  // Stash selected aggregations.
  storage[STORAGE_KEY] = selectedTags;

  // Stash disable extensionS setting.
  disableExtensionsDuringRun = settings.disableExtensions;
  storage[SETTINGS_KEY].disableExtensions = disableExtensionsDuringRun;

  // Save object to chrome local storage.
  chrome.storage.local.set(storage);
};

/**
 * Load selected aggregation categories from local storage
 * @return {!Promise<{selectedAggregations: !Object<boolean>, disableExtensions: boolean}>}
 */
window.loadSettings = function() {
  return new Promise(resolve => {
    chrome.storage.local.get([STORAGE_KEY, SETTINGS_KEY], result => {
      // start with all default tags, so the list is up to date
      const tags = [].concat(window.getDefaultAggregationTags());

      if (Array.isArray(selectedTags)) {
        // Override the tags with anything disabled by the user
        selectedTags.forEach(selectedTag => {
          const setting = tags.find(t => t.id == selectedTag.id);
          if (setting) {
            setting.value = selectedTag.value;
          }
        });
      }

      const defaultSettings = {
        disableExtensions: disableExtensionsDuringRun
      };
      const savedSettings = Object.assign(defaultSettings, result[SETTINGS_KEY]);

      resolve({
        selectedTags: tags,
        disableExtensions: savedSettings.disableExtensions
      });
    });
  })
};

window.loadSavedTags = function() {
  return new Promise(resolve => {
    chrome.storage.local.get(STORAGE_KEY, result => {
      const tags = result && result[STORAGE_KEY];
      resolve(Array.isArray(tags) ? tags : []);
    });
  });
};

window.listenForStatus = function(callback) {
  log.events.addListener('status', function(log) {
    latestStatusLog = log;
    callback(log);
  });

  // Show latest saved status log to give immediate feedback
  // when reopening the popup message when lighthouse is running
  if (lighthouseIsRunning && latestStatusLog) {
    callback(latestStatusLog);
  }
};

window.isRunning = function() {
  return lighthouseIsRunning;
};

// Run when in extension context, but not in devtools.
if (window.chrome && chrome.runtime) {
  // Get list of installed extensions that are enabled and can be disabled.
  // Extensions are not allowed to be disabled if they are under an admin policy.
  chrome.management.getAll(installs => {
    chrome.management.getSelf(lighthouseCrxInfo => {
      installedExtensions = installs.filter(info => {
        return info.id !== lighthouseCrxInfo.id && info.type === 'extension' &&
               info.enabled && info.mayDisable;
      });
    });
  });

  chrome.runtime.onInstalled.addListener(details => {
    if (details.previousVersion) {
      // eslint-disable-next-line no-console
      console.log('previousVersion', details.previousVersion);
    }
  });
}

window.getManifest = function() {
  return isExtension && chrome.runtime.getManifest();
};
