'use strict';

const path = require('path');
const fs = require('../fs');
const config = require('../config').config;
const common = require('../common');
const { toMap, fetch, promiseEvent, packedOut } = require('../helpers');

async function downloadOne(url, file) {
  console.log(`Downloading: ${file}...`);
  const out = path.join(config.dir, 'meta/', file);
  const tmp = `${out}.tmp`;
  const response = (await fetch(url)).body;
  const write = packedOut(tmp, config.meta.compress);
  const suffix = config.meta.compress ? '.lz4' : '';
  response.pipe(write);
  await promiseEvent(write, 'close');
  await fs.rename(`${tmp}${suffix}`, `${out}${suffix}`);
}

async function run() {
  await fs.mkdirp(path.join(config.dir, 'meta/'));
  console.log('Reading meta directory...');
  const current = await fs.readdir(path.join(config.dir, 'meta/'));
  const map = toMap(current);
  const suffix = config.meta.compress ? '.lz4' : '';

  const queue = [];
  await common.listInfo(info => {
    if (!info.tar) {
      console.log(`${info.id}: no tar!`);
      return;
    }

    const url = `https://registry.npmjs.org/${info.name}`;
    const file = `${info.id}.json${suffix}`;
    if (!map.has(file)) {
      queue.push([url, `${info.id}.json`]);
    }

    map.set(file, true);
  });

  const needed = queue.length;
  console.log(`To download: ${needed}.`);
  let updated = 0;
  while (queue.length > 0) {
    const block = queue.splice(0, 10);
    await Promise.all(block.map(args => downloadOne(...args)));
    updated += block.length;
    if (updated % 100 < block.length) {
      console.log(`Downloaded: ${updated}/${needed}...`);
    }
  }
  console.log(`New/updated: ${updated}.`);

  let moved = 0;
  for (const [file, keep] of map) {
    if (keep) continue;
    if (moved === 0) {
      await fs.mkdirp(path.join(config.dir, 'meta.old/'));
    }
    await fs.rename(
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
