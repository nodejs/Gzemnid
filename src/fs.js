'use strict';

const fs = require('fs');
const util = require('util');
const child_process = require('child_process');
const mkdirp = require('mkdirp');

const execFile = util.promisify(child_process.execFile);

async function rmrf(dir) {
  await execFile('rm', ['-rf', dir]);
}

module.exports = {
  rmrf,
  chmod: util.promisify(fs.chmod),
  copyFile: util.promisify(fs.copyFile),
  createReadStream: fs.createReadStream,
  createWriteStream: fs.createWriteStream,
  stat: util.promisify(fs.stat),
  rename: util.promisify(fs.rename),
  readdir: util.promisify(fs.readdir),
  readFile: util.promisify(fs.readFile),
  writeFile: util.promisify(fs.writeFile),
  unlink: util.promisify(fs.unlink),
  mkdirp: util.promisify(mkdirp)
};
