'use strict';

const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const bhttp = require('bhttp');
const JSONStream = require('JSONStream');
const path = require('path');
const config = require('./config').config;

const endpoint = 'https://api.npmjs.org/downloads/point/last-month/';
const grouplimit = 8000;
const session = bhttp.session({
	headers: {
		'user-agent': 'Gzemnid http://oserv.org/npm/Gzemnid/'
	}
});

function buildMap(data) {
	const map = new Map();
	Object.keys(data).forEach(function(file) {
		map.set(file, false);
	});
	return map;
}

// We could use the stream directly, but then we won't receive nice stats beforehand.
function getGroups(map) {
	const stream = fs.createReadStream(path.join(config.dir, 'byField.info.json')).pipe(JSONStream.parse('*'));

	const deferred = Promise.pending();
	const groups = [];
	let group = [];
	let groupLength = -1;
	let total = 0, needed = 0;

	stream.on('data', (info) => {
		let name = info.name;
		total++;
		if (total % 10000 === 0) {
			console.log(`Reading: ${total}...`);
		}
		if (map.has(name)) return;
		needed++;
		if (groupLength > 0 && (groupLength + 1 + name.length) >= grouplimit) {
			groups.push(group);
			group = [];
			groupLength = -1;
		}
		groupLength += 1 + name.length;
		group.push(name);
		map.set(name, true);
	});
	stream.on('end', () => {
		groups.push(group);
		deferred.resolve({groups, total, needed});
		console.log(`Total: ${total}, neededed: ${needed}.`);
	});

	return deferred.promise;
}

async function run() {
	const file = path.join(config.dir, 'stats.json');
	const data = await fs.readFileAsync(file)
		.then(JSON.parse)
		.catch(() => {
			return {};
		});

	const map = buildMap(data);
	const {groups, total, needed} = await getGroups(map);

	let requested = 0;
	let processed = 0;
	for (let i = 0; i < groups.length; i++) {
		let group = groups[i];
		requested += group.length;
		console.log(`Request size: ${group.length}, total requested: ${requested}/${needed}.`);
		let res = await session.get(endpoint + group.join(','));
		if (res.statusCode !== 200) {
			throw Error(`[npm API] ${res.statusCode}: ${res.statusMessage}`);
		}
		let body = res.body;
		Object.keys(body).forEach(function(name) {
			processed++;
			if (name !== body[name].package) {
				console.log(`${name}: bad package name: ${body[name].package}!`);
			}
			data[name] = body[name].downloads;
		});
		console.log(`Processed: ${processed}/${needed}, saved: ${processed + total - needed}/${total}.`);
		await fs.writeFileAsync(file, JSON.stringify(data, undefined, 1));
	}
}

module.exports = {
	run
};
