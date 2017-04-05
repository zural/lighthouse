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

const ComputedArtifact = require('./computed-artifact');

const screenshotTraceCategory = 'disabled-by-default-devtools.screenshot';

class ScreenshotFilmstrip extends ComputedArtifact {

  get name() {
    return 'Screenshots';
  }

  /**
   * @param {{traceEvents: !Array}} trace
   * @return {!Promise}
  */
  compute_(trace) {
    const events = trace.traceEvents;
    return events
      .filter(e => e.cat.includes(screenshotTraceCategory))
      .map(evt => {
        let datauri;
        if (evt.args && evt.args.snapshot) {
          datauri = 'data:image/jpg;base64,' + evt.args.snapshot;
        }

        return {
          datauri,
          timestamp: evt.ts
        };
      });
  }
}

module.exports = ScreenshotFilmstrip;
