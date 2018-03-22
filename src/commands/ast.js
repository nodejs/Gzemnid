'use strict';

const path = require('path');
const config = require('../config').config;
const { packedIn, jsonStream } = require('../helpers');

async function execute(script, ext = '.js') {
  const process = require(path.resolve(script));
  const filepath = path.join(config.dir, `out/slim.ast${ext}.json`);
  const input = packedIn(filepath, config.extract.compress);
  const stream = jsonStream(input, '$*');
  await process(stream);
}

module.exports = {
  execute
};
