'use strict';

const path = require('path');
const configManager = require('./config');

const commands = {
  ast: require('./commands/ast'),
  code: require('./commands/code'),
  server: require('./commands/server'),
  fetch: require('./commands/fetch'),
  sync: require('./commands/sync'),
  meta: require('./commands/meta'),
  depsdb: require('./commands/depsdb'),
  stats: require('./commands/stats'),
  extract: require('./commands/extract'),
  packages: require('./commands/packages')
};

async function main(argv) {
  await configManager.load();
  argv.shift();
  if (argv.length > 0 && path.basename(argv[0], '.js') === 'gzemnid') {
    argv.shift();
  }
  if (argv.length === 0) {
    throw new Error('No command specified!');
  }
  const command = argv.shift();
  if (!commands.hasOwnProperty(command)) {
    throw new Error(`No such command: ${command}.`);
  }
  const method = argv.length > 0 ? argv.shift() : 'run';
  if (!commands[command][method]) {
    throw new Error(`No such method of command ${command}: ${method}.`);
  }
  return commands[command][method](...argv);
}

process.on('exit', () => {
  console.error(`RSS: ${process.memoryUsage().rss / (2 << 20)} MiB`);
});
process.on('SIGPIPE', () => process.exit());
process.on('SIGTERM', () => process.exit());
process.on('unhandledRejection', err => {
  throw err;
});

main(process.argv).catch(e => console.error(e.stack));
