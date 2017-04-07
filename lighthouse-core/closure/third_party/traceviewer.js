/**
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

/**
 * Typing externs file for the `third_party/traceviewer-js` module.
 * @externs
 */

/**
 * @const
 */
var tr = {};

global.tr = tr;

/** @const */
tr.b = {};

/** @const */
tr.model = {};

/**
 * @constructor
 * @struct
 */
tr.model.helper = function() {};

/** @const */
tr.model.mainThread = {};

/** @const */
tr.model.mainThread.sliceGroup = {};

/** @type {!Array<{start: number, end: number}>} */
tr.model.mainThread.sliceGroup.topLevelSlices;

/** @const */
tr.model.helpers = {};

/** @type {!tr.model.helper} */
tr.model.helpers.ChromeModelHelper;

/** @const */
tr.modelHelper = {};

/** @type {!tr.model.helpers} */
tr.modelHelper.rendererHelpers;

/** @const */
tr.importer = {};

/**
 * @constructor
 * @struct
 */
tr.Model = function() {};

/**
 * @param {!tr.model.helper} helper
 * @return {!tr.modelHelper}
 */
tr.Model.prototype.getOrCreateHelper = function(helper) {};

/** @type {{min: number, max: number}} */
tr.Model.prototype.bounds = {};

/**
 * @constructor
 * @struct
 */
tr.importer.ImportOptions = function() {};
/** @type {boolean} */
tr.importer.ImportOptions.prototype.showImportWarnings;
/** @type {boolean} */
tr.importer.ImportOptions.prototype.pruneEmptyContainers;
/** @type {boolean} */
tr.importer.ImportOptions.prototype.shiftWorldToZero;

/**
 * @param {!tr.Model} model
 * @param {!tr.importer.ImportOptions} io
 * @constructor
 * @struct
 */
tr.importer.Import = function(model, io) {};

/**
 * @param {!Array<!Trace>} traces
 */
tr.importer.Import.prototype.importTraces = function(traces) {};

/**
 * @param {!Object<string, T>} obj
 * @return {!Array<T>}
 * @template T
 */
tr.b.dictionaryValues = function(obj) {};

/** @const */
tr.b.Statistics = {};

/**
 * @param {number} location
 * @param {number} shape
 * @constructor
 * @struct
 */
tr.b.Statistics.LogNormalDistribution = function(location, shape) {};

/**
 * A complementary percentile is the probability that a sample from the
 * distribution is greater than the given value |x|. This function is
 * monotonically decreasing.
 * @param {number} x A value from the random distribution.
 * @return {number} P(X>x).
 */
tr.b.Statistics.LogNormalDistribution.prototype.computeComplementaryPercentile = function(x) {};
