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
'use strict';

/* globals self */

class GroupByTagRenderer {
  constructor(dom, renderAudit) {
    this._dom = dom;
    this._renderAudit = renderAudit;
  }

  _renderTagGroup(audits, tag) {
    if (!tag) {
      tag = {title: 'Miscellaneous', description: 'Random stuff!'};
    }

    const tmpl = this._dom.cloneTemplate('#tmpl-lh-tag-group', this._dom.document());

    const titleEl = tmpl.querySelector('.lh-tag-group__title');
    titleEl.textContent = tag.title;
    const descriptionEl = tmpl.querySelector('.lh-tag-group__description');
    descriptionEl.textContent = tag.description;

    const detailsEl = tmpl.querySelector('.lh-tag-group__details');
    audits.forEach(audit => {
      detailsEl.appendChild(this._renderAudit(audit));
    });
    return tmpl;
  }

  render(audits, tags) {
    const element = this._dom.createElement('div', 'lh-group-by-tag');
    const auditsByTag = new Map();
    audits.forEach(audit => {
      const tagAudits = auditsByTag.get(audit.tag) || [];
      tagAudits.push(audit);
      auditsByTag.set(audit.tag, tagAudits);
    });

    for (const [tagKey, tagAudits] of auditsByTag.entries()) {
      element.appendChild(this._renderTagGroup(tagAudits, tags[tagKey]));
    }

    return element;
  }
}

class GroupByStatusRenderer {
  constructor(dom, renderAudit) {
    this._dom = dom;
    this._renderAudit = renderAudit;
  }

  render(audits) {
    const element = this._dom.createElement('div', 'lh-group-by-status');
    const passedAudits = audits.filter(audit => audit.score === 100);
    const nonPassedAudits = audits.filter(audit => !passedAudits.includes(audit));

    for (const audit of nonPassedAudits) {
      element.appendChild(this._renderAudit(audit));
    }

    // don't create a passed section if there are no passed
    if (!passedAudits.length) return element;

    const passedElem = this._dom.createElement('details', 'lh-passed-audits');
    const passedSummary = this._dom.createElement('summary', 'lh-passed-audits-summary');
    passedSummary.textContent = `View ${passedAudits.length} passed items`;
    passedElem.appendChild(passedSummary);

    for (const audit of passedAudits) {
      passedElem.appendChild(this._renderAudit(audit));
    }
    element.appendChild(passedElem);
    return element;
  }
}

class AuditsRenderer {
  /**
   * @param {!DOM} dom
   * @param {!function(!Object):Element} renderAudit
   */
  constructor(dom, renderAudit) {
    this._dom = dom;
    this._renderAudit = renderAudit;
    this._renderers = {
      GroupByStatus: new GroupByStatusRenderer(dom, renderAudit),
      GroupByTag: new GroupByTagRenderer(dom, renderAudit),
    };
  }

  /**
   * @param {!Array} audits
   * @return {!Element}
   */
  render(audits, tags) {
    const auditGroupsEl = this._dom.createElement('div', 'lh-audits');

    const auditsByRenderer = new Map();
    audits.forEach(audit => {
      console.log(audit);
      const rendererKey = audit.result.renderer || 'GroupByStatus';
      const rendererAudits = auditsByRenderer.get(rendererKey) || [];
      rendererAudits.push(audit);
      auditsByRenderer.set(rendererKey, rendererAudits);
    });

    for (const [rendererKey, rendererAudits] of auditsByRenderer.entries()) {
      const renderer = this._renderers[rendererKey];
      auditGroupsEl.appendChild(renderer.render(rendererAudits, tags));
    }

    return auditGroupsEl;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuditsRenderer;
} else {
  self.AuditsRenderer = AuditsRenderer;
}
