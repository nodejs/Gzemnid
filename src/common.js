'use strict';

const path = require('path');
const fs = require('./fs');
const { config } = require('./config');
const { jsonLines } = require('./helpers');
const fetch = require('./commands/fetch');

async function listInfo(callback, initial = true) {
  const file = 'byField.info.json';

  try {
    const filepath = path.join(config.dir, file);
    const stats = await fs.stat(filepath);
    console.log(`Package list version: ${new Date(stats.mtime)}.`);
    if (Date.now() - stats.mtime > 24 * 60 * 60 * 1000) {
      console.warn(`
Warning: package list is older than 24 hours!
 Consider running \`gzemnid fetch\` to update it.
      `);
    }
  } catch (e) {
    if (!initial) throw e;
    await fetch.run();
    return await listInfo(callback, false);
  }

  const stream = jsonLines(file);
  let total = 0;
  stream.on('data', info => {
    total++;
    if (total % 50000 === 0) {
      console.log(`Reading: ${total}...`);
    }
    info.scoped = info.name[0] === '@';
    if (info.scoped) return; // FIXME: process scoped packages
    info.id = `${info.name}-${info.version}`;
    callback(info);
  });
  await stream.promise;
  console.log(`Total packages: ${total}.`);
  return total;
}

module.exports = {
  listInfo
};
