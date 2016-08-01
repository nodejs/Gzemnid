'use strict';

const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const JSONStream = require('JSONStream');
const path = require('path');
const config = require('../config').config;

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
  jsonStream,
  read
};
