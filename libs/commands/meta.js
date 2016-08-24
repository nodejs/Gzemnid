'use strict';

const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
const config = require('../config').config;
const { jsonStream, toMap, mkdirpAsync } = require('../helpers');

async function run() {
  await mkdirpAsync(path.join(config.dir, 'meta/'));
  const current = await fs.readdirAsync(path.join(config.dir, 'meta/'));
  const map = toMap(current);

  const out = {
    wget: fs.createWriteStream(path.join(config.dir, 'meta.wget.txt'))
  };

  let count = 0;
  let updated = 0;
  const stream = jsonStream('byField.info.json');
  stream.on('data', info => {
    if (!info.tar) {
      console.log(`${info.id}: no tar!`);
      return;
    }

    const url = `https://registry.npmjs.org/${info.name}`;
    const file = `${info.id}.json`;
    if (!map.has(file)) {
      out.wget.write(`wget -nv -nc ${url} -O ${file}\n`);
      updated++;
    }

    map.set(file, true);
    count++;
    if (count % 10000 === 0) {
      console.log(`${count}...`);
    }
  });

  await stream.promise;

  console.log(`Total: ${count}.`);
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
