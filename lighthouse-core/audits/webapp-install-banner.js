/**
 * @license Copyright 2016 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

'use strict';

const Audit = require('./audit');

const manifestExists = require('./manifest-exists');
const manifestDisplayA2HS = require('./manifest-display-a2hs');
const manifestStartUrl = require('./manifest-start-url');
const manifestIconsMin144 = require('./manifest-icons-min-144');
const manifestShortName = require('./manifest-short-name');
const serviceWorker = require('./service-worker');


// https://github.com/GoogleChrome/lighthouse/issues/23#issuecomment-270453303

// Requirements:
// * manifest is not empty
// * manifest has valid start url
// * manifest has a valid name and valid shortname
// * manifest display property is either standalone or fullscreen
// * manifest contains icon that's a png and size >= 144px
// * SW is registered, and it owns this page and the manifest's start url
// * Site engagement score of 2 or higher

// Our audit is a little softer in its tests so far.
// It doesn't look at standalone/fullscreen and doesn't consider SW controlling the starturl.
// Also obviously we don't look at site engagement.

class WebappInstallBanner extends Audit {
  /**
   * @return {!AuditMeta}
   */
  static get meta() {
    return {
      category: 'PWA',
      name: 'webapp-install-banner',
      description: 'User can be prompted to Add to Homescreen',
      helpText: 'While users can manually add your site to their homescreen, the [prompt (aka app install banner)](https://developers.google.com/web/updates/2015/03/increasing-engagement-with-app-install-banners-in-chrome-for-android) will proactively prompt the user to install the app if the various requirements are met and the user has moderate engagement with your site.',
      requiredArtifacts: ['Manifest', 'ServiceWorker']
    };
  }

  /**
   * @param {!Artifacts} artifacts
   * @return {!AuditResult}
   */
  static audit(artifacts) {
    if (!artifacts.Manifest || !artifacts.Manifest.value) {
      // Page has no manifest or was invalid JSON.
      return WebappInstallBanner.generateAuditResult({
        rawValue: false,
        debugString: 'Page has no manifest or manifest was invalid JSON'
      });
    }

    // depend on our 5 requirements
    const subResults = [
      manifestExists,
      manifestDisplayA2HS,
      manifestStartUrl,
      manifestIconsMin144,
      manifestShortName,
      serviceWorker
    ].map(aud => ({
      result: aud.audit(artifacts),
      meta: aud.meta
    }));

    const failingAudits = subResults.filter(aud => aud.result.rawValue === false);
    const debugStrings = failingAudits.map(aud => aud.result.debugString).filter(Boolean);

    const rawValue = failingAudits.length === 0;
    let debugString;
    if (rawValue === false) {
      const failingDescriptions = failingAudits.map(aud => {
        const debugString = aud.result.debugString;
        return aud.meta.description + (debugString ? ` (${debugString})` : '');
      }).join(', ');
      debugString = `Unsatisfied requirements: ${failingDescriptions}.`;
    }

    console.log('ok', {
      debugStrings,
      debugString,
      failingAudits
    });
    return WebappInstallBanner.generateAuditResult({
      rawValue,
      debugString
    });
  }
}

module.exports = WebappInstallBanner;
