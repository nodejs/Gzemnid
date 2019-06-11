'use strict';

const fs = require('./fs');
const { promiseEvent, packedIn, packedOut } = require('./helpers');
const readline = require('readline');
const EventEmitter = require('events');
const ChangesStream = require('@npmcorp/changes-stream');

const dir = './pool/replicate/';
const chunkSize = 20 * 2 ** 20; // 20 MiB
const registry = 'https://replicate.npmjs.com';

async function read(ee, seq = 0) {
  const mask = /seq-(\d+)-(\d+).lz4/;
  const files = (await fs.readdir(dir))
    .filter(name => mask.test(name))
    .map(name => name.match(mask))
    .map(([name, start, end]) => ({
      name,
      start: Number(start),
      end: Number(end)
    }))
    .sort((a, b) => a.start - b.start);
  let found = 0;
  for (const file of files) {
    if (file.start !== found)
      throw new Error(`Inconsistent replicate data, clear ${dir} directory`);
    found = file.end;
  }
  let last = 0;
  const parseLine = line => {
    const change = JSON.parse(line);
    if (change.seq < last) throw new Error('Insonsistent replicate data!');
    last = change.seq;
    if (change.seq > seq) ee.emit('data', change);
  };
  for (const file of files) {
    if (file.end < seq) continue;
    console.log(`Reading replication file ${file.name}...`);
    const stream = packedIn(`${dir}seq-${file.start}-${file.end}`);
    readline.createInterface({
      input: stream
    }).on('line', parseLine);
    await promiseEvent(stream, 'end');
  }
  if (last > 0 && last !== found) throw new Error('Insonsistent replicate data!');
  return found;
}

async function replicate(seq) {
  await fs.mkdirp(dir);
  const ee = new EventEmitter();
  read(ee, seq).then(lastseq => {
    const state = { file: `seq-${lastseq}-tmp`, size: 0 };
    let out = packedOut(dir + state.file);
    console.log(`Remote replication started from state ${lastseq}...`);
    const changes = new ChangesStream({
      db: registry,
      style: 'all_docs', //'main_only',
      since: lastseq,
      include_docs: true
    });
    changes.on('data', change => {
      if (change.seq > seq) ee.emit('data', change);
      const line = JSON.stringify(change);
      out.write(line);
      out.write('\n');
      state.size += line.length + 1;
      if (state.size > chunkSize) {
        // Close current file
        const file = state.file;
        const final = file.replace('-tmp', `-${change.seq}`);
        console.log(`Saving replication file ${final}...`);
        out.on('close', () =>
          fs.rename(`${dir}${file}.lz4`, `${dir}${final}.lz4`)
        );
        out.end();
        // Create next file
        state.file = `seq-${change.seq}-tmp`;
        state.size = 0;
        out = packedOut(dir + state.file);
      }
    });
  });
  return ee;
}

module.exports = { replicate };
