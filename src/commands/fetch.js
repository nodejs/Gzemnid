'use strict';

const path = require('path');
const fs = require('../fs');
const config = require('../config').config;
const { fetch, jsonStream } = require('../helpers');

const registryUrl = 'https://skimdb.npmjs.com/registry/_design/scratch/_view/byField';

async function run(filename) {
  console.log('Fetching package list...');

  await fs.mkdirp(config.dir);
  const source = filename
    ? path.resolve(filename)
    : (await fetch(registryUrl)).body;
  const stream = jsonStream(source, 'rows.*');

  const out = fs.createWriteStream(path.join(config.dir, 'byField.info.json'));
  out.write('[\n');

  let count = 0;
  out.on('drain', () => stream.resume());
  stream.on('data', data => {
    if (data.id !== data.key || data.id !== data.value.name) {
      console.log('Inconsistent data in registry, skipping package:',
        JSON.stringify({
          id: data.id,
          key: data.key,
          'value.name': data.value.name || null
        })
      );
      //console.log('received:', data);
      return;
    }
    data = data.value;
    const info = {
      name: data.name,
      version: data.version,
      tar: data.dist.tarball
    };

    if (count > 0) {
      out.write(',\n');
    }
    const ready = out.write(JSON.stringify(info));
    if (!ready) stream.pause();

    count++;
    if (count % 1000 === 0) {
      console.log(`${count}...`);
    }
  });

  await stream.promise;

  console.log(`${count}.`);
  out.write('\n]\n');
  console.log('END');
}

module.exports = {
  run
};
