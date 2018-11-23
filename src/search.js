'use strict';
const path = require('path');
const readline = require('readline');
const config = require('./config').config;
const { packedIn, promiseEvent } = require('./helpers');
const Queue = require('./queue');

const extensions = [
  'mjs', 'ts', 'coffee', 'js'
];

const queue = new Queue(3);

async function code(query, languages, callback) {
  const done = await queue.claim();
  if (languages && typeof languages === 'string') {
    languages = languages.split(',');
  }
  for (const ext of extensions) {
    if (languages && languages.indexOf(ext) === -1) continue;
    const infile = path.join(config.dir, 'out/', `slim.code.${ext}.txt`);
    const stream = packedIn(infile, config.extract.compress);
    const regex = new RegExp(query);
    readline.createInterface({
      input: stream
    }).on('line', line => {
      if (!regex.test(line)) return;
      callback(line);
    });
    await promiseEvent(stream);
  }
  done();
}

module.exports = {
  code,
  queue
};
