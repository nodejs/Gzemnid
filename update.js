const fs = require('fs');
const JSONStream = require('JSONStream');

var stream = fs.createReadStream('byField.info.json').pipe(JSONStream.parse('*'));
var out = {
	mv_ex: fs.createWriteStream('update.mv.ex.txt'),
	mv: fs.createWriteStream('update.mv.txt'),
	wget: fs.createWriteStream('update.wget.txt')
};

var current = fs.readdirSync('../current/');
var map = new Map();
current.forEach(function(file) {
	map.set(file, false);
});

var broken = new Set();
fs.readFileSync('./brokenurls.txt').toString('utf-8').split('\n').forEach(function(entry) {
	if (entry.length === 0)
		return;
	broken.add(entry);
});

var blacklist = new Set();
fs.readFileSync('./blacklist.txt').toString('utf-8').split('\n').forEach(function(entry) {
	if (entry.length === 0)
		return;
	blacklist.add(entry);
});

var count = 0;
var updated = 0;
stream.on('data', function(info) {
	if (!info.tar) {
		console.log(info.id + ': no tar!');
		return;
	}

	var url = info.tar.replace('http://', 'https://');
	var file = url.replace('https://registry.npmjs.org/' + info.name + '/-/', '');
	if (file.replace(/[@0v-]/g, '') !== info.id.replace(/[@0v-]/g, '') + '.tgz') {
		console.log(info.id + ': bad tar - ' + info.tar);
		return;
	}
	if (broken.has(url)) {
		//console.log(info.id + ': known broken url, tar - ' + info.tar);
		return;
	}
	if (blacklist.has(file) || blacklist.has(url) || blacklist.has(info.id) || file.endsWith('-0.0.0-reserved.tgz')) {
		console.log(info.id + ': blacklist hit, tar - ' + info.tar);
		return;
	}
	if (!map.has(file)) {
		out.wget.write('wget -nc "' + url + '"\n');
		updated++;
	}
    
	map.set(file, true);
	count++;
	if (count % 1000 === 0) {
		console.log(count + '...');
	}
});

stream.on('end', function() {
	console.log('Total: ' + count + '.');
	console.log('New/updated: ' + updated + '.');
	var moved = 0;
	map.forEach(function(status, file) {
		if (status === false) {
			out.mv.write('mv "' + file + '" ../outdated/\n');
			out.mv_ex.write('mv "' + file + '" ../outdated.ex/\n');
			moved++;
		}
	});
	console.log('Moved: ' + moved + '.');
	console.log('END');
});