# Gzemnid

Notice: some commands might require `--max-old-space-size=2000` or above.

## Data structures

All data files are stored inside the `./pool/` dir by default.

### byField.info.json

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

### stats.json

Contains downloads/month stats for all packages. It is an object from package name to downloads count, the JSON is formatted to be one entry per line.

Example entry:
```json
 "bluebird": 9739667,
```

Typical size — under 15 MiB.

Created via `gzemnid stats`.

Requires: `byField.info.json` (created automatically if not present).

### Directory: meta/

Contains files named `${package_name}-${package_version}.json` with more detailed package info obtained from the registry, including dependencies for each published version of the package.

One file per `${package_name}` is stored, only for the `latest` version. The JSON files are not formatted.

Example content: see <https://registry.npmjs.org/qmlweb>.

_Notice: these files are updated only on `latest` version releases, so they might become stale when it comes to beta releases._

Typical size is about 11 GiB, typical bootstrap time is quite long (could even take a day or two), but further updates are quite fast.

Created via `gzemnid meta`.

Requires: `byField.info.json` (created automatically if not present).

### Directory: current/

Contains `latest` versions of all packages, one file per package.

Files are named `${package_name}-${package_version}.tgz`.

Typical size is currently 215 GiB (and growing), typical bootstrap time depends on your internet connection, further updates are quite fast.

Created via `gzemnid packages`.

Requires: `byField.info.json` (created automatically if not present).

### Directory: deps/

#### deps/deps.json

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

#### deps/deps-resolved.json

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

#### deps/deps-nested.json

A json file with nested deps (flattened), one per line, in format:

```json
"debug": ["debug@3.1.0","ms@2.0.0"]
```

Note that package itself is included in it's `_latest` version (entry point).

#### deps/deps-nested.txt

A plain file with nested deps and package downloads/month, one per line, in format

```
79339925        debug: ["debug@3.1.0","ms@2.0.0"]
```

## Commands

The main script is invoked as `gzemnid command [subcommand]` (or `./gzemnid.js command [subcommand]`),
where `[subcommand]` is optional.

Here is the list of the current commands:
  * `gzemnid fetch` — builds `byField.info.json`.
    _Should take about 2 minutes._
  * `gzemnid stats` — runs subcommand `rebuild`.
    * `gzemnid stats rebuild` — rebuilds `stats.json`, downloading stats for all packages present in `byField.info.json`.
    * `gzemnid stats update` — updates `stats.json` for only newly added packages, keeping the numbers for already present packages.
  * `gzemnid meta` — builds `meta/` directory, downloading meta info for all packages present in `byField.info.json`. Outdated files that were present in the `meta/` directory are moved to `meta.old/`.
  * `gzemnid depsdb` — runs subcommands `plain`, `resolved`, `nested`, `stats`,
    * `gzemnid depsdb plain` — builds `deps/deps.json`. Requires `meta/` dir contents.
    * `gzemnid depsdb resolved` — builds `deps/deps-resolved.json`. Requires `deps/deps.json`.
    * `gzemnid depsdb nested` — builds `deps/deps-nested.json`.
      Requires `stats.json` and `deps/deps-resolved.json`.
      _Should take about 6 minutes._
    * `gzemnid depsdb stats` — builds `deps/deps-nested.txt`.
      Requires `stats.json` and `deps/deps-nested.json`.
      _Should take about 30 seconds._
  * `gzemnid packages` — builds `current/` directory, downloading `latest` versions for all packages present in `byField.info.json`. Outdated files that were present in the `current/` directory are moved to `outdated/`.
  * `gzemnid extract` — runs subcommands `partials`, `totals`,
    * `gzemnid extract partials` —
    * `gzemnid extract totals` —
  * `gzemnid code search {regex}` — performs a code search over a specified regular expression using the pre-built dataset.
  * `gzemnid ast execute {file.js}` — performs an AST search using the pre-built dataset. Example script — in `examples/ast_status.js`, execute with `gzemnid ast execute ./examples/ast_status.js`,
  * `gzemnid server` — starts the web server providing the search API endpoints.

Times are given for reference, could depend significantly on the internet connection speed and/or
CPU speed, and increase over time with npm registry growth.

## Server

_TODO: document server._

Started via `gzemnid server`.

## Deception

Note: think twice before relying on the data obtained from Gzemnid or using it to decide on something.

Code search has both false negatives and false positives — some files are ignored, some files are unused, and some lines could be in a middle of a comment block. Also, your regexps are never ideal.

AST tree also ignores a list of excluded files and directories and minified code and includes unused code and files if those are present in the package for some reason.

Downloads/month are not equal to popularity, and you can't see which version is being used.

Code and AST search, among other things, takes only `latest` released package versions into an account. That could be significantly different from `master`, beta branches, also older versions could be much more popular that `latest`.

All datasets get out of date the moment you build them.

Scoped packages are ignored completely.

Gzemnid deceives you, keep that in mind.
But it's still better than nothing.
