'use strict';

const path = require('path');
const fs = require('./fs');

const config = {};
const basedir = path.join(__dirname, '../');

function configMerge(a, b) {
  for (const prop of Object.keys(b)) {
    if (b[prop] && typeof b[prop] === 'object' && !Array.isArray(b[prop])) {
      if (!a.hasOwnProperty(prop) || typeof a[prop] !== 'object') {
        a[prop] = {};
      }
      configMerge(a[prop], b[prop]);
    } else {
      a[prop] = b[prop];
    }
  }
}

async function read(filepath) {
  return await fs.readFile(path.join(basedir, filepath), 'utf8')
    .catch(() => 'null')
    .then(JSON.parse);
}

async function load() {
  const global = await read('config.json');
  const local = await read('config.local.json');
  if (!global) throw new Error('No config.json found!');
  configMerge(config, global);
  if (local) configMerge(config, local);
  config.basedir = basedir;
}

module.exports = {
  config,
  load
};
