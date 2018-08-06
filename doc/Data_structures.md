# Data structures

All data files are stored inside the `./pool/` dir by default.

## byField.info.json

A huge JSON with basic metadata for all packages on npm. It is an array of entries, the JSON is formatted to be one entry per line.

Includes package name, basic user info, `latest` version number, npm version used to publish it, and a link to the `latest` version archive.

Example entry:
```json
{"id":"gzemnid-0.0.1","name":"gzemnid","version":"0.0.1","url":"https://github.com/ChALkeR/Gzemnid/issues","user":{"name":"chalker","email":"chalkerx@gmail.com"},"npm":"3.9.2","node":"6.2.0","tar":"http://registry.npmjs.org/gzemnid/-/gzemnid-0.0.1.tgz"},
```

Typical size — under 200 MiB, typical build time — about 2-3 minutes, depending on the download speed.
It requires downloading about 950 MiB (not stored) in order to build this file.

Created via `gzemnid fetch`.

_This file is required by most of the other commands, so updating any data should begin with re-downloading this file._

## stats.json

Contains downloads/month stats for all packages. It is an object from package name to downloads count, the JSON is formatted to be one entry per line.

Example entry:
```json
 "bluebird": 9739667,
```

Typical size — under 15 MiB.

Created via `gzemnid stats`.

Requires: `byField.info.json` (created automatically if not present).

## Directory: meta/

Contains files named `${package_name}-${package_version}.json` with more detailed package info obtained from the registry, including dependencies for each published version of the package.

One file per `${package_name}` is stored, only for the `latest` version. The JSON files are not formatted.

Example content: see <https://registry.npmjs.org/qmlweb>.

_Notice: these files are updated only on `latest` version releases, so they might become stale when it comes to beta releases._

Typical size with lz4 compression enabled (default) is about 4 GiB,
typical bootstrap time is quite long (should be under or about 10 hours),
but further updates are quite fast.

Created via `gzemnid meta`.

Requires: `byField.info.json` (created automatically if not present).

## Directory: current/

Contains `latest` versions of all packages, one file per package.

Files are named `${package_name}-${package_version}.tgz`.

Typical size is currently 215 GiB (and growing), typical bootstrap time depends on your internet
connection and time needed to download that amount of data, further updates are quite fast.

Created via `gzemnid packages`.

Requires: `byField.info.json` (created automatically if not present).

## Directory: deps/

### deps/deps.json

A json file with direct deps, as specified in `package.json`, for each version
of each package. Versions could link to each other in case of identical deps,
`_latest` tag is also included.

Example entry:
```json
"for-own": {
 "0.1.0": {"for-in":"^0.1.1"},
 "0.1.1": "0.1.0",
 "0.1.2": "0.1.0",
 "0.1.3": {"for-in":"^0.1.4"},
 "0.1.4": {"for-in":"^0.1.5"},
 "0.1.5": {"for-in":"^1.0.1"},
 "1.0.0": "0.1.5",
 "_latest": "1.0.0"
}
```

### deps/deps-resolved.json

A json file with resolved direct deps for each version of each package, and with
an indicator which version is `_latest`.

Example entry:
```json
"path-type": {
  "1.1.0": {"graceful-fs":"4.1.11","pify":"2.3.0","pinkie-promise":"2.0.1"},
  "2.0.0": {"pify":"2.3.0"},
  "3.0.0": {"pify":"3.0.0"},
  "_latest": "3.0.0"
}
```

### deps/deps-nested.json

A json file with nested deps (flattened), one per line, in format:

```json
"debug": ["debug@3.1.0","ms@2.0.0"]
```

Note that package itself is included in it's `_latest` version (entry point).

### deps/deps-nested.txt

A plain file with nested deps and package downloads/month, one per line, in format

```
79339925        debug: ["debug@3.1.0","ms@2.0.0"]
```

Sorted by downloads/month.
