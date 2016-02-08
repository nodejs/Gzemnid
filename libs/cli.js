'use strict';

const config = require('./config').config;
const configManager = require('./config');

const commands = {
	fetch: require('./fetch'),
	stats: require('./stats'),
	update: require('./update')
};

async function main(argv) {
	await configManager.load();
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

main(process.argv).catch(e => console.log(e));
