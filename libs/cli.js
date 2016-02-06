'use strict';

require('babel-polyfill');
const Promise = require('bluebird');

const commands = {
	parse: require('./parse'),
	stats: require('./stats'),
	update: require('./update')
};

async function main(argv) {
	argv.shift();
	if (argv.length > 0 && argv[0].endsWith('gzemnid.js')) {
		argv.shift();
	}
	if (argv.length === 0) {
		console.log(`No command specified!`);		
		process.exit();
	}
	const command = argv.shift();
	if (!commands.hasOwnProperty(command)) {
		console.log(`No such command: ${command}.`);
		process.exit();
	}
	commands[command].run();
}

main(process.argv);
