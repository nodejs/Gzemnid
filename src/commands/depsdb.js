'use strict';

const path = require('path');
const fs = require('../fs');
const config = require('../config').config;
const semver = require('semver');
const { readCallback, readMap, jsonStream, promiseEvent, readFile } = require('../helpers');

async function plain() {
  console.log('Dependencies: cleaning up...');
  const outdir = path.join(config.dir, 'deps/');
  await fs.rmrf(outdir);
  await fs.mkdirp(outdir);

  console.log('Reading meta directory...');
  const current = await fs.readdir(path.join(config.dir, 'meta/'));

  console.log(`Found ${current.length} meta files...`);
  const out = fs.createWriteStream(path.join(outdir, 'deps.json'));
  out.write('{\n');
  let count = 0;
  for (const file of current) {
    const json = await readFile(
      path.join(config.dir, 'meta/', file),
      config.meta.compress
    );
    let data;
    try {
      data = JSON.parse(json);
    } catch (e) {
      console.error(`Failed to parse file: ${file}`);
      throw e;
    }
    if (!data || !data.versions) {
      console.error(`Versions not defined for ${file}!`);
      continue;
    }
    if (count > 0) {
      out.write(', ');
    }
    const ready = out.write(`${JSON.stringify(data.name)}: {\n`);
    if (!ready) await promiseEvent(out, 'drain');
    let depsStringPrev;
    let versionPrev;
    for (const version of Object.keys(data.versions)) {
      const deps = data.versions[version].dependencies || {};
      const depsString = JSON.stringify(deps);
      if (depsString === depsStringPrev && depsString !== '{}') {
        out.write(` ${JSON.stringify(version)}: ${JSON.stringify(versionPrev)},\n`);
      } else {
        out.write(` ${JSON.stringify(version)}: ${depsString},\n`);
        versionPrev = version;
        depsStringPrev = depsString;
      }
    }
    out.write(` "_latest": ${JSON.stringify(data['dist-tags'].latest)}\n`);
    out.write('}');
    count++;
    if (count % 10000 === 0) {
      console.log(`${count}...`);
    }
  }
  out.write('}\n');
  out.end();
  await promiseEvent(out, 'close');
  console.log(`Total: ${count}.`);
  console.log('Dependencies complete.');
}

async function resolved() {
  const needfull = new Set();
  console.log('Prereading deps.json (pass 1/2)...');
  const total = await readCallback('deps/deps.json', '$*', (info, key, count) => {
    for (const version of Object.keys(info)) {
      if (typeof info[version] !== 'object') continue;
      for (const dep of Object.keys(info[version])) {
        needfull.add(dep);
      }
    }
    if (++count % 50000 === 0) console.log(`Preread ${count}...`);
  });
  console.log(`Preread ${total} pakages, ${needfull.size} have dependents`);
  console.log('Reading deps.json (pass 2/2)...');
  const data = await readMap('deps/deps.json', '$*', (info, key) => {
    if (needfull.has(key)) return info;
    let ref = info._latest;
    while (typeof info[ref] !== 'object') {
      if (!info[ref]) {
        throw new Error(`${key}: '_latest' points to unknown version!`);
      }
      ref = info[ref];
    }
    // We need only the _latest version of packages without dependents.
    const res = { _latest: info._latest };
    res[res._latest] = info[ref];
    return res;
  });
  needfull.clear();

  const matchVersion = (name, spec) => {
    if (!data.has(name))
      return undefined;

    const info = data.get(name);
    const latest = info._latest;
    if (spec === 'latest' || spec === '*' || semver.satisfies(latest, spec))
      return latest;

    return Object.keys(info)
      .filter(key => key[0] !== '_')
      .sort(semver.rcompare)
      .find(version => semver.satisfies(version, spec));
  };

  const normalized = new Set();
  const normalizedExtra = new Set();
  const normalize = (name, version) => {
    const key = [name, version].join('-');
    if (normalized.has(key))
      return;
    normalized.add(key);
    if (normalizedExtra.has(key))
      return;
    const info = data.get(name);
    if (typeof info[version] === 'string') {
      const equivKey = [name, info[version]].join('-');
      info[version] = info[info[version]];
      if (normalized.has(equivKey) || normalizedExtra.has(equivKey))
        return;
      normalizedExtra.add(equivKey);
    }
    const deps = info[version];
    for (const dep in deps) {
      if (!deps[dep].indexOf ||
          deps[dep].indexOf('://') !== -1 ||
          deps[dep].startsWith('github:') ||
          dep[0] === '@'
      ) {
        continue;
      }
      const depVersion = matchVersion(dep, deps[dep]);
      if (!depVersion) {
        deps[dep] = ` ${deps[dep]}`;
        continue;
      }
      deps[dep] = depVersion;
      normalize(dep, depVersion);
    }
  };

  console.log('Normalizing dependencies...');
  let count = 0;
  for (const [name, info] of data) {
    normalize(name, info._latest);
    if (++count % 1000 === 0) console.log(`Normalized ${count}...`);
  }
  console.log('Normalization complete');

  console.log('Cleaning up dependencies...');
  count = 0;
  const out = fs.createWriteStream(path.join(config.dir, 'deps/deps-resolved.json'));
  out.write('{\n');
  for (const [name, versions] of data) {
    if (count > 0)
      out.write(',\n');
    const ready = out.write(`${JSON.stringify(name)}: {\n`);
    if (!ready) await promiseEvent(out, 'drain');
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
  out.end();
  await promiseEvent(out, 'close');
  console.log('Cleanup complete');
}

function nestedOne(data, name, version, depth = 0) {
  if (!version)
    return [];
  const key = [name, version].join('@');
  const versions = data.get(name);
  if (!versions || !versions[version])
    return [key, '?'];
  const deps = versions[version];
  if (Array.isArray(deps))
    return deps;
  versions[version] = []; // Recursive protection
  let normal = [key];
  for (const dep in deps) {
    normal = normal.concat(nestedOne(data, dep, deps[dep], depth + 1));
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
}

async function sort(names) {
  console.log('Reading stats.json...');
  const info = await readMap('stats.json');
  console.log('Sorting packages...');
  names.sort((a, b) => {
    const aStat = info.get(a);
    const bStat = info.get(b);
    if (aStat && !bStat) return -1;
    if (bStat && !aStat) return 1;
    if (aStat > bStat) return -1;
    if (bStat > aStat) return 1;
    if (a > b) return 1;
    if (b > a) return -1;
    return 0;
  });
}

async function nested() {
  console.log('Reading deps-resolved.json...');
  const data = await readMap('deps/deps-resolved.json');
  const names = [...data.keys()];
  await sort(names);

  console.log('Dumping nested dependencies...');
  let count = 0;
  const out = fs.createWriteStream(path.join(config.dir, 'deps/deps-nested.json'));
  out.write('{\n');
  for (const name of names) {
    const versions = data.get(name);
    const deps = await nestedOne(data, name, versions._latest);
    if (count > 0)
      out.write(',\n');
    const ready = out.write(`${JSON.stringify(name)}: ${JSON.stringify(deps)}`);
    if (++count % 1000 === 0) console.log(`Dumped ${count}...`);
    if (!ready) await promiseEvent(out, 'drain');
  }
  out.write('\n}\n');
  out.end();
  await promiseEvent(out, 'close');
  console.log('Dump complete');
}

async function stats() {
  console.log('Reading stats.json...');
  const info = await readMap('stats.json');

  console.log('Dumping nested dependencies with stats...');
  let count = 0;
  const stream = jsonStream('deps/deps-nested.json', '$*');
  const out = fs.createWriteStream(path.join(config.dir, 'deps/deps-nested.txt'));
  out.on('drain', () => stream.resume());
  stream.on('data', row => {
    const weight = info.get(row.key) || '?';
    const ready = out.write(`${weight}\t${row.key}: ${JSON.stringify(row.value)}\n`);
    if (++count % 1000 === 0) console.log(`Dumped ${count}...`);
    if (!ready) stream.pause();
  });

  await stream.promise;
  out.end();
  await promiseEvent(out, 'close');
  console.log(`Total: ${count}.`);
}

async function run() {
  await plain();
  await resolved();
  await nested();
  await stats();
}

module.exports = {
  plain,
  resolved,
  nested,
  stats,
  run
};
