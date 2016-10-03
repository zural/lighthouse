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

/**
 * @fileoverview Gathers a page's styles.
 */

'use strict';

const Gatherer = require('./gatherer');

// const MAX_WAIT_TIMEOUT = 1000;

class Styles extends Gatherer {

  constructor() {
    super();
    this._styleHeaders = [];
    this._styleBodies = [];
    this._onStyleSheetAdded = this.onStyleSheetAdded.bind(this);

  }

  onStyleSheetAdded(stylesheet) {
    this._styleHeaders.push(stylesheet);

    // Remove stylesheets "injected" by extension or added in the "inspector".
    if (stylesheet.header.origin !== 'regular') return;

    const p = this.driver.sendCommand('CSS.getStyleSheetText', {
      styleSheetId: stylesheet.header.styleSheetId
    });
    this._styleBodies.push(p);
  }

  beginStylesCollect(opts) {
    // return new Promise((resolve, reject) => {
    //   return opts.driver.sendCommand('DOM.enable')
    //       .then(opts.driver.sendCommand('CSS.enable'))
    //       .then(_ => {
    //         opts.driver.on('CSS.styleSheetAdded', this._onStyleSheetAdded);
    //       })
    //       .catch(reject);
    // });
    this.driver = opts.driver;
    opts.driver.sendCommand('DOM.enable');
    opts.driver.sendCommand('CSS.enable');
    opts.driver.on('CSS.styleSheetAdded', this._onStyleSheetAdded);
  }

  endStylesCollect(opts) {
    return new Promise((resolve, reject) => {

      opts.driver.off('CSS.styleSheetAdded', this._onStyleSheetAdded);
      return Promise.all(this._styleBodies).then(results => {
  console.log(results);
        opts.driver.sendCommand('CSS.disable').then(_ => {
          resolve(results);
        }, reject);
      }, reject).catch(reject);
    });
  }

  beforePass(options) {
    this.beginStylesCollect(options);
  }

  afterPass(options) {
    return this.endStylesCollect(options)
      .then(stylesheets => {
        this.artifact = stylesheets;
      }, _ => {
        this.artifact = -1;
        return;
      });
  }
}

module.exports = Styles;
