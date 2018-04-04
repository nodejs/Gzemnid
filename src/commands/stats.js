'use strict';

const fs = require('../fs');
const path = require('path');
const config = require('../config').config;
const common = require('../common');
const { fetch } = require('../helpers');

const endpoint = 'https://api.npmjs.org/downloads/point/last-month/';
const groupSize = 128;

// Ref: https://github.com/npm/registry/issues/167
const badPackages = [];

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
    if (badPackages.includes(name)) {
      groups.push([name]);
      map.set(name, true);
      return;
    }
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

async function fetchStats(group, info) {
  info.requested += group.length;
  console.log(`Request size: ${group.length}, total requested: ${info.requested}/${info.needed}.`);
  const res = await fetch(endpoint + group.join(','));
  if (res.status !== 200) {
    const error = new Error(`[npm API] ${res.status}: ${res.statusText}`);
    console.log(`Got error: ${error}, retrying...`);
    info.requested -= group.length;
    return fetchStats(group, info);
  }
  if (group.length === 1) {
    // Single-packae has different format
    const body = {};
    body[group[0]] = await res.json();
    return body;
  }
  return res.json();
}

function sortStringify(stats) {
  const names = Object.keys(stats);
  names.sort((a, b) => {
    const aStat = stats[a];
    const bStat = stats[b];
    if (aStat && !bStat) return -1;
    if (bStat && !aStat) return 1;
    if (aStat > bStat) return -1;
    if (bStat > aStat) return 1;
    if (a > b) return 1;
    if (b > a) return -1;
    return 0;
  });
  const out = names.map(name =>
    ` ${JSON.stringify(name)}: ${JSON.stringify(stats[name])}`
  );
  return `{\n${out.join(',\n')}\n}`;
}

async function update() {
  const file = path.join(config.dir, 'stats.json');
  const data = await fs.readFile(file)
    .then(JSON.parse)
    .catch(() => ({}));

  const map = buildMap(data);
  const { groups, total, needed } = await getGroups(map);

  const info = { total, needed, requested: 0, processed: 0 };
  while (groups.length > 0) {
    const block = groups.splice(0, 5);
    const res = await Promise.all(block.map(group => fetchStats(group, info)));
    const body = Object.assign({}, ...res);
    for (const name of Object.keys(body)) {
      info.processed++;
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
    const saved = info.processed + info.total - info.needed;
    console.log(`Processed: ${info.processed}/${info.needed}, saved: ${saved}/${info.total}.`);
    await fs.writeFile(file, JSON.stringify(data, undefined, 1));
  }
  console.log('Writing sorted stats...');
  await fs.writeFile(file, sortStringify(data));
  console.log('Stats finished!');
}

async function rebuild() {
  const file = path.join(config.dir, 'stats.json');
  await fs.unlink(file).catch(() => ({}));
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
