'use strict';

const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
const { config } = require('./config');
const { jsonStream } = require('./helpers');
const fetch = require('./commands/fetch');

async function listInfo(callback, initial = true) {
  const file = 'byField.info.json';

  try {
    const filepath = path.join(config.dir, file);
    const stats = await fs.statAsync(filepath);
    console.log(`Package list version: ${new Date(stats.mtime)}.`);
  } catch (e) {
    if (!initial) throw e;
    await fetch.run();
    return await listInfo(callback, false);
  }

  const stream = jsonStream(file);
  let total = 0;
  stream.on('data', info => {
    total++;
    if (total % 50000 === 0) {
      console.log(`Reading: ${total}...`);
    }
    callback(info);
  });
  await stream.promise;
  console.log(`Total packages: ${total}.`);
  return total;
}

module.exports = {
  listInfo
};
