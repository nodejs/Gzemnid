'use strict';

const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
const config = require('../config').config;
const child_process = Promise.promisifyAll(require('child_process'));
const readline = require('readline');
const babylon = require('babylon');
const {
  mkdirpAsync, readlines, rmrfAsync, copyAsync, promiseEvent,
  packedOut, packedIn
} = require('../helpers');

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

async function partials(subcommand, single) {
  if (subcommand && subcommand !== 'rebuild') {
    throw new Error(`Partials: unexpected command: ${subcommand}`);
  }
  const rebuild = subcommand === 'rebuild';
  await mkdirpAsync(path.join(config.dir, 'partials/'));
  const current = await fs.readdirAsync(path.join(config.dir, 'current/'));
  const present = await fs.readdirAsync(path.join(config.dir, 'partials/'));
  const currentSet = new Set(current);
  const presentSet = new Set(present);
  let removed = 0;
  for (const tgz of present) {
    if (single && tgz !== single) continue;
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
    if (single && tgz !== single) continue;
    if (!rebuild && presentSet.has(tgz)) continue;
    console.log(`Partial: building ${tgz}`);
    try {
      await partial(tgz, rebuild);
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

async function listTar(file) {
  const tar = await child_process.execFileAsync(
    'tar',
    ['--list', '--warning=no-unknown-keyword', '-f', file],
    { maxBuffer: 50 * 1024 * 1024 }
  );
  return tar.split('\n')
            .filter(x => !!x)
            .sort();
}

async function partial(tgz, rebuild) {
  const file = path.join(config.dir, 'current/', tgz);
  const outdir = path.join(config.dir, 'partials/', tgz);

  let files;

  if (rebuild) {
    try {
      files = await readlines(path.join(outdir, 'files.txt'));
    } catch (e) {
      // Just fall back to reading the tar
    }
  }

  await mkdirpAsync(outdir);

  if (!files) {
    const lines = await listTar(file);
    if (!lines.every(x => x.indexOf('/') !== -1)) {
      throw new Error('Package contains top-level files!');
    }
    files = lines.map(x => x.replace(/[^\/]*\//, ''))
                 .map(x => `${tgz}/${x}`);
    await fs.writeFileAsync(path.join(outdir, 'files.txt'), files.join('\n'));
    // TODO: rebuild new extensions on extensions list changes
    for (const ext of extensions) {
      await fs.writeFileAsync(
        path.join(outdir, `files${ext}.txt`),
        files.filter(entry => entry.endsWith(ext)).join('\n')
      );
    }
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
    '--warning=no-unknown-keyword',
    '-xf',
    path.join('..', '..', 'current', tgz),
    '--wildcards'
  ];
  args.push('*/package.json');
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

  // TODO: only if not exists
  await copyAsync(
    path.join(tmp, 'package.json'),
    path.join(outdir, 'package.json')
  );

  for (const ext of extensions) {
    if (config.extract.native) {
      await slimbuildNative(tmp, ext, outdir, tgz);
    } else {
      await slimbuildJs(ext, outdir, tgz, slim);
    }
  }

  if (config.extract.features.ast) {
    await slimAST('.js', outdir, tgz, slim);
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
    await promiseEvent(stream);
  }
  await out.endAsync();
}

function getAST(code, ext) {
  const density = code.length / code.split('\n').length;
  if (density > 200) {
    // This is probably a minified file
    return 'minified';
  }
  switch (ext) {
    case '.js':
      try {
        return babylon.parse(code);
      } catch (e) { /* ignore */ }
      try {
        return babylon.parse(code, { sourceType: 'module' });
      } catch (e) { /* ignore */ }
      break;
  }
  return 'unparsed';
}

async function slimAST(ext, outdir, tgz, slim) {
  //console.log(`Building AST for ${tgz}...`);
  const outfile = path.join(outdir, `slim.ast${ext}.json`);
  const out = packedOut(outfile, config.extract.compress);
  const entries = slim.filter(entry => entry.endsWith(ext));
  out.write('{');
  let count = 0;
  for (const entry of entries) {
    const filepath = path.join(config.dir, 'tmp', entry);
    const code = await fs.readFileAsync(filepath, 'utf-8');
    const ast = getAST(code, ext);
    if (count !== 0) {
      out.write(',');
    }
    out.write(`\n ${JSON.stringify(entry)}: ${JSON.stringify(ast)}`);
    count++;
  }
  out.write('\n}\n');
  out.end();
  await promiseEvent(out);
}

async function totalsAST(available) {
  console.log('Totals: building AST...');
  const outdir = path.join(config.dir, 'out/');
  const filenames = [];
  for (const ext of ['.js']) {
    filenames.push(`slim.ast${ext}.json`);
  }
  const streams = {};
  for (const file of filenames) {
    streams[file] = packedOut(path.join(outdir, file), config.extract.compress);
    streams[file].write('{');
  }
  let built = 0;
  for (const tgz of available) {
    const tgzdir = path.join(config.dir, 'partials/', tgz);
    for (const file of filenames) {
      const stream = packedIn(path.join(tgzdir, file));
      readline.createInterface({
        input: stream
      }).on('line', line => {
        if (line === '{' || line === '}') return;
        streams[file].write(streams[file].length === 1 ? '\n' : ',\n');
        streams[file].write(line.endsWith(',') ? line.slice(0, -1) : line);
      });
      await promiseEvent(stream);
    }
    built++;
    if (built % 10000 === 0) {
      console.log(`Totals: AST ${built} / ${available.length}...`);
    }
  }
  const promises = [];
  for (const file of filenames) {
    streams[file].write('\n}\n');
    streams[file].end();
    promises.push(promiseEvent(streams[file]));
  }
  await Promise.all(promises);
}

async function totals() {
  console.log('Totals: cleaning up...');
  const outdir = path.join(config.dir, 'out/');
  await rmrfAsync(outdir);
  await mkdirpAsync(outdir);

  console.log('Totals: building packages list...');
  const current = await fs.readdirAsync(path.join(config.dir, 'current/'));
  current.sort();
  const out = fs.createWriteStream(path.join(outdir, 'packages.txt'));
  for (const tgz of current) {
    out.write(`${tgz}\n`);
  }
  await out.endAsync();
  console.log(`Totals: packages.txt complete, ${current.length} packages.`);

  console.log('Totals: processing partials...');
  const available = await fs.readdirAsync(path.join(config.dir, 'partials/'));
  available.sort();
  console.log(`Totals: found ${available.length} partials.`);

  const filenames = ['files.txt', 'slim.files.txt'];
  for (const ext of extensions) {
    filenames.push(`files${ext}.txt`);
    filenames.push(`slim.files${ext}.txt`);
    filenames.push(`slim.code${ext}.txt`);
  }
  const streams = {};
  for (const file of filenames) {
    streams[file] = packedOut(path.join(outdir, file), config.extract.compress);
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
      await promiseEvent(stream);
    }
    built++;
    if (built % 10000 === 0) {
      console.log(`Totals: building ${built} / ${available.length}...`);
    }
  }
  const promises = [];
  for (const file of filenames) {
    if (config.extract.compress && streams[file].length === 0) {
      // lz4 fails on empty files for some reason
      streams[file].write('\n');
    }
    streams[file].end();
    promises.push(promiseEvent(streams[file]));
  }
  await Promise.all(promises);
  console.log(`Totals: built ${built} partials.`);

  if (config.extract.features.ast) {
    await totalsAST(available);
  }

  console.log(`Totals: done!`);
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
