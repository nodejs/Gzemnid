'use strict';

const path = require('path');
const util = require('util');
const child_process = require('child_process');
const fs = require('../fs');
const config = require('../config').config;
const readline = require('readline');
const babylon = require('babylon');
const {
  readMap, readlines, promiseEvent, packedOut, packedIn
} = require('../helpers');

const execFile = util.promisify(child_process.execFile);

const extensions = [
  //'.php', '.json', '.txt',
  '.ts', '.coffee', '.js', '.mjs'
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

async function listTar(file) {
  const tar = await execFile(
    'tar',
    ['--list', '--warning=no-unknown-keyword', '-f', file],
    { maxBuffer: 50 * 1024 * 1024 }
  );
  return tar.stdout
    .split('\n')
    .filter(x => !!x)
    .filter(x => x !== 'package')
    .sort();
}

async function slimCode(ext, outdir, tgz, slim) {
  const outfile = path.join(outdir, `slim.code${ext}.txt`);
  const out = packedOut(outfile, config.extract.compress);
  const entries = slim.filter(entry => entry.endsWith(ext));
  for (const entry of entries) {
    const stream = fs.createReadStream(path.join(config.dir, 'tmp', entry));
    const resume = () => stream.resume();
    out.on('drain', resume);
    let num = 0;
    readline.createInterface({
      input: stream
    }).on('line', line => {
      num++;
      if (line.length > 500) return;
      if (!/[^\s]/.test(line)) return;
      const ready = out.write(`${entry}:${num}:${line}\n`);
      if (!ready) stream.pause();
    });
    await promiseEvent(stream, 'end');
    out.removeListener('drain', resume);
  }
  out.end();
  await promiseEvent(out, 'close');
}

function getAST(code, ext) {
  const density = code.length / code.split('\n').length;
  if (density > 200) {
    // This is probably a minified file
    return 'minified';
  }
  switch (ext) {
    case '.mjs':
      try {
        return babylon.parse(code, { sourceType: 'module' });
      } catch (e) { /* ignore */ }
      try {
        return babylon.parse(code);
      } catch (e) { /* ignore */ }
      break;
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
    const code = await fs.readFile(filepath, 'utf-8');
    const ast = getAST(code, ext);
    if (count !== 0) {
      out.write(',');
    }
    const ready = out.write(`\n ${JSON.stringify(entry)}: ${JSON.stringify(ast)}`);
    if (!ready) await promiseEvent(out, 'drain');
    count++;
  }
  out.write('\n}\n');
  out.end();
  await promiseEvent(out, 'close');
}

async function writeList(file, list) {
  const out = await packedOut(file, config.extract.compress);
  for (const line of list) {
    const ready = out.write(`${line}\n`);
    if (!ready) await promiseEvent(out, 'drain');
  }
  out.end();
  await promiseEvent(out, 'close');
}

async function copyFile(input, output) {
  if (config.extract.compress) {
    const stream = fs.createReadStream(input);
    const out = await packedOut(output, config.extract.compress);
    stream.pipe(out);
    await promiseEvent(out, 'close');
  } else {
    await fs.copyFile(input, output);
  }
}

async function partial(tgz, rebuild) {
  const file = path.join(config.dir, 'current/', tgz);
  const outfin = path.join(config.dir, 'partials/', tgz);
  const outdir = `${outfin}.tmp`;

  let files;

  if (rebuild) {
    try {
      files = await readlines(path.join(outfin, 'files.txt'));
    } catch (e) {
      // Just fall back to reading the tar
    }
  }

  await fs.rmrf(outfin);
  await fs.rmrf(outdir);
  await fs.mkdirp(outdir);

  if (!files) {
    const lines = await listTar(file);
    if (!lines.every(x => x.indexOf('/') !== -1)) {
      throw new Error('Package contains top-level files!');
    }
    files = lines.map(x => x.replace(/[^/]*\//, ''))
      .map(x => `${tgz}/${x}`);
    await writeList(path.join(outdir, 'files.txt'), files);
    // TODO: rebuild new extensions on extensions list changes
    for (const ext of extensions) {
      await writeList(
        path.join(outdir, `files${ext}.txt`),
        files.filter(entry => entry.endsWith(ext))
      );
    }
  }

  const excluded = await loadExcluded();
  const slim = files.filter(entry => !excluded.some(rexp => rexp.test(entry)));
  await writeList(path.join(outdir, 'slim.files.txt'), slim);
  for (const ext of extensions) {
    await writeList(
      path.join(outdir, `slim.files${ext}.txt`),
      slim.filter(entry => entry.endsWith(ext))
    );
  }

  const tmp = path.join(config.dir, 'tmp/', tgz);
  await fs.mkdirp(tmp);
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
  await execFile('tar', args, {
    cwd: tmp,
    stdio: 'ignore',
    maxBuffer: 50 * 1024 * 1024
  });

  // TODO: only if not exists
  await fs.chmod(path.join(tmp, 'package.json'), 0o644);
  await copyFile(
    path.join(tmp, 'package.json'),
    path.join(outdir, 'package.json')
  );

  for (const ext of extensions) {
    await slimCode(ext, outdir, tgz, slim);
  }

  if (config.extract.features.ast) {
    await slimAST('.js', outdir, tgz, slim);
  }

  await fs.rmrf(tmp);
  await fs.rename(outdir, outfin);
}

async function partials(subcommand, single) {
  if (subcommand && subcommand !== 'rebuild') {
    throw new Error(`Partials: unexpected command: ${subcommand}`);
  }
  const rebuild = subcommand === 'rebuild';
  await fs.mkdirp(path.join(config.dir, 'partials/'));
  console.log('Reading packages directory...');
  const current = await fs.readdir(path.join(config.dir, 'current/'));
  console.log('Reading partials directory...');
  const present = await fs.readdir(path.join(config.dir, 'partials/'));
  const currentSet = new Set(current);
  const presentSet = new Set(present);
  let removed = 0;
  for (const tgz of present) {
    if (single && tgz !== single) continue;
    if (currentSet.has(tgz)) continue;
    const dir = path.join(config.dir, 'partials', tgz);
    await fs.rmrf(dir);
    removed++;
    if (removed % 10000 === 0) {
      console.log(`Partials: removing ${removed}...`);
    }
  }
  console.log(`Partials: removed ${removed}.`);
  const tmp = path.join(config.dir, 'tmp/');
  await fs.rmrf(tmp);
  await fs.mkdirp(tmp);
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
      await fs.rmrf(path.join(config.dir, 'partials/', `${tgz}.tmp`));
      await fs.rmrf(path.join(config.dir, 'partials/', tgz));
      await fs.rmrf(path.join(config.dir, 'tmp/', tgz));
      continue;
    }
    built++;
    if (built % 10000 === 0) {
      console.log(`Partials: building ${built} / ${total - errors}...`);
    }
  }
  console.log(`Partials: built ${built}, errors: ${errors}.`);
  await fs.rmrf(tmp);
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
      const out = streams[file];
      const stream = packedIn(path.join(tgzdir, file), config.extract.compress);
      const resume = () => stream.resume();
      out.on('drain', resume);
      readline.createInterface({
        input: stream
      }).on('line', line => {
        if (line === '{' || line === '}') return;
        out.write(out.length === 1 ? '\n' : ',\n');
        const ready = out.write(line.endsWith(',') ? line.slice(0, -1) : line);
        if (!ready) stream.pause();
      });
      await promiseEvent(stream, 'end');
      out.removeListener('drain', resume);
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
    promises.push(promiseEvent(streams[file], 'close'));
  }
  await Promise.all(promises);
}

async function totals() {
  console.log('Totals: cleaning up...');
  const outdir = path.join(config.dir, 'out/');
  await fs.rmrf(outdir);
  await fs.mkdirp(outdir);

  {
    console.log('Totals: building packages list...');
    const current = await fs.readdir(path.join(config.dir, 'current/'));
    current.sort();
    const file = 'packages.txt';
    const out = packedOut(path.join(outdir, file), config.extract.compress);
    for (const tgz of current) {
      out.write(`${tgz}\n`);
    }
    out.end();
    await promiseEvent(out, 'close');
    console.log(`Totals: ${file} complete, ${current.length} packages.`);
  }

  console.log('Totals: processing partials...');
  const available = await fs.readdir(path.join(config.dir, 'partials/'));
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
      const out = streams[file];
      const filepath = path.join(tgzdir, file);
      const stream = packedIn(filepath, config.extract.compress);
      stream.pipe(out, { end: false });
      try {
        await promiseEvent(stream, 'end');
      } catch (e) {
        console.log(`Error while processing ${tgz}/${file}: ${e}`);
        throw e;
      }
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
    promises.push(promiseEvent(streams[file], 'close'));
  }
  await Promise.all(promises);
  console.log(`Totals: processed ${built} partials.`);

  if (config.extract.features.ast) {
    await totalsAST(available);
  }

  console.log('Totals: done!');
}

// TODO:
//  * Remove tests/exmaples: grep -vE '(/(te?sts?|spec|examples?)(/.*)?|[.-]test)\.(js|coffee|ts):'
//  * Remove lines that are clearly comments: grep -vE '\.(js|coffee|ts):[0-9]+:\s*//'
//  * Warn on missing partials
async function topcode(arg = 1000) {
  const limit = parseInt(arg, 10);
  console.log(`Topcode: building code from packages with >= ${limit} d/m...`);

  console.log('Topcode: processing partials...');
  const available = await fs.readdir(path.join(config.dir, 'partials/'));
  console.log(`Topcode: found ${available.length} partials.`);

  console.log('Topcode: reading stats.json...');
  const info = await readMap('stats.json');
  console.log(`Topcode: found ${info.size} packages in stats.`);

  console.log('Topcode: filtering partials...');
  const regex = /^(.*)[-@](v?\d+\.\d+\.\d+.*?)\.tgz$/;
  const packages = available.map(tgz => {
    const match = tgz.match(regex);
    if (!match) throw new Error(`Unrecognized name: ${tgz}`);
    const name = match[1];
    const dm = info.get(name);
    return { tgz, name, dm };
  }).filter(({ dm }) => dm > limit);
  console.log('Topcode: sorting partials...');
  packages.sort((a, b) => {
    if (a.dm && !b.dm) return -1;
    if (b.dm && !a.dm) return 1;
    if (a.dm > b.dm) return -1;
    if (b.dm > a.dm) return 1;
    if (a.name > b.name) return 1;
    if (b.name > a.name) return -1;
    return 0;
  });
  console.log(`Topcode: prepared ${packages.length} partials...`);

  console.log('Topcode: starting...');
  const outdir = path.join(config.dir, 'out/');
  const outfile = path.join(outdir, `slim.topcode.${limit}.txt`);
  await fs.rmrf(outfile);
  await fs.mkdirp(outdir);

  const out = packedOut(outfile, config.extract.compress);
  let built = 0;
  for (const { tgz, dm } of packages) {
    const tgzdir = path.join(config.dir, 'partials/', tgz);
    for (const ext of extensions) {
      const filepath = path.join(tgzdir, `slim.code${ext}.txt`);
      const stream = packedIn(filepath, config.extract.compress);
      const resume = () => stream.resume();
      out.on('drain', resume);
      readline.createInterface({
        input: stream
      }).on('line', line => {
        const ready = out.write(`${dm}\t${line}\n`);
        if (!ready) stream.pause();
      });
      await promiseEvent(stream, 'end');
      out.removeListener('drain', resume);
    }
    built++;
    if (built % 100 === 0) {
      console.log(`Topcode: building ${built} / ${packages.length}...`);
    }
  }
  out.end();
  await promiseEvent(out, 'close');

  console.log(`Topcode: processed ${built} partials.`);
  console.log('Topcode: done!');
}

async function run() {
  await partials();
  await totals();
}

module.exports = {
  run,
  partials,
  topcode,
  totals
};
