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
 * Typing externs file for the `chrome-devtools-frontend` module.
 * @externs
 */

/**
 * @const
 */
const WebInspector = {};

/**
 * @constructor
 * @struct
 */
WebInspector.Color = function() {};

/**
 * @param {string} text
 * @return {?WebInspector.Color}
 */
WebInspector.Color.parse = function(text) {};

/**
 * @constructor
 * @struct
 */
WebInspector.NetworkRecord = function() {};
/** @type {string} */
WebInspector.NetworkRecord.prototype.url;
/** @type {string} */
WebInspector.NetworkRecord.prototype._url;
/** @type {!WebInspector.ResourceTiming|undefined} */
WebInspector.NetworkRecord.prototype.timing;
/** @type {!WebInspector.ResourceTiming|undefined} */
WebInspector.NetworkRecord.prototype._timing;


/**
 * @constructor
 * @struct
 */
WebInspector.ResourceTiming = function() {};
/** @type {number} */
WebInspector.ResourceTiming.prototype.receiveHeadersEnd;
/** @type {number} */
WebInspector.ResourceTiming.prototype.sendEnd;

/**
 * @constructor
 * @struct
 */
WebInspector.SCSSParser = function() {};

/**
 * @param {string} content
 * @return {!Gonzales.Node}
 */
WebInspector.SCSSParser.prototype.parse = function(content) {};

/**
 * @const
 */
const Gonzales = {};

/**
 * @constructor
 * @struct
 */
Gonzales.Location = function() {};
/** @type {number} */
Gonzales.Location.prototype.line;
/** @type {number} */
Gonzales.Location.prototype.column;

/**
 * @constructor
 * @struct
 */
Gonzales.TextRange = function() {};
/** @type {number} */
Gonzales.TextRange.prototype.startLine;
/** @type {number} */
Gonzales.TextRange.prototype.startColumn;
/** @type {number} */
Gonzales.TextRange.prototype.endLine;
/** @type {number} */
Gonzales.TextRange.prototype.endColumn;


/**
 * @constructor
 * @struct
 */
Gonzales.Node = function() {};
/** @type {string} */
Gonzales.Node.prototype.type;
/** @type {string} */
Gonzales.Node.prototype.syntax;
/** @type {!Gonzales.Location} */
Gonzales.Node.prototype.start;
/** @type {!Gonzales.Location} */
Gonzales.Node.prototype.end;
/** @type {(string|!Array<!Gonzales.Node>)} */
Gonzales.Node.prototype.content;
/** @type {(!Error|undefined)} */
Gonzales.Node.prototype.error;
/** @type {(!Array<!Gonzales.Node>|undefined)} */
Gonzales.Node.prototype.selectors;
/** @type {!Gonzales.TextRange} */
Gonzales.Node.prototype.declarationRange;

/**
 * @param {string} type
 * @param {function(!Gonzales.Node, number, !Gonzales.Node)} callback
 * @return {!Gonzales.Node}
 */
Gonzales.Node.prototype.traverseByType = function(type, callback) {};
