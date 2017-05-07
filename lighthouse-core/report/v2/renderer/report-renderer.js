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

/**
 * @fileoverview The entry point for rendering the Lighthouse report based on the JSON output.
 *    This file is injected into the report HTML along with the JSON report.
 *
 * Dummy text for ensuring report robustness: \u003c/script> pre$`post %%LIGHTHOUSE_JSON%%
 */

/* globals self, Util, Common */
self.Common = {
  UIString: s => s
};

class ReportRenderer {
  /**
   * @param {!DOM} dom
   * @param {!CategoryRenderer} categoryRenderer
   * @param {?ReportUIFeatures=} uiFeatures
   */
  constructor(dom, categoryRenderer, uiFeatures = null) {
    /** @private {!DOM} */
    this._dom = dom;
    /** @private {!CategoryRenderer} */
    this._categoryRenderer = categoryRenderer;
    /** @private {!Document|!Element} */
    this._templateContext = this._dom.document();
    /** @private {ReportUIFeatures} */
    this._uiFeatures = uiFeatures;
  }

  /**
   * @param {!ReportRenderer.ReportJSON} report
   * @param {!Element} container Parent element to render the report into.
   */
  renderReport(report, container) {
    container.textContent = ''; // Remove previous report.
    const element = container.appendChild(this._renderReport(report));
    this._renderPerfTimeline(report, container);

    // Hook in JS features and page-level event listeners after the report
    // is in the document.
    if (this._uiFeatures) {
      this._uiFeatures.initFeatures(report);
    }

    return /** @type {!Element} **/ (element);
  }

  /**
   * Define a custom element for <templates> to be extracted from. For example:
   *     this.setTemplateContext(new DOMParser().parseFromString(htmlStr, 'text/html'))
   * @param {!Document|!Element} context
   */
  setTemplateContext(context) {
    this._templateContext = context;
    this._categoryRenderer.setTemplateContext(context);
  }

  /**
   * @param {!ReportRenderer.ReportJSON} report
   * @return {!DocumentFragment}
   */
  _renderReportHeader(report) {
    const header = this._dom.cloneTemplate('#tmpl-lh-heading', this._templateContext);
    this._dom.find('.lh-config__timestamp', header).textContent =
        Util.formatDateTime(report.generatedTime);
    const url = this._dom.find('.lh-metadata__url', header);
    url.href = report.url;
    url.textContent = report.url;

    this._dom.find('.lh-env__item__ua', header).textContent = report.userAgent;

    const env = this._dom.find('.lh-env__items', header);
    report.runtimeConfig.environment.forEach(runtime => {
      const item = this._dom.cloneTemplate('#tmpl-lh-env__items', env);
      this._dom.find('.lh-env__name', item).textContent = runtime.name;
      this._dom.find('.lh-env__description', item).textContent = runtime.description;
      this._dom.find('.lh-env__enabled', item).textContent =
          runtime.enabled ? 'Enabled' : 'Disabled';
      env.appendChild(item);
    });

    return header;
  }

  /**
   * @param {!ReportRenderer.ReportJSON} report
   * @return {!DocumentFragment}
   */
  _renderReportFooter(report) {
    const footer = this._dom.cloneTemplate('#tmpl-lh-footer', this._templateContext);
    this._dom.find('.lh-footer__version', footer).textContent = report.lighthouseVersion;
    this._dom.find('.lh-footer__timestamp', footer).textContent =
        Util.formatDateTime(report.generatedTime);
    return footer;
  }

  /**
   * @param {!ReportRenderer.ReportJSON} report
   * @return {!DocumentFragment}
   */
  _renderReportNav(report) {
    const leftNav = this._dom.cloneTemplate('#tmpl-lh-leftnav', this._templateContext);

    this._dom.find('.leftnav__header__version', leftNav).textContent =
        `Version: ${report.lighthouseVersion}`;

    const nav = this._dom.find('.lh-leftnav', leftNav);
    for (const category of report.reportCategories) {
      const itemsTmpl = this._dom.cloneTemplate('#tmpl-lh-leftnav__items', leftNav);

      const navItem = this._dom.find('.lh-leftnav__item', itemsTmpl);
      navItem.href = `#${category.id}`;

      this._dom.find('.leftnav-item__category', navItem).textContent = category.name;
      const score = this._dom.find('.leftnav-item__score', navItem);
      score.classList.add(`lh-score__value--${Util.calculateRating(category.score)}`);
      score.textContent = Math.round(Util.formatNumber(category.score));
      nav.appendChild(navItem);
    }
    return leftNav;
  }

  /**
   * @param {!ReportRenderer.ReportJSON} report
   * @return {!Element}
   */
  _renderReport(report) {
    const container = this._dom.createElement('div', 'lh-container');

    container.appendChild(this._renderReportHeader(report)); // sticky header goes at the top.
    container.appendChild(this._renderReportNav(report));

    const reportSection = container.appendChild(this._dom.createElement('div', 'lh-report'));

    const scoreHeader = reportSection.appendChild(
        this._dom.createElement('div', 'lh-scores-header'));

    const categories = reportSection.appendChild(this._dom.createElement('div', 'lh-categories'));
    for (const category of report.reportCategories) {
      scoreHeader.appendChild(this._categoryRenderer.renderScoreGauge(category));
      categories.appendChild(this._categoryRenderer.render(category, report.reportGroups));
    }

    reportSection.appendChild(this._renderReportFooter(report));

    return container;
  }

  _renderPerfTimeline(report, container) {
    const performanceScoreElement = container.querySelector('.lh-category[id=performance] .lh-score');
    const artifacts = report['artifacts'];
    if (!performanceScoreElement || !artifacts)
      return;
    const tracePass = artifacts['traces'] ? artifacts['traces']['defaultPass'] : null;
    if (!tracePass)
      return;

    const fmp = report['audits']['first-meaningful-paint'];
    if (!fmp || !fmp['extendedInfo'])
      return;

    const tti = report['audits']['time-to-interactive'];
    if (!tti || !tti['extendedInfo'])
      return;

    const navStart = fmp['extendedInfo']['value']['timestamps']['navStart'];
    const markers = [
      {
        title: 'First contentful paint',
        value: (fmp['extendedInfo']['value']['timestamps']['fCP'] - navStart) / 1000
      },
      {
        title: 'First meaningful paint',
        value: (fmp['extendedInfo']['value']['timestamps']['fMP'] - navStart) / 1000
      },
      {
        title: 'Time to interactive',
        value: (tti['extendedInfo']['value']['timestamps']['timeToInteractive'] - navStart) / 1000
      },
      {
        title: 'Visually ready',
        value: (tti['extendedInfo']['value']['timestamps']['visuallyReady'] - navStart) / 1000
      }
    ];

    const timeSpan = Math.max(...markers.map(marker => marker.value));
    const screenshots = tracePass.traceEvents.filter(e => e.cat === 'disabled-by-default-devtools.screenshot');
    const timelineElement = this._dom.createElement('div', 'lh-timeline');
    const filmStripElement = this._dom.createChildOf(timelineElement, 'div', 'lh-filmstrip');

    const numberOfFrames = 8;
    const roundToMs = 100;
    const timeStep = (Math.ceil(timeSpan / numberOfFrames / roundToMs)) * roundToMs;

    for (let time = 0; time < timeSpan; time += timeStep) {
      let frameForTime = null;
      for (const e of screenshots) {
        if ((e.ts - navStart) / 1000 < time + timeStep)
          frameForTime = e.args.snapshot;
      }
      const frame = this._dom.createChildOf(filmStripElement, 'div', 'frame');
      this._dom.createChildOf(frame, 'div', 'time').textContent = (time + timeStep);

      const thumbnail = this._dom.createChildOf(frame, 'div', 'thumbnail');
      if (frameForTime) {
        const img = this._dom.createChildOf(thumbnail, 'img');
        img.src = 'data:image/jpg;base64,' + frameForTime;
      }
    }

    for (const marker of markers) {
      const markerElement = this._dom.createChildOf(timelineElement, 'div', 'lh-timeline-marker');
      this._dom.createChildOf(markerElement, 'div', 'lh-timeline-bar').style.width =
          (100 * (marker.value / timeSpan) | 0) + '%';
      this._dom.createChildOf(markerElement, 'span').textContent = `${marker.title}: `;
      this._dom.createChildOf(markerElement, 'span', 'lh-timeline-subtitle').textContent = (marker.value);
    }

    performanceScoreElement.parentElement.insertBefore(timelineElement, performanceScoreElement.nextSibling);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReportRenderer;
} else {
  self.ReportRenderer = ReportRenderer;
}

/**
 * @typedef {{
 *     id: string,
 *     weight: number,
 *     score: number,
 *     group: string,
 *     result: {
 *       rawValue: (number|undefined),
 *       description: string,
 *       informative: boolean,
 *       debugString: string,
 *       displayValue: string,
 *       helpText: string,
 *       score: (number|boolean),
 *       scoringMode: string,
 *       optimalValue: number,
 *       extendedInfo: Object,
 *       details: (!DetailsRenderer.DetailsJSON|undefined)
 *     }
 * }}
 */
ReportRenderer.AuditJSON; // eslint-disable-line no-unused-expressions

/**
 * @typedef {{
 *     name: string,
 *     id: string,
 *     weight: number,
 *     score: number,
 *     description: string,
 *     audits: !Array<!ReportRenderer.AuditJSON>
 * }}
 */
ReportRenderer.CategoryJSON; // eslint-disable-line no-unused-expressions

/**
 * @typedef {{
 *     title: string,
 *     description: string,
 * }}
 */
ReportRenderer.GroupJSON; // eslint-disable-line no-unused-expressions

/**
 * @typedef {{
 *     lighthouseVersion: string,
 *     userAgent: string,
 *     generatedTime: string,
 *     initialUrl: string,
 *     url: string,
 *     artifacts: {traces: !Object},
 *     reportCategories: !Array<!ReportRenderer.CategoryJSON>,
 *     reportGroups: !Object<string, !ReportRenderer.GroupJSON>,
 *     runtimeConfig: {
 *       blockedUrlPatterns: !Array<string>,
 *       environment: !Array<{description: string, enabled: boolean, name: string}>
 *     }
 * }}
 */
ReportRenderer.ReportJSON; // eslint-disable-line no-unused-expressions

