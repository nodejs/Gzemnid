'use strict';

const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const readline = require('readline');
const JSONStream = require('JSONStream');
const path = require('path');
const config = require('../config').config;

function toMap(arr, value = false) {
  const map = new Map();
  arr.forEach(x => map.set(x, value));
  return map;
}

function toSet(arr) {
  const set = new Set();
  arr.forEach(x => set.add(x));
  return set;
}

function readlines(file) {
  return new Promise((accept, reject) => {
    const lines = [];
    const stream = fs.createReadStream(file);
    readline.createInterface({
      input: stream
    }).on('line', line => {
      if (line.length > 0) {
        lines.push(line);
      }
    });
    stream
      .on('end', () => accept(lines))
      .on('error', reject);
  });
}

function jsonStream(file, type = '*') {
  const resolved = path.join(config.dir, file);
  return fs.createReadStream(resolved).pipe(JSONStream.parse(type));
}

async function read(file, type = '$*') {
  const data = {};
  let count = 0;
  const stream = jsonStream(file, type);
  stream.on('data', obj => {
    data[obj.key] = obj.value;
    if (++count % 10000 === 0) console.log(`Read ${count}...`);
  });
  await new Promise(accept => {
    stream.once('end', accept);
  });
  console.log('Read complete');
  return data;
}

module.exports = {
  toMap,
  toSet,
  readlines,
  jsonStream,
  read
};
