'use strict';

const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
const config = require('../config').config;
const child_process = Promise.promisifyAll(require('child_process'));
const readline = require('readline');
const { toSet, mkdirpAsync, readlines } = require('../helpers');

const extensions = [
  '.ts', '.coffee', '.js',
  '.php', '.json', '.txt'
];

let excludedLoaded;
async function loadExcluded() {
  if (excludedLoaded) return excludedLoaded;
  const lines = await readlines(path.join(config.basedir, 'data/code.excluded.txt'));
  excludedLoaded = lines
    .filter(x => !!x)
    .map(x => {
      if (x[0] === '*') {
        x = x.slice(1);
      } else if (x[0] !== '/') {
        x = '[^/]' + x;
      }
      if (x[x.length - 1] === '*') {
        x = x.substr(0, x.length - 1);
      } else if (x[x.length - 1] !== '/') {
        x = x + '[/$]';
      }
      x = x.replace(/[^\w\s]/g, '\\$&');
      x = x.replace(/\\\*/g, '.*');
      return new RegExp(x);
    });
    return excludedLoaded;
}

async function partials() {
  await mkdirpAsync(path.join(config.dir, 'partials/'));
  const current = await fs.readdirAsync(path.join(config.dir, 'current/'));
  const present = await fs.readdirAsync(path.join(config.dir, 'partials/'));
  const currentSet = toSet(current);
  const presentSet = toSet(present);
  let removed = 0;
  for (const tgz of present) {
    if (currentSet.has(tgz)) continue;
    const dir = path.join(config.dir, 'partials', tgz);
    await child_process.execFileAsync('rm', ['-rf', dir]);
    removed++;
    if (removed % 10000 === 0) {
      console.log(`Partials: removing ${removed}...`);
    }
  }
  console.log(`Partials: removed ${removed}.`);
  const tmp = path.join(config.dir, 'tmp/');
  await child_process.execFileAsync('rm', ['-rf', tmp]);
  await mkdirpAsync(tmp);
  let built = 0;
  const total = current.size - present.size + removed;
  for (const tgz of current) {
    if (presentSet.has(tgz)) continue;
    console.log(`Partial: building ${tgz}`);
    try {
      await partial(tgz);
    } catch (e) {
      console.error(`Partial: failed ${tgz}: ${e}`);
    }
    built++;
    if (built % 10000 === 0) {
      console.log(`Partials: building ${built} / ${total}...`);
    }
  }
  console.log(`Partials: built ${built}.`);
  await child_process.execFileAsync('rm', ['-rf', tmp]);
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
  const files = lines.map(x => x.replace(/[^\/]*\//, ''));
  await fs.writeFileAsync(path.join(outdir, 'files.txt'), files.join('\n'));
  for (const ext of extensions) {
    await fs.writeFileAsync(
      path.join(outdir, `files${ext}.txt`),
      files.filter(entry => entry.endsWith(ext)).join('\n')
    );
  }

  await mkdirpAsync(outdir);

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
      await slimbuildJs(tmp, ext, outdir, tgz, slim);
    }
  }
  await child_process.execFileAsync('rm', ['-rf', tmp]);
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

async function slimbuildJs(dir, ext, outdir, tgz, slim) {
  const outfile = path.join(outdir, `slim.code${ext}.txt`);
  const out = fs.createWriteStream(outfile);
  const entries = slim.filter(entry => entry.endsWith(ext));
  for (const entry of entries) {
    await new Promise((accept, reject) => {
      const stream = fs.createReadStream(path.join(dir, entry));
      let num = 0;
      readline.createInterface({
        input: stream
      }).on('line', line => {
        num++;
        if (line.length > 500) return;
        if (!/[^\s]/.test(line)) return;
        out.write(`${tgz}/${entry}:${num}:${line}\n`);
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
  await child_process.execFileAsync('rm', ['-rf', outdir]);
  await mkdirpAsync(outdir);
  const current = await fs.readdirAsync(path.join(config.dir, 'current/'));
  current.sort();
  const out = fs.createWriteStream(path.join(outdir, 'packages.txt'));
  for (const tgz of current) {
    out.write(`${tgz}\n`);
  }
  await out.endAsync();
  /*
  for (const tgz of current) {
    // TODO: recollect the data
  }
  */
  console.log(`Total: ${current.length}.`);
  console.log('packages.txt complete.');
}

async function run() {
  await partials();
  await totals();
}

module.exports = {
  run,
  partials,
  totals
};
