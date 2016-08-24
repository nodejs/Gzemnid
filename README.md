# Gzemnid

*TODO: document things.*

## Data structures

All data files are stored inside the `./pool/` dir by default.

### `byField.info.json`

A huge JSON with basic metadata for all packages on npm. It is an array of entries, the JSON is formatted to be one entry per line.

Includes package name, basic user info, `latest` version number, npm version used to publish it, and a link to the `latest` version archive.

Example entry:
```json
{"id":"gzemnid-0.0.1","name":"gzemnid","version":"0.0.1","url":"https://github.com/ChALkeR/Gzemnid/issues","user":{"name":"chalker","email":"chalkerx@gmail.com"},"npm":"3.9.2","node":"6.2.0","tar":"http://registry.npmjs.org/gzemnid/-/gzemnid-0.0.1.tgz"},
```

Typical size — under 100 MiB, typical build time — 1-5 minutes, depending on the download speed.
It requires downloading about 500 MiB (not stored) in order to build this file.

Created via `gzemnid fetch`.

## Commands

The main script is invoked as `gzemnid command [subcommand]` (or `./gzemnid.js command [subcommand]`),
where `[subcommand]` is optional.

Here is the list of the current commands:
  * `gzemnid fetch` — builds `byField.info.json`.
  * `gzemnid stats` — runs subcommand `rebuild`.
    * `gzemnid stats rebuild` —
    * `gzemnid stats update` —
  * `gzemnid meta` —
  * `gzemnid depsdb` — runs subcommands `plain`, `resolved`, `nested`,
    * `gzemnid depsdb plain` —
    * `gzemnid depsdb resolved` —
    * `gzemnid depsdb nested` —
    * `gzemnid depsdb stats` —
  * `gzemnid packages` —
  * `gzemnid extract` — runs subcommands `partials`, `totals`,
    * `gzemnid extract partials` —
    * `gzemnid extract totals` —
  * `gzemnid server` —
