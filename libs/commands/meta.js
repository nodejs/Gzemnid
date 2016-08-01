'use strict';

const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
const config = require('../config').config;
const { jsonStream, toMap } = require('../helpers');

async function run() {
  const current = await fs.readdirAsync(path.join(config.dir, 'meta/'));
  const map = toMap(current);

  const out = {
    mv: fs.createWriteStream(path.join(config.dir, 'meta.mv.txt')),
    rm: fs.createWriteStream(path.join(config.dir, 'meta.rm.txt')),
    download: fs.createWriteStream(path.join(config.dir, 'meta.download.txt')),
    wget: fs.createWriteStream(path.join(config.dir, 'meta.wget.txt'))
  };

  let count = 0;
  let updated = 0;
  const stream = jsonStream('byField.info.json');
  stream.on('data', info => {
    if (!info.tar) {
      console.log(info.id + ': no tar!');
      return;
    }

    const url = `https://registry.npmjs.org/${info.name}`;
    const file = `${info.id}.json`;
    if (!map.has(file)) {
      out.download.write(`wget -nc ${url} -O ${file}\n`);
      out.wget.write(`wget -nc ${url} -O ${file}\n`);
      updated++;
    }

    map.set(file, true);
    count++;
    if (count % 10000 === 0) {
      console.log(`${count}...`);
    }
  });

  stream.on('end', () => {
    console.log(`Total: ${count}.`);
    console.log(`New/updated: ${updated}.`);
    let moved = 0;
    map.forEach((status, file) => {
      if (status === false) {
        out.mv.write(`mv "${file}" ../meta.outdated/\n`);
        out.rm.write(`rm "${file}"\n`);
        moved++;
      }
    });
    console.log(`Moved: ${moved}.`);
    console.log('END');
  });
}

module.exports = {
  run
};
