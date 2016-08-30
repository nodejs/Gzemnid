'use strict';

const Promise = require('bluebird');
const path = require('path');
const config = require('../config').config;
const { packedIn, promiseEvent } = require('../helpers');
const readline = require('readline');

const extensions = [
  'ts', 'coffee', 'js'
];

async function search(query, languages = null) {
  if (languages && typeof languages === 'string') {
    languages = languages.split(',');
  }
  for (const ext of extensions) {
    if (languages && languages.indexOf(ext) === -1) return;
    const infile = path.join(config.dir, 'out/', `slim.code.${ext}.txt`);
    const stream = packedIn(infile, config.extract.compress);
    const regex = new RegExp(query);
    readline.createInterface({
      input: stream
    }).on('line', line => {
      if (!regex.test(line)) return;
      console.log(line);
    });
    await promiseEvent(stream);
  }
}

module.exports = {
  search
};
