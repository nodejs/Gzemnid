const fs = require('fs');
const JSONStream = require('JSONStream');
var request = require('sync-request');

var stream = fs.createReadStream('byField.info.json').pipe(JSONStream.parse('*'));

var data = fs.existsSync('stats.json') ? require('./stats.json') : {};
var map = new Map();
Object.keys(data).forEach(function(file) {
	map.set(file, false);
});


var count = 0;
var updated = 0;

var grouplimit = 7940;

var group = [];
function get() {
	var res = request('GET', 'https://api.npmjs.org/downloads/point/last-month/' + group.join(','), {
		'headers': {
			'user-agent': 'Gzemnid http://oserv.org/npm/Gzemnid/'
		}
	});
	res = JSON.parse(res.getBody('utf8'));
	console.log(' request size: ' + group.length);
	Object.keys(res).forEach(function(name) {
		if (name !== res[name].package) {
			console.log(name + ': bad package name' + res[name].package);
		}
		data[name] = res[name].downloads;
	});
	group = [];
	fs.writeFileSync('stats.json', JSON.stringify(data, undefined, 1));
}
stream.on('data', function(info) {
	count++;
	if (map.has(info.name)) {
		return;
	}
	var ngroup = group;
	ngroup.push(info.name);
	if (group.length > 0 && ngroup.join(',').length >= grouplimit) {
		get();
	}
	group.push(info.name);
	map.set(info.name, true);
	if (count % 1000 === 0) {
		console.log(count + '...');
	}
});

stream.on('end', function() {
	get();
	console.log('Total: ' + count + '.');
	console.log('New/updated: ' + updated + '.');
	console.log('END');
});
