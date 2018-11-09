'use strict';

const fs = require('../fs');
const { promiseEvent } = require('../helpers');
const fs_ = require('fs');
const ChangesStream = require('changes-stream');

const file = './pool/info.json';
const registry = 'https://replicate.npmjs.com';
const syncinterval = 10000;

async function read() {
  try {
    // TODO: this is a hack, add streamed reading
    const json = JSON.parse(fs_.readFileSync(file));
    if (json.registry !== registry) throw new Error('Registry mismatch!');
    const packages = {};
    for (const pkg of json.packages) {
      packages[pkg.name] = pkg;
    }
    json.packages = packages;
    json.saved = json.seq;
    json.savetime = Date.now();
    json.saving = false;
    return json;
  } catch (e) {
    return {
      registry,
      seq: 0,
      packages: {},
      errors: [],
      saved: 0,
      savetime: Date.now(),
      saving: false
    };
  }
}

async function write(state) {
  if (state.saved === state.seq) return;
  if (state.saving) return;
  console.log('Saving...');
  state.saving = true;
  const { registry, seq, errors } = state;
  const out = fs.createWriteStream(`${file}.tmp`);
  out.write(JSON.stringify({ registry, seq, errors }, undefined, 2).slice(0, -2));
  out.write(',\n  "packages": [');
  const keys = Object.keys(state.packages);
  const packages = Object.keys(state.packages).sort().map(key => state.packages[key]);
  let i = 0;
  for (const pkg of packages) {
    if (!pkg) continue;
    if (i++ !== 0) out.write(',');
    const ready = out.write(`\n    ${JSON.stringify(pkg)}`);
    if (!ready) await promiseEvent(out, 'drain');
  }
  out.write('\n  ]\n}\n');
  out.end();
  await promiseEvent(out, 'close');
  await fs.rename(`${file}.tmp`, file);
  state.saved = state.seq;
  state.saving = false;
  state.savetime = Date.now();
  console.log(`Saved state with seq = ${state.seq}`);
}

const ignoredIds = new Set([
  '_design/scratch',
  '_design/app',
]);

async function run() {
  console.log('Replicating state...');

  const state = await read();
  console.log(`Initialized state with seq = ${state.seq}`);

  const changes = new ChangesStream({
    db: registry,
    style: 'main_only',
    since: state.seq,
    include_docs: true
  });

  changes.on('data', change => {
    state.seq = change.seq;
    if (ignoredIds.has(change.id)) return;
    if (!change.id || !change.doc.versions || !change.doc['dist-tags']) {
      console.warn(`Inconsistent data in registry, skipping change: seq = ${change.seq}, id = ${change.id}`);
      state.errors.push(change);
      return;
    }
    if (Object.keys(change.doc.versions).length === 0) {
      console.log(`No versions for package, deleting from info: seq = ${change.seq}, id = ${change.id}`);
      if (state.packages[change.id]) state.packages[change.id] = null;
      return;
    }
    if (!change.doc['dist-tags'].latest) {
      console.warn(`No 'latest' tag for package, skipping change: seq = ${change.seq}, id = ${change.id}`);
      state.errors.push(change);
      return;
    }
    const version = change.doc['dist-tags'].latest;
    const data = change.doc.versions[version];
    if (!data || data.name !== change.id ||
        data._id !== `${data.name}@${data.version}` && data._id !== `${data.name}@v${data.version}`) {
      console.log(`Inconsistent data in registry, skipping change: seq = ${change.seq}, id = ${change.id}, version = ${version}`);
      state.errors.push(change);
      return;
    }
    const info = {
      name: data.name,
      version: data.version,
      tar: data.dist.tarball
    };
    state.packages[info.name] = info;
    if (change.seq % 10 === 0) {
      console.log(`Seq: ${change.seq}...`);
    }
    if (Date.now() - state.savetime > syncinterval) {
      write(state).catch(e => { throw e; });
    }
  });
}


async function watch() {
  console.error('Not implemented yet!');
}

module.exports = {
  run,
  watch
};

