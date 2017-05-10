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

/* eslint-disable no-console */

const path = require('path');
const parseURL = require('url').parse;

const mkdirp = require('mkdirp');

const constants = require('./constants.js');
const utils = require('./utils.js');
const config = require('../lighthouse-core/config/default.js');
const lighthouse = require('../lighthouse-core/index.js');
const ChromeLauncher = require('../chrome-launcher/chrome-launcher.js');
const Printer = require('../lighthouse-cli/printer');
const assetSaver = require('../lighthouse-core/lib/asset-saver.js');

const NUMBER_OF_RUNS = 30;

const URLS = require('./pwa-sites.js');

function delay(time) {
  return _ => new Promise(resolve => setTimeout(resolve, time));
}

/**
 * Launches Chrome once at the beginning, runs all the analysis,
 * and then kills Chrome.
 * TODO(chenwilliam): measure the overhead of starting chrome, if it's minimal
 * then open a fresh Chrome instance for each run.
 */
function main() {
  if (utils.isDir(constants.OUT_PATH)) {
    console.log('ERROR: Found output from previous run at: ', constants.OUT_PATH);
    console.log('Please run: npm run clean');
    return;
  }

  return runAnalysis();
}

main();

/**
 * Returns a promise chain that analyzes all the sites n times.
 * @return {!Promise}
 */
function runAnalysis() {
  let promise = Promise.resolve();

  // Running it n + 1 times because the first run is deliberately ignored
  // because it has different perf characteristics from subsequent runs
  // (e.g. DNS cache which can't be easily reset between runs)
  for (let i = 0; i <= NUMBER_OF_RUNS; i++) {
    // Averages out any order-dependent effects such as memory pressure
    utils.shuffle(URLS);

    const id = i.toString();
    const isFirstRun = i === 0;
    for (const url of URLS) {
      promise = promise.then(() => {
        return ChromeLauncher.launch({port: 9222}).then(launcher => {
          return singleRunAnalysis(url, id, {ignoreRun: isFirstRun})
            .catch(err => console.error(err))
            .then(() => launcher.kill());
        }).then(delay(3000));
      });
    }
  }

  return promise;
}

/**
 * Analyzes a site a single time using lighthouse.
 * @param {string} url
 * @param {string} id
 * @param {{ignoreRun: boolean}} options
 * @return {!Promise}
 */
function singleRunAnalysis(url, id, {ignoreRun}) {
  console.log('Measuring site:', url, 'run:', id);
  const parsedURL = parseURL(url);
  const urlBasedFilename = sanitizeURL(`${parsedURL.host}-${parsedURL.pathname}`);
  const runPath = path.resolve(constants.OUT_PATH, urlBasedFilename, id);
  if (!ignoreRun) {
    mkdirp.sync(runPath);
  }
  const outputPath = path.resolve(runPath, constants.LIGHTHOUSE_RESULTS_FILENAME);
  const assetsPath = path.resolve(runPath, 'assets');
  return analyzeWithLighthouse(url, outputPath, assetsPath, {ignoreRun});
}

/**
 * Runs lighthouse and save the artifacts (not used directly by plots,
 * but may be helpful for debugging outlier runs).
 * @param {string} url
 * @param {string} outputPath
 * @param {string} assetsPath
 * @param {{ignoreRun: boolean}} options
 * @return {!Promise}
 */
function analyzeWithLighthouse(url, outputPath, assetsPath, {ignoreRun}) {
  const flags = {
    output: 'json',
    logLevel: 'info'
  };
  return lighthouse(url, flags, config)
    .then(lighthouseResults => {
      if (ignoreRun) {
        console.log('First load of site. Results not being saved to disk.');
        return;
      }
      return assetSaver
        .saveAssets(lighthouseResults.artifacts, lighthouseResults.audits, assetsPath)
        .then(() => {
          lighthouseResults.artifacts = undefined;
          return Printer.write(lighthouseResults, flags.output, outputPath);
        });
    })
    .catch(err => console.error(err));
}

/**
 * Converts a URL into a filename-friendly string
 * @param {string} string
 * @return {string}
 */
function sanitizeURL(string) {
  const illegalRe = /[\/\?<>\\:\*\|":]/g;
  const controlRe = /[\x00-\x1f\x80-\x9f]/g; // eslint-disable-line no-control-regex
  const reservedRe = /^\.+$/;

  return string
    .replace(illegalRe, '.')
    .replace(controlRe, '\u2022')
    .replace(reservedRe, '')
    .replace(/\s+/g, '_');
}
