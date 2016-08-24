# Gzemnid

## Data structures

All data files are stored inside the `./pool/` dir by default.

### byField.info.json

A huge JSON with basic metadata for all packages on npm. It is an array of entries, the JSON is formatted to be one entry per line.

Includes package name, basic user info, `latest` version number, npm version used to publish it, and a link to the `latest` version archive.

Example entry:
```json
{"id":"gzemnid-0.0.1","name":"gzemnid","version":"0.0.1","url":"https://github.com/ChALkeR/Gzemnid/issues","user":{"name":"chalker","email":"chalkerx@gmail.com"},"npm":"3.9.2","node":"6.2.0","tar":"http://registry.npmjs.org/gzemnid/-/gzemnid-0.0.1.tgz"},
```

Typical size — under 100 MiB, typical build time — 1-5 minutes, depending on the download speed.
It requires downloading about 500 MiB (not stored) in order to build this file.

Created via `gzemnid fetch`.

_This file is required by most of the other commands, so updating any data should begin with re-downloading this file._

### stats.json

Contains downloads/month stats for all packages. It is an object from package name to downloads count, the JSON is formatted to be one entry per line.

Example entry:
```json
 "bluebird": 9739667,
```

Typical size — under 10 MiB.

Created via `gzemnid stats`.

Requires: `byField.info.json`.

### Directory: meta/

Contains files named `${package_name}-${package_version}.json` with more detailed package info obtained from the registry, including dependencies for each published version of the package.

One file per `${package_name}` is stored, only for the `latest` version. The JSON files are not formatted.

Example content: see <https://registry.npmjs.org/qmlweb>.

_Notice: these files are updated only on `latest` version releases, so they might become stale when it comes to beta releases._

Typical size is about 4 GiB, typical bootstrap time is quite long (could even take a day or two), but further updates are quite fast.

Created via `gzemnid meta`.

Requires: `byField.info.json`.

### Directory: current/

Contains `latest` versions of all packages, one file per package.

Files are named `${package_name}-${package_version}.tgz`.

Typical size is currently 80 GiB (and growing), typical bootstrap time depends on your internet connection, further updates are quite fast.

Created via `gzemnid packages`.

Requires: `byField.info.json`.

## Commands

The main script is invoked as `gzemnid command [subcommand]` (or `./gzemnid.js command [subcommand]`),
where `[subcommand]` is optional.

Here is the list of the current commands:
  * `gzemnid fetch` — builds `byField.info.json`.
  * `gzemnid stats` — runs subcommand `rebuild`.
    * `gzemnid stats rebuild` — rebuilds `stats.json`, downloading stats for all packages present in `byField.info.json`.
    * `gzemnid stats update` — updates `stats.json` for only newly added packages, keeping the numbers for already present packages.
  * `gzemnid meta` — builds `meta/` directory, downloading meta info for all packages present in `byField.info.json`.
  * `gzemnid depsdb` — runs subcommands `plain`, `resolved`, `nested`,
    * `gzemnid depsdb plain` —
    * `gzemnid depsdb resolved` —
    * `gzemnid depsdb nested` —
    * `gzemnid depsdb stats` —
  * `gzemnid packages` —
  * `gzemnid extract` — runs subcommands `partials`, `totals`,
    * `gzemnid extract partials` —
    * `gzemnid extract totals` —
  * `gzemnid server` — starts the web server providing the search API endpoints.

## Server

_TODO: document server._

Started via `gzemnid server`.
