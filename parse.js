const fs = require('fs');
const JSONStream = require('JSONStream');

// wget https://skimdb.npmjs.com/registry/_design/scratch/_view/byField -O byField.json
var stream = fs.createReadStream('byField.json').pipe(JSONStream.parse('rows.*'));
var out = fs.createWriteStream('byField.info.json');
out.write('[\n');

var count = 0;
stream.on('data', function(data) {
    if (data.id !== data.key || data.id !== data.value.name) {
        console.log('UNEXPECTED: ' + JSON.stringify({id: data.id, key: data.key, 'value.name': data.value.name}));
        //console.log('received:', data);
        return;
    }
    data = data.value;
    var info = {
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

stream.on('end', function() {
    console.log(count + '.');
    out.write('\n]\n');
    console.log('END');
});