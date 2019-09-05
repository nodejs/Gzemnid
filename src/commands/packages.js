'use strict';

const path = require('path');
const fs = require('../fs');
const config = require('../config').config;
const common = require('../common');
const { readlines, toMap, fetch, promiseEvent } = require('../helpers');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function downloadOneImpl(url, file) {
  console.log(`Downloading: ${file}...`);
  const out = path.join(config.dir, 'current/', file);
  const tmp = `${out}.tmp`;
  const response = (await fetch(url)).body;
  const write = fs.createWriteStream(tmp);
  response.pipe(write);
  await promiseEvent(write, 'close');
  await fs.rename(tmp, out);
}

async function downloadOne(url, file) {
  try {
    await downloadOneImpl(url, file);
  } catch (e) {
    if (e.code === 'ENETUNREACH') {
      console.log(`ENETUNREACH ${url}, retrying`);
      await sleep(1000);
      return downloadOne(url, file);
    }
    throw e;
  }
}

async function run() {
  await fs.mkdirp(path.join(config.dir, 'current/'));

  const broken = new Set(await readlines(path.join(config.basedir, 'data/brokenurls.txt')));
  const blacklist = new Set(await readlines(path.join(config.basedir, 'data/blacklist.txt')));
  console.log('Reading packages directory...');
  const current = await fs.readdir(path.join(config.dir, 'current/'));
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
      await fs.mkdirp(path.join(config.dir, 'outdated/'));
    }
    await fs.rename(
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
