'use strict';

const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
const bhttp = require('bhttp');
const config = require('../config').config;
const common = require('../common');
const { toMap, mkdirpAsync, promiseEvent } = require('../helpers');

const session = bhttp.session({
  headers: {
    'user-agent': config.useragent || 'Gzemnid'
  }
});

async function downloadOne(url, file) {
  console.log(`Downloading: ${file}...`);
  const out = path.join(config.dir, 'meta/', file);
  const tmp = `${out}.tmp`;
  const response = await session.get(url, { stream: true });
  const write = fs.createWriteStream(tmp);
  response.pipe(write);
  await promiseEvent(write, 'finish');
  await fs.renameAsync(tmp, out);
}

async function run() {
  await mkdirpAsync(path.join(config.dir, 'meta/'));
  console.log('Reading meta directory...');
  const current = await fs.readdirAsync(path.join(config.dir, 'meta/'));
  const map = toMap(current);

  const queue = [];
  await common.listInfo(info => {
    if (!info.tar) {
      console.log(`${info.id}: no tar!`);
      return;
    }

    const url = `https://registry.npmjs.org/${info.name}`;
    const file = `${info.id}.json`;
    if (!map.has(file)) {
      queue.push([url, file]);
    }

    map.set(file, true);
  });

  console.log(`To download: ${queue.length}.`);
  let updated = 0;
  while (queue.length > 0) {
    const block = queue.splice(0, 10);
    await Promise.all(block.map(args => downloadOne(...args)));
    updated += block.length;
    if (updated % 100 < block.length) {
      console.log(`Downloaded: ${updated}/${queue.length}...`);
    }
  }
  console.log(`New/updated: ${updated}.`);

  let moved = 0;
  for (const [file, keep] of map) {
    if (keep) continue;
    if (moved === 0) {
      await mkdirpAsync(path.join(config.dir, 'meta.old/'));
    }
    await fs.renameAsync(
      path.join(config.dir, 'meta/', file),
      path.join(config.dir, 'meta.old/', file)
    );
    moved++;
  }
  console.log(`Moved: ${moved}.`);

  console.log('END');
}

module.exports = {
  run
};
