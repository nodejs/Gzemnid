'use strict';

const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
const config = require('../config').config;
const child_process = Promise.promisifyAll(require('child_process'));
const readline = require('readline');
const { mkdirpAsync, readlines, rmrfAsync } = require('../helpers');

const extensions = [
  //'.php', '.json', '.txt',
  '.ts', '.coffee', '.js'
];

let excludedLoaded;
async function loadExcluded() {
  if (excludedLoaded) return excludedLoaded;
  const lines = await readlines(path.join(config.basedir, 'data/code.excluded.txt'));
  excludedLoaded = lines
    .filter(x => !!x)
    .map(x => {
      let fixFront = false;
      let fixTail = false;
      if (x[0] === '*') {
        x = x.slice(1);
      } else if (x[0] !== '/') {
        fixFront = true;
      }
      if (x[x.length - 1] === '*') {
        x = x.substr(0, x.length - 1);
      } else if (x[x.length - 1] !== '/') {
        fixTail = true;
      }
      x = x.replace(/[^\w\s]/g, '\\$&');
      if (fixFront) {
        x = `(/|^)${x}`;
      }
      if (fixTail) {
        x = `${x}(/|$)`;
      }
      x = x.replace(/\\\*/g, '.*')
           .replace(/\\\?/g, '.');
      return new RegExp(x);
    });
    return excludedLoaded;
}

async function partials() {
  await mkdirpAsync(path.join(config.dir, 'partials/'));
  const current = await fs.readdirAsync(path.join(config.dir, 'current/'));
  const present = await fs.readdirAsync(path.join(config.dir, 'partials/'));
  const currentSet = new Set(current);
  const presentSet = new Set(present);
  let removed = 0;
  for (const tgz of present) {
    if (currentSet.has(tgz)) continue;
    const dir = path.join(config.dir, 'partials', tgz);
    await rmrfAsync(dir);
    removed++;
    if (removed % 10000 === 0) {
      console.log(`Partials: removing ${removed}...`);
    }
  }
  console.log(`Partials: removed ${removed}.`);
  const tmp = path.join(config.dir, 'tmp/');
  await rmrfAsync(tmp);
  await mkdirpAsync(tmp);
  let built = 0;
  let errors = 0;
  const total = currentSet.size - presentSet.size + removed;
  for (const tgz of current) {
    if (presentSet.has(tgz)) continue;
    console.log(`Partial: building ${tgz}`);
    try {
      await partial(tgz);
    } catch (e) {
      console.error(`Partial: failed ${tgz}: ${e}`);
      errors++;
      await rmrfAsync(path.join(config.dir, 'partials/', tgz));
      await rmrfAsync(path.join(config.dir, 'tmp/', tgz));
      continue;
    }
    built++;
    if (built % 10000 === 0) {
      console.log(`Partials: building ${built} / ${total - errors}...`);
    }
  }
  console.log(`Partials: built ${built}, errors: ${errors}.`);
  await rmrfAsync(tmp);
}

async function partial(tgz) {
  const file = path.join(config.dir, 'current/', tgz);
  const outdir = path.join(config.dir, 'partials/', tgz);
  const tar = await child_process.execFileAsync(
    'tar',
    ['--list', '-f', file],
    { maxBuffer: 50 * 1024 * 1024 }
  );
  const lines = tar.split('\n')
                   .filter(x => !!x)
                   .sort();
  if (!lines.every(x => x.indexOf('/') !== -1)) {
    throw new Error('Package contains top-level files!');
  }

  await mkdirpAsync(outdir);

  const files = lines.map(x => x.replace(/[^\/]*\//, ''))
                     .map(x => `${tgz}/${x}`);
  await fs.writeFileAsync(path.join(outdir, 'files.txt'), files.join('\n'));
  for (const ext of extensions) {
    await fs.writeFileAsync(
      path.join(outdir, `files${ext}.txt`),
      files.filter(entry => entry.endsWith(ext)).join('\n')
    );
  }

  const excluded = await loadExcluded();
  const slim = files.filter(entry => !excluded.some(rexp => rexp.test(entry)));
  await fs.writeFileAsync(path.join(outdir, 'slim.files.txt'), slim.join('\n'));
  for (const ext of extensions) {
    await fs.writeFileAsync(
      path.join(outdir, `slim.files${ext}.txt`),
      slim.filter(entry => entry.endsWith(ext)).join('\n')
    );
  }

  const tmp = path.join(config.dir, 'tmp/', tgz);
  await mkdirpAsync(tmp);
  const args = [
    '--strip-components=1',
    '-xf',
    path.join('..', '..', 'current', tgz),
    '--wildcards'
  ];
  for (const ext of extensions) {
    if (slim.some(entry => entry.endsWith(ext))) {
      args.push(`*${ext}`);
    }
  }
  await child_process.execFileAsync('tar', args, {
    cwd: tmp,
    stdio: 'ignore',
    maxBuffer: 50 * 1024 * 1024
  });

  for (const ext of extensions) {
    if (config.extract.native) {
      await slimbuildNative(tmp, ext, outdir, tgz);
    } else {
      await slimbuildJs(ext, outdir, tgz, slim);
    }
  }
  await rmrfAsync(tmp);
}

let slimsh;
async function slimbuildNative(dir, ext, outdir, tgz) {
  if (!slimsh) {
    slimsh = path.resolve(path.join(config.basedir, 'scripts/slimbuild.sh'));
  }
  await child_process.execFileAsync(slimsh, [ext, path.resolve(outdir), tgz], {
    cwd: path.join(dir, '..')
  });
}

async function slimbuildJs(ext, outdir, tgz, slim) {
  const outfile = path.join(outdir, `slim.code${ext}.txt`);
  const out = fs.createWriteStream(outfile);
  const entries = slim.filter(entry => entry.endsWith(ext));
  for (const entry of entries) {
    await new Promise((accept, reject) => {
      const stream = fs.createReadStream(path.join(config.dir, 'tmp', entry));
      let num = 0;
      readline.createInterface({
        input: stream
      }).on('line', line => {
        num++;
        if (line.length > 500) return;
        if (!/[^\s]/.test(line)) return;
        out.write(`${entry}:${num}:${line}\n`);
      });
      stream
        .on('end', () => accept())
        .on('error', reject);
    });
  }
  await out.endAsync();
}

async function totals() {
  const outdir = path.join(config.dir, 'out/');
  await rmrfAsync(outdir);
  await mkdirpAsync(outdir);
  const current = await fs.readdirAsync(path.join(config.dir, 'current/'));
  current.sort();
  const out = fs.createWriteStream(path.join(outdir, 'packages.txt'));
  for (const tgz of current) {
    out.write(`${tgz}\n`);
  }
  await out.endAsync();
  console.log(`Total: ${current.length}.`);
  console.log('packages.txt complete.');

  const available = await fs.readdirAsync(path.join(config.dir, 'partials/'));
  available.sort();
  console.log(`Partials: ${available.length}.`);

  const filenames = ['files.txt', 'slim.files.txt'];
  for (const ext of extensions) {
    filenames.push(`files${ext}.txt`);
    filenames.push(`slim.files${ext}.txt`);
    filenames.push(`slim.code${ext}.txt`);
  }
  const streams = {};
  for (const file of filenames) {
    streams[file] = fs.createWriteStream(path.join(outdir, file));
  }
  let built = 0;
  for (const tgz of available) {
    const tgzdir = path.join(config.dir, 'partials/', tgz);
    for (const file of filenames) {
      const filepath = path.join(tgzdir, file);
      const stream = fs.createReadStream(filepath);
      stream.on('data', line => {
        streams[file].write(line);
      });
      await new Promise((accept, reject) => {
        stream.on('end', accept);
        stream.on('error', reject);
      });
    }
    built++;
    if (built % 10000 === 0) {
      console.log(`Totals: building ${built} / ${available.length}...`);
    }
  }
  for (const file of filenames) {
    await streams[file].endAsync();
  }
  console.log(`Totals: built ${built}.`);
}

async function pack() {
  // TODO: lzop things
}

async function run() {
  await partials();
  await totals();
  await pack();
}

module.exports = {
  run,
  partials,
  totals
};
