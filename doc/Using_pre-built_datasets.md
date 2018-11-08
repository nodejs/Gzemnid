# Using pre-built datasets

If you want to just consume the datasets (instead of building them on your side)
and e.g. grep the patterns in the ecosystem usage, this page is for you.

You might also want to read [data structures](Data_structures.md) documentation
for more info, but that is not strictly required.

_Note: scoped packages are unsupported at the moment._

All data was built using Gzemnid and could be re-built on your side at any time,
this is the exact same data structures that Gzemnid produces, just pre-built and
hosted.

## Download

At the moment, the datasets are hosted at <https://gzemnid.nodejs.org/datasets/>,
grouped by the date when dataset build was started (i.e. when packages list was
synced).

For example, directory `out.2018-07-24/` has dataset which corresponds to the
registry state at `2018-07-24`.

You most likely do not need to download all the data — proceed below to find
out which exact files you need to perform a certain task.

Data is lz4-compressed. There is no need to decompress it, except for the case
when you need to use it elsewhere (most likely that would relate to only jsons).

## System requirements

You are expected to be running on a Unix shell with `lz4` installed (and some
standard tools, including `grep`, `sed`, and such).

## Example usecases

### Grep some regex query against top-downloaded packages

_Requires about 1 GiB on disk._

You need:
  * `slim.topcode.1000.txt.lz4` (which is ~1.2 GiB of data),
  * `search.topcode.sh` (basically a bash one-liner, you also can grep manually).

Usage: `./search.topcode.sh regexp` — that will pipe the results to stdout.

The output includes downloads/month numbers, sorted by download/months (desc),
and is limited to packages that have at least 1000 downloads per month.

That limitation is the main difference from the full code dataset (next section).

Also note that the output does not exclude tests and examples, if you want to
exclude that — grep it out by path manually.

Example:
```console
$ ./search.topcode.sh 'new Buffer\(' | head -5
grep -aE  "new Buffer\("
65080181        lodash-4.17.10.tgz/isBuffer.js:30: * _.isBuffer(new Buffer(2));
65080181        lodash-4.17.10.tgz/lodash.js:11397:     * _.isBuffer(new Buffer(2));
46243239        uuid-3.3.2.tgz/lib/md5.js:16:      bytes = new Buffer(bytes);
46243239        uuid-3.3.2.tgz/lib/md5.js:18:      bytes = new Buffer(bytes, 'utf8');
```

### Grep some regex query against all packages

_Requires about 11 GiB on disk._

You need:
  * `slim.code.js.txt.lz4` (roughly 11 GiB of data),
  * `slim.code.ts.txt.lz4` (roughly 350 MiB of data),
  * `slim.code.coffee.txt.lz4` (roughly 100 MiB of data),
  * `slim.code.mjs.txt.lz4` (roughly 15 MiB of data),
  * `search.code.sh` (basically a bash one-liner, you can also grep manually).

The data is sorted by filetype, then package name and file path.

Downloads/month are not included.

The main difference from the `topcode` variant (described above) is that this
one also includes packages with less than 1000 downloads per month.

If you do not need those, consider using `topcode` instead.

Example:
```console
$ ./search.code.sh 'require\(.sys.\)' | head -5
MiniMVC-0.0.1.tgz/minimvc.coffee:42:sys = require("sys")
N-0.1.0.tgz/src/examples/nog/app/posts.coffee:1:sys: require('sys')
activenode-monitor-0.0.4.tgz/storage.coffee:4:sys = require('sys')
beaconpush-0.1.0.tgz/spec/client-spec.coffee:5:sys = require('sys')
beanstalk_client-0.2.0.tgz/test/connect.coffee:1:sys: require('sys')
```

### Package download stats

`stats.jzon.lz4` (~6 MiB) is a lz4-compressed json file with all the download stats,
in downloads/month, sorted desc.

Uncompressed size is about 16 MiB.

Example:
```console
$ lz4cat stats.json.lz4 | head -5
{
 "supports-color": 85578705,
 "debug": 81468333,
 "readable-stream": 79442154,
 "kind-of": 77892645,
```

### Package chain-dependents

_Requires about 125 MiB on disk._

You need:
 * `deps-nested.txt.lz4` (roughly 125 MiB of data),
 * `depsdb.sh` (a bash one-liner for convenience).

Usage: `./depsdb.sh regexp`, where regexp is against `package@version"`
(note the trailing double quote).

The output includes the list of the packages, installing which (on the date
when the dataset was built) would end up installing the `package@version`
matched by the provided regexp, somewhere in the dependency tree.

The list is sorted by downloads/month (desc) and includes downloads/month.

Internally, `deps-nested.txt` of lines like this:
```
85578705        supports-color: ["has-flag@3.0.0","supports-color@5.4.0"]
81468333        debug: ["debug@3.1.0","ms@2.0.0"]
```

Each line corresponds to a single package with all it's nested dependencies —
i.e. every versions that would end up installed on the dataset build date if
one tried to install the latest version of the corresponding package.

Due to that, a single line could include different versions of a single package,
that means that `npm i` for that package would result in several versions of
some dependency being installed in the tree.

If you would want to search for `lodash@4.1.*`, use `lodash@4.\1\.`,
if you want to search for `lodash@4.17.1`, use `lodash@4\.17\.1"` to
exclude `4.17.10`. Never use `.*` or anything similar.

Example:
```console
$ ./depsdb.sh 'lodash@1\.[23]\.' | head -5
Query: "lodash@1\.[23]\.
39074   travis-ci
35632   swagger-node-express
21064   grunt-aws
13864   grunt-bower-install
```
