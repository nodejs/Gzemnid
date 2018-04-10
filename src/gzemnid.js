'use strict';

const configManager = require('./config');

const commands = {
  ast: require('./commands/ast'),
  code: require('./commands/code'),
  server: require('./commands/server'),
  fetch: require('./commands/fetch'),
  meta: require('./commands/meta'),
  depsdb: require('./commands/depsdb'),
  stats: require('./commands/stats'),
  extract: require('./commands/extract'),
  packages: require('./commands/packages')
};

function getUsageMessage() {
  const cmdMessages = [
    { cmd: 'fetch', desc: 'build byField.info.json' },
    { cmd: 'stats', desc: '[rebuild|update]: rebuild or update stats.json, default rebuild' },
    { cmd: 'meta', desc: 'build meta/' },
    { cmd: 'debsdb', desc: '[plain|resolved|nested|stats]: invoke in succession ' +
    ' to build up debsdp in stages, default will run all' },
    { cmd: 'packages', desc: 'build current/' },
    { cmd: 'extract', desc: '[partials|totals]: invoke in succession to XXX, default to XXX' },
    { cmd: 'code search', desc: '{regex}: search code for lines matching this regex' },
    { cmd: 'ast execute', desc: '{file.js}: walk all ASTs and apply code in this file' },
    { cmd: 'server', desc: 'start web server' }
  ];

  let usageMessage = 'Usage: gzemnid COMMMAND';
  cmdMessages.forEach(m => {
    usageMessage += `\n  ${m.cmd}: ${m.desc}`;
  });

  return usageMessage;
}

async function main(argv) {
  await configManager.load();

  argv.shift(); // Discard 'node'
  if (argv.length > 0 && argv[0].endsWith('gzemnid.js')) { // Discard 'gzemnid.js'
    argv.shift();
  }

  // Need usage?
  if (argv.length === 0) {
    throw new Error(getUsageMessage());
  }

  // Invalid command?
  const command = argv.shift();
  if (!commands.hasOwnProperty(command)) {
    throw new Error(`No such command: ${command}.`);
  }
  const method = argv.length > 0 ? argv.shift() : 'run';
  if (!commands[command][method]) {
    throw new Error(`No such method of command ${command}: ${method}.`);
  }
  // Valid command.

  //Set global event handlers.
  process.on('exit', () => {
    console.error(`RSS: ${process.memoryUsage().rss / (2 << 20)} MiB`);
  });
  process.on('SIGPIPE', () => process.exit());
  process.on('SIGTERM', () => process.exit());

  commands[command][method](...argv);
}

main(process.argv).catch(e => console.error(e.stack));
