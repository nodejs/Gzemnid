'use strict';

const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
const bhttp = require('bhttp');
const config = require('../config').config;
const {
  jsonStream, readlines, toMap, mkdirpAsync
} = require('../helpers');

const session = bhttp.session({
  headers: {
    'user-agent': config.useragent || 'Gzemnid'
  }
});

async function run() {
  await mkdirpAsync(path.join(config.dir, 'current/'));

  const broken = new Set(await readlines(path.join(config.basedir, 'data/brokenurls.txt')));
  const blacklist = new Set(await readlines(path.join(config.basedir, 'data/blacklist.txt')));
  const current = await fs.readdirAsync(path.join(config.dir, 'current/'));
  const map = toMap(current);

  let count = 0;
  const stream = jsonStream('byField.info.json');
  const queue = [];
  stream.on('data', info => {
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
    count++;
    if (count % 50000 === 0) {
      console.log(`Checking: ${count}...`);
    }
  });

  await stream.promise;
  console.log(`Total: ${count}.`);

  console.log(`To download: ${queue.length}.`);
  let updated = 0;
  for (const [url, file] of queue) {
    console.log(`Downloading: ${file}...`);
    const out = path.join(config.dir, 'current/', file);
    const response = await session.get(url, { stream: true })
    response.pipe(fs.createWriteStream(out));
    updated++;
    if (updated % 100 === 0) {
      console.log(`Downloaded: ${updated}/${queue.length}...`);
    }
  }
  console.log(`New/updated: ${updated}.`);

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
