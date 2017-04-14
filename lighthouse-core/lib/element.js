/**
 * @license
 * Copyright 2016 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

class Element {
  // TODO(bckenny): remove driver typing when driver added
  /**
   * @param {{nodeId: string}} element
   * @param {{sendCommand: function(string, !Object): !Promise, getObjectProperty: function(string, string): !Promise<string>}} driver
   */
  constructor(element, driver) {
    if (!element || !driver) {
      throw Error('Driver and element required to create Element');
    }
    /**
     * @const {{sendCommand: function(string, !Object): !Promise, getObjectProperty: function(string, string): !Promise<string>}}
     */
    this.driver = driver;
    /** @const {{nodeId: string}} */
    this.element = element;
  }

  /**
   * @param {!string} name Attribute name
   * @return {!Promise<?string>} The attribute value or null if not found
   */
  getAttribute(name) {
    return this.driver
      .sendCommand('DOM.getAttributes', {
        nodeId: this.element.nodeId
      })
      .then(/** @type {function({attributes: !Array<string>})} */ (resp => {
        // TODO(bckenny): remove when protocol is typed
        // The element attribute names and values are interleaved.
        const attrIndex = resp.attributes.indexOf(name);
        if (attrIndex === -1) {
          return null;
        }

        return resp.attributes[attrIndex + 1];
      }));
  }

  /**
   * @param {!string} propName Property name
   * @return {!Promise<?string>} The property value, or null if not found
   */
  getProperty(propName) {
    return this.driver
      .sendCommand('DOM.resolveNode', {
        nodeId: this.element.nodeId
      })
      .then(resp => {
        // TODO(bckenny): remove when protocol is typed
        return this.driver.getObjectProperty(/** @type {{object: {objectId: string}}} */(resp).object.objectId, propName);
      });
  }
}

module.exports = Element;
