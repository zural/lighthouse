/**
 * @license Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const ComputedArtifact = require('./computed-artifact');

class RequestChains extends ComputedArtifact {

  get name() {
    return 'RequestChains';
  }

  /**
   * @param {!WebInspector.NetworkRequest} record
   * @return {!CriticalRequestChainRenderer.CRCRequest}
   */
  static flattenRecord(record) {
    return {
      requestId: record.requestId,
      url: record._url,
      startTime: record.startTime,
      endTime: record.endTime,
      responseReceivedTime: record.responseReceivedTime,
      transferSize: record.transferSize
    };
  }

  /**
   * Links together network requests (filtered by predicate) with their initiator, building a DAG.
   * When the predicate function returns false for a network request, that request and all of its children
   * will be excluded from the graph. If no predicate is provided, all requests are included.
   *
   * @param {!Array<!WebInspector.NetworkRequest>} networkRecords
   * @param {function(!WebInspector.NetworkRequest):boolean=} predicate
   * @return {{request: !Object, children: !Object}}
   */
  static extractChain(networkRecords, predicate) {
    predicate = predicate || (() => true);
    networkRecords = networkRecords.filter(req => req.finished);

    // Build a map of requestID -> Node.
    const requestIdToRequests = new Map();
    for (const request of networkRecords) {
      requestIdToRequests.set(request.requestId, request);
    }

    const requestsToExamine = networkRecords.filter(predicate);

    // Create a tree of critical requests.
    const requestChains = {};
    for (const request of requestsToExamine) {
      // Work back from this request up to the root. If by some weird quirk we are giving request D
      // here, which has ancestors C, B and A (where A is the root), we will build array [C, B, A]
      // during this phase.
      const ancestors = [];
      let ancestorRequest = request.initiatorRequest();
      let node = requestChains;
      while (ancestorRequest) {
        // If the parent request doesn't match the predicate it won't be in requestIdToRequests,
        // and so we can break the chain here. We should also break it if we've seen this request
        // before because this is some kind of circular reference, and that's bad.
        if (!predicate(ancestorRequest) || ancestors.includes(ancestorRequest.requestId)) {
          // Set the ancestors to an empty array and unset node so that we don't add
          // the request in to the tree.
          ancestors.length = 0;
          node = undefined;
          break;
        }
        ancestors.push(ancestorRequest.requestId);
        ancestorRequest = ancestorRequest.initiatorRequest();
      }

      // With the above array we can work from back to front, i.e. A, B, C, and during this process
      // we can build out the tree for any nodes that have yet to be created.
      let ancestor = ancestors.pop();
      while (ancestor) {
        const parentRequest = requestIdToRequests.get(ancestor);
        const parentRequestId = parentRequest.requestId;
        if (!node[parentRequestId]) {
          node[parentRequestId] = {
            request: RequestChains.flattenRecord(parentRequest),
            children: {}
          };
        }

        // Step to the next iteration.
        ancestor = ancestors.pop();
        node = node[parentRequestId].children;
      }

      if (!node) {
        continue;
      }

      // If the node already exists, bail.
      if (node[request.requestId]) {
        continue;
      }

      // node should now point to the immediate parent for this request.
      node[request.requestId] = {
        request: RequestChains.flattenRecord(request),
        children: {}
      };
    }

    return requestChains;
  }

  /**
   * @param {!DevtoolsLog} devtoolsLog
   * @param {!ComputedArtifacts} artifacts
   * @return {!Promise<!CriticalRequestChainRenderer.RequestNode>}
   */
  compute_(devtoolsLog, artifacts) {
    return artifacts.requestNetworkRecords(devtoolsLog)
      .then(RequestChains.extractChain);
  }
}

module.exports = RequestChains;
