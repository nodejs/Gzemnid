'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const util = require('util');
const child_process = require('child_process');

const execFile = util.promisify(child_process.execFile);

async function rmrf(dir) {
  await execFile('rm', ['-rf', dir]);
}

module.exports = {
  ...fsp,
  rmrf,
  createReadStream: fs.createReadStream,
  createWriteStream: fs.createWriteStream,
  mkdirp: (arg) => fsp.mkdir(arg, { recursive: true })
};
