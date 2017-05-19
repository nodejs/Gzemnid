'use strict';

const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const bhttp = require('bhttp');
const path = require('path');
const config = require('../config').config;
const common = require('../common');

const endpoint = 'https://api.npmjs.org/downloads/point/last-month/';
const groupSize = 128;
const session = bhttp.session({
  headers: {
    'user-agent': config.useragent || 'Gzemnid'
  }
});

function buildMap(data) {
  const map = new Map();
  Object.keys(data).forEach(file => {
    map.set(file, false);
  });
  return map;
}

// We could use the stream directly, but then we won't receive nice stats
// beforehand.
async function getGroups(map) {
  const groups = [];
  let group = [];
  let needed = 0;

  const total = await common.listInfo(info => {
    const name = info.name;
    if (map.has(name)) return;
    needed++;
    if (group.length >= groupSize) {
      groups.push(group);
      group = [];
    }
    group.push(name);
    map.set(name, true);
  });

  groups.push(group);
  console.log(`Needed: ${needed}.`);
  return { groups, total, needed };
}

async function update() {
  const file = path.join(config.dir, 'stats.json');
  const data = await fs.readFileAsync(file)
    .then(JSON.parse)
    .catch(() => ({}));

  const map = buildMap(data);
  const { groups, total, needed } = await getGroups(map);

  let requested = 0;
  let processed = 0;
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    requested += group.length;
    console.log(`Request size: ${group.length}, total requested: ${requested}/${needed}.`);
    const res = await session.get(endpoint + group.join(','));
    if (res.statusCode !== 200) {
      const error = new Error(`[npm API] ${res.statusCode}: ${res.statusMessage}`);
      console.log(`Got error: ${error}, retrying step ${i}...`);
      i--;
      requested -= group.length;
      continue;
    }
    let body = res.body;
    if (group.length === 1) {
      body = {};
      body[group[0]] == res.body;
    }
    for (const name of Object.keys(body)) {
      processed++;
      if (!body[name]) {
        console.log(`${name}: bad package info: ${name}!`);
        continue;
      }
      if (name !== body[name].package) {
        console.log(`${name}: bad package name: ${body[name].package}!`);
        continue;
      }
      data[name] = body[name].downloads;
    }
    const saved = processed + total - needed;
    console.log(`Processed: ${processed}/${needed}, saved: ${saved}/${total}.`);
    await fs.writeFileAsync(file, JSON.stringify(data, undefined, 1));
  }
}

async function rebuild() {
  const file = path.join(config.dir, 'stats.json');
  await fs.unlinkAsync(file).catch(() => ({}));
  await update();
}

async function run() {
  await rebuild();
}

module.exports = {
  run,
  rebuild,
  update
};
