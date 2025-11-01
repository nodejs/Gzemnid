'use strict';

const assert = require('node:assert');
const path = require('node:path');
const semver = require('semver');
const { createWriteStream } = require('node:fs');
const { mkdir } = require('node:fs/promises');
const config = require('../config').config;
const Queue = require('../queue');

// We ignore packages which don't match this
const packageNameRegex = /^(@[\da-z._-]+\/)?\w[\w-]*(\.[\w-]+)*$/;

async function run(threshold) {
  threshold = Number(threshold) || 1e6;
  console.log(`Selecting packages with >= ${threshold.toLocaleString()} downloads/month...`);

  let total = 0;
  let selected = 0;
  let missing = 0;
  const want = [];

  const all = require('download-counts'); // lazy-load
  for (const [name, downloads] of Object.entries(all)) {
    total++;
    if (downloads < threshold) continue;
    if (!packageNameRegex.test(name)) {
      missing++;
      continue; // skip bad pkg names
    }
    selected++;
    want.push({ name, downloads });
  }

  want.sort((a, b) => {
    if (a.downloads > b.downloads) return -1;
    if (a.downloads < b.downloads) return 1;
    if (a.name > b.name) return -1;
    if (a.name < b.name) return 1;
    return 0;
  });

  console.log(`Selected: ${selected} / ${total}`);
  if (missing > 0) console.log(`Warning: ${missing} packages ignored for bad names`);

  console.log('Building package list...');

  await mkdir(config.dir, { recursive: true });
  const out = createWriteStream(path.join(config.dir, 'byField.info.json'));
  out.write('[\n');

  let count = 0;
  const writeData = (name, version, downloads, tar) => {
    const info = { name, version, downloads, tar };
    if (count > 0) out.write(',\n');
    out.write(JSON.stringify(info));
    count++;
    if (count % 1000 === 0) console.log(`${count}...`);
  };

  const queue = new Queue(10);
  const lock = new Queue(1);
  const processOne = async({ name, downloads }) => {
    const order = lock.claim();
    await queue.claim();
    assert(packageNameRegex.test(name));
    const url = `https://registry.npmjs.org/${name}/latest`;
    if (selected < 20) console.log(`Downloading latest info: ${name}...`);
    let res = await fetch(url);
    while (!res.ok) {
      if (res.status === 404) {
        console.log(`Package is missing (${res.status}), skipping: ${name}`);
        await order;
        lock.release();
        queue.release();
        return;
      }
      console.log(`Failed ${res.status}, re-trying: ${name}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      res = await fetch(url);
    }
    let json;
    try {
      json = await res.json();
    } catch (e) {
      // e.g. cson-safe atm, TODO: get manually via full doc (non-/latest)
      console.log(`Skipping ${name} due to JSON parsing error: ${e}`);
      await order;
      lock.release();
      queue.release();
      return;
    }
    const { name: realName, version, dist: { tarball: tar } } = json;
    assert.strictEqual(name, realName);
    if (!semver.valid(version)) throw new Error(`Invalid version: ${version}`);
    const tar0 = `https://registry.npmjs.org/${name}/-/${name.split('/').pop()}-${version}.tgz`;
    assert.strictEqual(tar, tar0);
    await order;
    writeData(name, version, downloads, tar);
    lock.release();
    queue.release();
  };

  while (want.length > 0) processOne(want.shift());
  await queue.end();

  console.log(`${count}.`);
  out.write('\n]\n');
  out.end();
  console.log('END');
}

module.exports = {
  run
};
