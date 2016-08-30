'use strict';

const Promise = require('bluebird');
const path = require('path');
const config = require('../config').config;
const { packedIn, promiseEvent } = require('../helpers');
const readline = require('readline');

const extensions = [
  //'.php', '.json', '.txt',
  '.ts', '.coffee', '.js'
];

async function search(query, ext) {
  if (!ext) {
    for (const entry of extensions) {
      await search(query, entry);
    }
    return;
  }
  const infile = path.join(config.dir, 'out/', `slim.code${ext}.txt`);
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

module.exports = {
  search
};
