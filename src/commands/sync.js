'use strict';

const fs = require('../fs');
const { promiseEvent } = require('../helpers');
const fs_ = require('fs');
const ChangesStream = require('changes-stream');

const file = './pool/info.json';
const registry = 'https://replicate.npmjs.com';
const syncinterval = 10000;

async function read(required = false) {
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
    for (const error of json.errors) {
      const e = verify(error);
      if (!e.store) throw new Error('Errors were not validated!');
    }
    return json;
  } catch (e) {
    if (required) throw new Error(`Could not read synced state from ${file}`);
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
  const seq = state.seq;
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
  state.saved = seq;
  state.saving = false;
  state.savetime = Date.now();
  console.log(`Saved state with seq = ${state.saved}`);
}

const ignoredIds = new Set([
  '_design/scratch',
  '_design/app',
]);

function verify(change) {
  if (ignoredIds.has(change.id)) {
    return { skip: true };
  }
  if (change.deleted) {
    // Deleted revision?
    return { skip: true };
  }
  if (!change.id || !change.doc.versions || !change.doc['dist-tags']) {
    return {
      warn: `Inconsistent data in registry, skipping change: seq = ${change.seq}, id = ${change.id}`,
      store: true,
      skip: true
    };
  }
  if (Object.keys(change.doc.versions).length === 0) {
    return {
      log: `No versions for package, deleting from info: seq = ${change.seq}, id = ${change.id}`,
      del: true
    };
  }
  if (!change.doc['dist-tags'].latest) {
    return {
      log: `No 'latest' tag for package, skipping change: seq = ${change.seq}, id = ${change.id}`,
      store: true,
      skip: true
    };
  }
  const versions = Object.keys(change.doc.versions);
  const version = versions.length === 1 ? versions[0] : change.doc['dist-tags'].latest;
  const data = change.doc.versions[version];
  if (!data || data.name !== change.id || version !== data.version ||
      data._id && data._id !== `${data.name}@${data.version}` && data._id !== `${data.name}@v${data.version}`) {
    return {
      warn: `Inconsistent data in registry, skipping change: seq = ${change.seq}, id = ${change.id}, version = ${version}`,
      store: true,
      skip: true
    };
    return;
  }
  return { ok: true, version, data };
}

function streamChanges(state) {
  const changes = new ChangesStream({
    db: registry,
    style: 'main_only',
    since: state.seq,
    include_docs: true
  });
  changes.on('data', change => {
    state.seq = change.seq;
    const block = verify(change);
    if (block.store) state.errors.push(change);
    if (block.log) console.log(block.log);
    if (block.warn) console.warn(block.warn);
    if (block.skip) return;
    changes.emit('change', block);
    if (block.del) {
      state.packages[change.id] = null;
      return;
    }
    if (!block.ok) throw new Error('Unexpected!');
    const { data } = block;
    const info = {
      name: data.name,
      version: data.version,
      tar: data.dist.tarball
    };
    state.packages[info.name] = info;
    if (change.seq % 500 === 0) {
      console.log(`Seq: ${change.seq}...`);
    }
    if (Date.now() - state.savetime > syncinterval) {
      write(state).catch(e => { throw e; });
    }
  });
  return changes;
}

async function run() {
  console.log('Replicating state...');
  const state = await read();
  console.log(`Initialized state with seq = ${state.seq}`);
  const changes = streamChanges(state);
}


async function watch() {
  console.log('Replicating state with live rebuilds...');
  let state;
  try {
    state = await read(true);
  } catch (e) {
    console.error(`Error: ${e.message}\nTry running \`gzemnid sync\` first.`);
    return;
  }
  console.log(`Initialized state with seq = ${state.seq}`);
  const changes = streamChanges(state);
  changes.on('change', block => {
    throw new Error('Not implemented yet!');
  });
}

module.exports = {
  run,
  watch
};

