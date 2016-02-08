'use strict';

const fs = require('fs');
const bhttp = require('bhttp');
const JSONStream = require('JSONStream');
const path = require('path');
const config = require('./config').config;

const registryUrl = 'https://skimdb.npmjs.com/registry/_design/scratch/_view/byField';

async function run() {
	const source = await bhttp.get(registryUrl, {stream: true});
	const stream = source.pipe(JSONStream.parse('rows.*'));

	const out = fs.createWriteStream(path.join(config.dir, 'byField.info.json'));
	out.write('[\n')

	let count = 0;
	stream.on('data', (data) => {
		if (data.id !== data.key || data.id !== data.value.name) {
			console.log('UNEXPECTED: ' + JSON.stringify({
				id: data.id,
				key: data.key,
				'value.name': data.value.name
			}));
			//console.log('received:', data);
			return;
		}
		data = data.value;
		const info = {
			id: data.name + '-' + data.version,
			name: data.name,
			version: data.version,
			url: data.bugs && data.bugs.url || data.homepage || data.repository && data.repository.url || null,
			user: data._npmUser,
			npm: data._npmVersion,
			node: data._nodeVersion,
			tar: data.dist.tarball
		};

		if (count > 0) {
			out.write(',\n');
		}
		out.write(JSON.stringify(info));

		count++;
		if (count % 1000 === 0) {
			console.log(count + '...');
		}
	});

	stream.on('end', () => {
		console.log(count + '.');
		out.write('\n]\n');
		console.log('END');
	});
}

module.exports = {
	run
};
