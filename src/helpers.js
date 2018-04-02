'use strict';

const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const child_process = Promise.promisifyAll(require('child_process'));
const mkdirpAsync = Promise.promisify(require('mkdirp'));
const readline = require('readline');
const JSONStream = require('JSONStream');
const path = require('path');
const fetch = require('node-fetch');
const lz4 = require('lz4');
const config = require('./config').config;

async function rmrfAsync(dir) {
  await child_process.execFileAsync('rm', ['-rf', dir]);
}

async function copyAsync(inFile, outFile) {
  await new Promise((accept, reject) => {
    const input = fs.createReadStream(inFile);
    input.on('error', reject);
    const output = fs.createWriteStream(outFile);
    output.on('error', reject);
    output.on('finish', accept);
    input.pipe(output);
  });
}

function toMap(arr, value = false) {
  const map = new Map();
  arr.forEach(x => map.set(x, value));
  return map;
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

function promiseEvent(obj, finish = 'end', error = 'error') {
  return new Promise((accept, reject) => {
    obj.on(finish, accept);
    obj.on(error, reject);
  });
}

function jsonStream(file, type = '*') {
  let source;
  if (typeof file === 'string') {
    const resolved = path.join(config.dir, file);
    source = fs.createReadStream(resolved);
  } else {
    source = file;
  }

  const stream = source.pipe(JSONStream.parse(type));
  stream.promise = promiseEvent(stream);
  return stream;
}

function packedOut(file, compress = true) {
  const outstream = fs.createWriteStream(`${file}${compress ? '.lz4' : ''}`);
  if (!compress) {
    return outstream;
  }
  const encoder = lz4.createEncoderStream({
    highCompression: config.compression.high
  });
  encoder.pipe(outstream);
  return encoder;
}

function packedIn(file, compress = true) {
  const stream = fs.createReadStream(`${file}${compress ? '.lz4' : ''}`);
  if (!compress) {
    return stream;
  }
  const encoder = lz4.createDecoderStream();
  return stream.pipe(encoder);
}

async function read(file, type = '$*') {
  const data = {};
  let count = 0;
  const stream = jsonStream(file, type);
  stream.on('data', obj => {
    data[obj.key] = obj.value;
    if (++count % 10000 === 0) console.log(`Read ${count}...`);
  });
  await stream.promise;
  console.log('Read complete');
  return data;
}

function fetchWrap(url, opts = {}) {
  const options = Object.assign({}, opts);
  options.headers = Object.assign({}, opts.headers || {});
  if (!options.headers['user-agent'])
    options.headers['user-agent'] = config.useragent || 'Gzemnid';
  return fetch(url, options);
}

module.exports = {
  mkdirpAsync,
  rmrfAsync,
  copyAsync,
  toMap,
  readlines,
  promiseEvent,
  jsonStream,
  packedOut,
  packedIn,
  fetch: fetchWrap,
  read
};
