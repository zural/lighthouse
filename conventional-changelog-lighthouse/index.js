'use strict';
const readFileSync = require('fs').readFileSync;
const resolve = require('path').resolve;

const parserOpts = {
  headerPattern: /^(\w*)(?:\((.*)\))?: (.*)$/,
  headerCorrespondence: [
    'type',
    'scope',
    'message',
  ],
};

const writerOpts = {
  transform: commit => {
    if (typeof commit.hash === 'string') {
      commit.hash = commit.hash.substring(0, 7);
    }

    if (commit.type === 'test') {
      commit.type = 'tests';
    }

    if (commit.type) {
      commit.type = commit.type.replace(/_/g, ' ');
      commit.type = commit.type.substring(0, 1).toUpperCase() + commit.type.substring(1);
    } else {
      commit.type = 'Misc';
    }

    return commit;
  },
  groupBy: 'type',
  commitGroupsSort: (a, b) => {
    // put new audit on the top
    if (b.title === 'New audit') {
      return 1;
    }

    return a.title.localeCompare(b.title);
  },
  commitsSort: ['type', 'scope', 'message'],
};

const template = readFileSync(resolve(__dirname, 'templates/template.hbs')).toString();
const header = readFileSync(resolve(__dirname, 'templates/header.hbs')).toString();
const commit = readFileSync(resolve(__dirname, 'templates/commit.hbs')).toString();
writerOpts.mainTemplate = template;
writerOpts.headerPartial = header;
writerOpts.commitPartial = commit;

module.exports = {
  writerOpts,
  parserOpts,
};
