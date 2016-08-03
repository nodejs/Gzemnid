'use strict';
const child_process = require('child_process');

const config = require('./config').config;
const Queue = require('./queue');

const queue = new Queue(3);

async function spawn(command, args = [], options = {}) {
  const done = await queue.claim();

  options = Object.assign(
    {
      cwd: config.code.path,
      env: {},
      stdio: ['ignore', 'pipe', 'ignore']
    },
    options
  );
  if (config.code.uid !== null) {
    options.uid = config.code.uid;
  }
  if (config.code.gid !== null) {
    options.gid = config.code.gid;
  }
  const child = child_process.spawn(command, args, options);
  child.on('exit', done);
  return child;
}

async function code(query, languages = null) {
  const args = ['--no-filename', '-E', query];

  if (!query) {
    throw new Error('Empty query.');
  }

  if (!languages) {
    languages = null;
  } else if (typeof languages === 'string') {
    languages = languages.split(',');
  }

  for (const ext of config.code.extensions) {
    if (!languages || languages.indexOf(ext)) {
      args.push(`slim.code.${ext}.lzo`);
    }
  }

  return await spawn('lzgrep', args);
}

module.exports = {
  code,
  queue
};
