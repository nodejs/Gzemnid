'use strict';

const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
const config = require('../config').config;
const semver = require('semver');
const { read } = require('../helpers');

async function plain() {
  const current = await fs.readdirAsync(path.join(config.dir, 'meta/'));

  const out = fs.createWriteStream(path.join(config.dir, 'deps.json'));
  out.write('{\n');
  let count = 0;
  for (const file of current) {
    const data = JSON.parse(await fs.readFileAsync(path.join(config.dir, 'meta/', file)));
    if (count > 0) {
      out.write(', ');
    }
    out.write(`${JSON.stringify(data.name)}: {\n`);
    for (const version of Object.keys(data.versions)) {
      const deps = data.versions[version].dependencies || {};
      out.write(` ${JSON.stringify(version)}: ${JSON.stringify(deps)},\n`);
    }
    out.write(` "_latest": ${JSON.stringify(data['dist-tags'].latest)}\n`);
    out.write('}');
    count++;
    if (count % 10000 === 0) {
      console.log(`${count}...`);
    }
  }
  out.write('}\n');
  await out.endAsync();
  console.log(`Total: ${count}.`);
  console.log('Dependencies complete.');
}

async function resolved() {
  const data = await read('deps.json');

  const matchVersion = (name, spec) => {
    if (!data[name])
      return undefined;

    const latest = data[name]._latest;
    if (semver.satisfies(latest, spec))
      return latest;

    let found = false;
    return Object.keys(data[name])
      .filter(key => key[0] !== '_')
      .sort(semver.compare)
      .reverse()
      .filter(version => {
        if (!found && semver.satisfies(version, spec)) {
          found = true;
          return true;
        }
        return false;
      })[0];
  };

  const normalized = new Set();
  const normalize = (name, version) => {
    const key = [name, version].join('-');
    if (normalized.has(key))
      return;
    normalized.add(key);
    const deps = data[name][version];
    for (const dep in deps) {
      const depVersion = matchVersion(dep, deps[dep]);
      deps[dep] = depVersion;
      if (!depVersion) continue;
      normalize(dep, depVersion);
    }
  };

  let count = 0;
  for (const name in data) {
    normalize(name, data[name]._latest);
    if (++count % 1000 === 0) console.log(`Normalized ${count}...`);
  }
  console.log('Normalization complete');

  count = 0;
  const out = fs.createWriteStream(path.join(config.dir, 'deps-resolved.json'));
  out.write('{\n');
  for (const name in data) {
    const versions = data[name];
    if (count > 0)
      out.write(',\n');
    out.write(`${JSON.stringify(name)}: {\n`);
    for (const version in versions) {
      if (version[0] === '_') continue;
      const key = [name, version].join('-');
      if (!normalized.has(key)) {
        versions[version] = undefined;
        continue;
      }
      out.write(` ${JSON.stringify(version)}: ${JSON.stringify(versions[version])},\n`);
    }
    out.write(` "_latest": ${JSON.stringify(versions._latest)}\n`);
    out.write('}');
    if (++count % 1000 === 0) console.log(`Cleanup ${count}...`);
  }
  out.write('}\n');
  await out.endAsync();
  console.log('Cleanup complete');
}

async function nested() {
  const data = await read('deps-resolved.json');

  const build = (name, version, depth = 0) => {
    if (!version)
      return [];
    const versions = data[name];
    const deps = versions[version];
    if (Array.isArray(deps))
      return deps;
    versions[version] = []; // Recursive protection
    const key = [name, version].join('@');
    let normal = [key];
    for (const dep in deps) {
      normal = normal.concat(build(dep, deps[dep], depth + 1));
      normal.sort();
      let last;
      normal = normal.filter(x => {
        const ok = last !== x;
        last = x;
        return ok;
      });
    }
    versions[version] = depth > 2 ? normal : deps;
    return normal;
  };

  let count = 0;
  const out = fs.createWriteStream(path.join(config.dir, 'deps-nested.json'));
  out.write('{\n');
  for (const name in data) {
    const version = data[name]._latest;
    const deps = await build(name, version);
    await out.writeAsync(`${JSON.stringify(name)}: ${JSON.stringify(deps)},\n`);
    if (++count % 1000 === 0) console.log(`Dumped ${count}...`);
  }
  out.write('}\n');
  await out.endAsync();
  console.log('Dump complete');
}

async function run() {
  await plain();
  await resolved();
  await nested();
}

module.exports = {
  plain,
  resolved,
  nested,
  run
};
