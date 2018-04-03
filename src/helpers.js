'use strict';

const fs = require('fs');
const readline = require('readline');
const JSONStream = require('JSONStream');
const path = require('path');
const fetch = require('node-fetch');
const lz4 = require('lz4');
const config = require('./config').config;

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
    const acceptWrap = (...args) => {
      obj.removeListener(error, rejectWrap);
      accept(...args);
    };
    const rejectWrap = (...args) => {
      obj.removeListener(finish, acceptWrap);
      reject(...args);
    };
    obj.once(finish, acceptWrap);
    obj.once(error, rejectWrap);
  });
}

function sourceFile(file) {
  if (typeof file === 'string') {
    const resolved = path.resolve(config.dir, file);
    return fs.createReadStream(resolved);
  }
  return file;
}

function jsonStream(file, type = '*') {
  const source = sourceFile(file);
  const stream = source.pipe(JSONStream.parse(type));
  stream.promise = promiseEvent(stream);
  return stream;
}

function jsonLines(file) {
  const source = sourceFile(file);
  const parser = readline.createInterface({ input: source });
  let errors = 0;
  let lines = 0;
  parser.on('line', line => {
    const json = line.trim().replace(/,$/, '');
    if (json.length === 0) return;
    if (errors > 1)
      parser.emit('error', new Error(`Write after second error: ${json}`));
    if (json[0] === '{' && json[json.length - 1] === '}') {
      parser.emit('data', JSON.parse(json));
    } else {
      errors++;
      if (errors > 2)
        parser.emit('error', new Error(`Invalid data: ${json}`));
    }
    lines++;
    if (lines === 1 && errors < lines)
      parser.emit('error', new Error(`Expected to fail: ${json}`));
  });
  parser.promise = promiseEvent(source);
  return parser;
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
  toMap,
  readlines,
  promiseEvent,
  jsonStream,
  jsonLines,
  packedOut,
  packedIn,
  fetch: fetchWrap,
  read
};
