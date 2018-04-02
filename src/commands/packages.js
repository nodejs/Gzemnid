'use strict';

const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
const config = require('../config').config;
const common = require('../common');
const { readlines, toMap, mkdirpAsync, fetch, promiseEvent } = require('../helpers');

async function downloadOne(url, file) {
  console.log(`Downloading: ${file}...`);
  const out = path.join(config.dir, 'current/', file);
  const tmp = `${out}.tmp`;
  const response = (await fetch(url)).body;
  const write = fs.createWriteStream(tmp);
  response.pipe(write);
  await promiseEvent(write, 'finish');
  await fs.renameAsync(tmp, out);
}

async function run() {
  await mkdirpAsync(path.join(config.dir, 'current/'));

  const broken = new Set(await readlines(path.join(config.basedir, 'data/brokenurls.txt')));
  const blacklist = new Set(await readlines(path.join(config.basedir, 'data/blacklist.txt')));
  console.log('Reading packages directory...');
  const current = await fs.readdirAsync(path.join(config.dir, 'current/'));
  const map = toMap(current);

  const queue = [];
  let size = 0;
  await common.listInfo(info => {
    if (!info.tar) {
      console.log(`${info.id}: no tar!`);
      return;
    }

    const url = info.tar.replace('http://', 'https://')
                        .replace('registry.npmjs.org', 'registry.npmjs.com');
    const file = url.replace(`https://registry.npmjs.com/${info.name}/-/`, '');

    if (file.replace(/[@0v-]/g, '') !== `${info.id.replace(/[@0v-]/g, '')}.tgz`) {
      console.log(`${info.id}: bad tar - ${info.tar}`);
      return;
    }
    if (broken.has(url) ||
        broken.has(url.replace('registry.npmjs.com/', 'registry.npmjs.org/'))) {
      //console.log(`${info.id}: known broken url, tar - ${info.tar}`);
      return;
    }
    if (blacklist.has(file) || blacklist.has(url) || blacklist.has(info.id) ||
        file.endsWith('-0.0.0-reserved.tgz')) {
      //console.log(`${info.id}: blacklist hit, tar - ${info.tar}`);
      return;
    }
    if (!map.has(file)) {
      queue.push([url, file]);
    }

    map.set(file, true);
    size++;
  });

  const needed = queue.length;
  console.log(`To download: ${needed}.`);
  let updated = 0;
  while (queue.length > 0) {
    const block = queue.splice(0, 5);
    await Promise.all(block.map(args => downloadOne(...args)));
    updated += block.length;
    if (updated % 100 < block.length) {
      console.log(`Downloaded: ${updated}/${needed}...`);
    }
  }
  console.log(`New/updated: ${updated}.`);

  console.log(`To move: ${map.size - size}`);
  let moved = 0;
  for (const [file, keep] of map) {
    if (keep) continue;
    if (moved === 0) {
      await mkdirpAsync(path.join(config.dir, 'outdated/'));
    }
    await fs.renameAsync(
      path.join(config.dir, 'current/', file),
      path.join(config.dir, 'outdated/', file)
    );
    moved++;
  }
  console.log(`Moved: ${moved}.`);

  console.log('END');
}

module.exports = {
  run
};
