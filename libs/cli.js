'use strict';

const configManager = require('./config');

const commands = {
  server: require('./commands/server'),
  fetch: require('./commands/fetch'),
  meta: require('./commands/meta'),
  depsdb: require('./commands/depsdb'),
  stats: require('./commands/stats'),
  update: require('./commands/update')
};

async function main(argv) {
  await configManager.load();
  argv.shift();
  if (argv.length > 0 && argv[0].endsWith('gzemnid.js')) {
    argv.shift();
  }
  if (argv.length === 0) {
    throw new Error('No command specified!');
  }
  const command = argv.shift();
  if (!commands.hasOwnProperty(command)) {
    throw new Error(`No such command: ${command}.`);
  }
  commands[command].run();
}

main(process.argv).catch(e => console.error(e.stack));
