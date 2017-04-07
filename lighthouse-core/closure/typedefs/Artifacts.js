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
 * Typing externs file for collected output of the artifact gatherers stage.
 * @externs
 */

/** @typedef
  {!Array<{
    failed: (boolean|undefined),
    originalSize: number,
    isSameOrigin: boolean,
    webpSize: number
  }>} */
let OptimizedImagesArtifact;

/** @typedef
  {{
    property: {name: string, val: string},
    declarationRange: !Gonzales.TextRange,
    selector: string
  }} */
let StylesArtifactParsedContent;

/** @typedef
  {!Array<{
    content: string,
    parsedContent: !Array<!StylesArtifactParsedContent>,
    isDuplicate: (boolean|undefined),
    header: {
      styleSheetId: string,
      sourceURL: string
    }
  }>} */
let StylesArtifact;

/** @typedef
  {!Array<{
    isDuplicate: boolean,
    objectName: string,
    line: number,
    col: number
  }>} */
let EventListenersArtifact;

/** @typedef
  {!Array<{
    entry: {
      source: string,
      text: string,
      url: string,
      lineNumber: number
    }
  }>} */
let ChromeConsoleMessagesArtifact;

/** @typedef {{url: string, line: number, col: number}} */
let FunctionUsageInfo;

/** @typedef
  {{
    processEvents: !Array<!TraceEvent>,
    startedInPageEvt: !TraceEvent,
    navigationStartEvt: !TraceEvent,
    firstPaintEvt: TraceEvent,
    firstContentfulPaintEvt: TraceEvent,
    firstMeaningfulPaintEvt: TraceEvent
  }} */
let TraceOfTabArtifact;

/**
 * @struct
 * @record
 */
function Artifacts() {}

/** @type {string} */
Artifacts.prototype.HTML;

/** @type {{value: (string|number)}} */
Artifacts.prototype.HTMLWithoutJavaScript;

/** @type {boolean} */
Artifacts.prototype.HTTPS;

/** @type {!Object<string, !Trace>} */
Artifacts.prototype.traces;

/** @type {!Object<string, !Array<!WebInspector.NetworkRecord>>} */
Artifacts.prototype.networkRecords;

/** @type {ManifestNode<(!Manifest|undefined)>} */
Artifacts.prototype.Manifest;

/** @type {!ServiceWorkerArtifact} */
Artifacts.prototype.ServiceWorker;

/** @type {?string} */
Artifacts.prototype.ThemeColor;

/** @type {{initialUrl: string, finalUrl: string}} */
Artifacts.prototype.URL;

/** @type {?string} */
Artifacts.prototype.Viewport;

/** @type {number} */
Artifacts.prototype.Offline;

/** @type {{value: boolean}} */
Artifacts.prototype.HTTPRedirect;

/** @type {!Accessibility} */
Artifacts.prototype.Accessibility;

/** @type {!Array<!Object>} */
Artifacts.prototype.ScreenshotFilmstrip;

/** @type {!Object<!Object>} */
Artifacts.prototype.CriticalRequestChains;

/** @type {{innerWidth: number, innerHeight: number, outerWidth: number}} */
Artifacts.prototype.ViewportDimensions;

/** @type {!Array<string>} */
Artifacts.prototype.CacheContents;

/** @type {!Array<!FunctionUsageInfo>} */
Artifacts.prototype.GeolocationOnStart;

/** @type {!Array<!ImageUsageArtifact>} */
Artifacts.prototype.ImageUsage;

/** @type {?{id: string, domain: string, name: string, version: string}} */
Artifacts.prototype.WebSQL;

/** @type {{totalDOMNodes: number, depth: {max: number, pathToElement: !Array<string>}, width: {max: number, pathToElement: !Array<string>}}} */
Artifacts.prototype.DOMStats;

/** @type {!OptimizedImagesArtifact} */
Artifacts.prototype.OptimizedImages;

/** @type {!StylesArtifact} */
Artifacts.prototype.Styles;

/** @type {!EventListenersArtifact} */
Artifacts.prototype.EventListeners;

/** @type {?string} */
Artifacts.prototype.AppCacheManifest;

/** @type {!ChromeConsoleMessagesArtifact} */
Artifacts.prototype.ChromeConsoleMessages;

/** @type {!Array<!FunctionUsageInfo>} */
Artifacts.prototype.ConsoleTimeUsage;

/** @type {!Array<!FunctionUsageInfo>} */
Artifacts.prototype.DateNowUse;

/** @type {!Array<!FunctionUsageInfo>} */
Artifacts.prototype.DocWriteUse;

/** @type {!Array<!FunctionUsageInfo>} */
Artifacts.prototype.NotificationOnStart;

/** @type {!Array<{href: string, rel: string, target: string}>} */
Artifacts.prototype.AnchorsWithNoRelNoopener;

/** @type {!Array<{tag: string, transferSize: number, startTime: number, endTime: number}>} */
Artifacts.prototype.TagsBlockingFirstPaint;

// Computed artifacts

/** @type {function(!Array): !Promise<!Object>} */
Artifacts.prototype.requestCriticalRequestChains;

/** @type {function(ManifestNode<(!Manifest|undefined)>): !Promise<{isParseFailure: boolean, parseFailureReason: string, allChecks: !Array<{passing: boolean, failureText: string}>}>} */
Artifacts.prototype.requestManifestValues;

/** @type {function(!Array): !Promise<number>} */
Artifacts.prototype.requestNetworkThroughput;

// Artifacts.prototype.requestPushedRequests;

// Artifacts.prototype.requestScreenshots;

/** @type {function(!Trace): !Promise<!SpeedlineArtifact>} */
Artifacts.prototype.requestSpeedline;

/** @type {function(!Trace): !Promise<!TraceOfTabArtifact>} */
Artifacts.prototype.requestTraceOfTab;

/** @type {function(!Trace): !Promise<!tr.Model>} */
Artifacts.prototype.requestTracingModel;

