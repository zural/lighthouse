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
 * Typing externs file for ImageUsage artifact.
 * @see gather/gatherers/image-usage.js
 * @externs
 */

/**
 * @struct
 * @record
 */
function ImageUsageArtifact() {}

/** @type {!ImageUsageNetworkRecord} */
ImageUsageArtifact.prototype.networkRecord;

/** @type {string} */
ImageUsageArtifact.prototype.src;

/** @type {number} */
ImageUsageArtifact.prototype.clientWidth;

/** @type {number} */
ImageUsageArtifact.prototype.clientHeight;

/** @type {number} */
ImageUsageArtifact.prototype.naturalWidth;

/** @type {number} */
ImageUsageArtifact.prototype.naturalHeight;

/** @type {boolean} */
ImageUsageArtifact.prototype.isPicture;

/** @type {!ImageUsageClientRect} */
ImageUsageArtifact.prototype.clientRect;

/**
 * @struct
 * @record
 */
function ImageUsageNetworkRecord() {}

/** @type {string} */
ImageUsageNetworkRecord.prototype.url;

/** @type {number} */
ImageUsageNetworkRecord.prototype.resourceSize;

/** @type {number} */
ImageUsageNetworkRecord.prototype.startTime;

/** @type {number} */
ImageUsageNetworkRecord.prototype.endTime;

/** @type {number} */
ImageUsageNetworkRecord.prototype.responseReceivedTime;

/** @type {string} */
ImageUsageNetworkRecord.prototype.mimeType;

/**
 * @struct
 * @record
 */
function ImageUsageClientRect() {}

/** @type {number} */
ImageUsageClientRect.prototype.top;

/** @type {number} */
ImageUsageClientRect.prototype.bottom;

/** @type {number} */
ImageUsageClientRect.prototype.left;

/** @type {number} */
ImageUsageClientRect.prototype.right;
