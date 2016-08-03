'use strict';

const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const bhttp = require('bhttp');
const path = require('path');
const config = require('../config').config;
const { jsonStream } = require('../helpers');

const endpoint = 'https://api.npmjs.org/downloads/point/last-month/';
const grouplimit = 8000;
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
function getGroups(map) {
  const stream = jsonStream('byField.info.json');

  const deferred = Promise.pending();
  const groups = [];
  let group = [];
  let groupLength = -1;
  let total = 0;
  let needed = 0;

  stream.on('data', info => {
    const name = info.name;
    total++;
    if (total % 10000 === 0) {
      console.log(`Reading: ${total}...`);
    }
    if (map.has(name)) return;
    needed++;
    if (groupLength > 0 && groupLength + 1 + name.length >= grouplimit) {
      groups.push(group);
      group = [];
      groupLength = -1;
    }
    groupLength += 1 + name.length;
    group.push(name);
    map.set(name, true);
  });
  stream.on('end', () => {
    groups.push(group);
    deferred.resolve({ groups, total, needed });
    console.log(`Total: ${total}, neededed: ${needed}.`);
  });

  return deferred.promise;
}

async function run() {
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
      throw Error(`[npm API] ${res.statusCode}: ${res.statusMessage}`);
    }
    const body = res.body;
    for (const name of Object.keys(body)) {
      processed++;
      if (name !== body[name].package) {
        console.log(`${name}: bad package name: ${body[name].package}!`);
      }
      data[name] = body[name].downloads;
    }
    const saved = processed + total - needed;
    console.log(`Processed: ${processed}/${needed}, saved: ${saved}/${total}.`);
    await fs.writeFileAsync(file, JSON.stringify(data, undefined, 1));
  }
}

module.exports = {
  run
};
