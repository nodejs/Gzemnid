# Gzemnid

Notice: some commands might require `--max-old-space-size=2000` or above.

## Using pre-built datasets

See documentation on [Using pre-built datasets](/doc/Using_pre-built_datasets.md) page.

## Data structures

All data files are stored inside the `./pool/` dir by default.

See documentation on [Data structures](/doc/Data_structures.md) page.

## Commands

The main script is invoked as `gzemnid command [subcommand]` (or `./gzemnid.js command [subcommand]`),
where `[subcommand]` is optional.

Here is the list of the current commands:
  * `fetch` — builds `byField.info.json`.
    _Should take about 2 minutes._
    * `fetch run byField.json` — builds `byField.info.json` locally without network connection,
      but you need to download `byField.json` manually from the registry to run that.
  * `stats` — runs subcommand `rebuild`.
    * `stats rebuild` — rebuilds `stats.json`, downloading stats for all packages present in
      `byField.info.json`. _Should take about 25 minutes._
    * `stats update` — updates `stats.json` for only newly added packages, keeping the numbers for
      already present packages.
  * `meta` — builds `meta/` directory, downloading meta info for all packages present in
    `byField.info.json`. Outdated files that were present in the `meta/` directory are moved to
    `meta.old/`.
  * `depsdb` — runs subcommands `plain`, `resolved`, `nested`, `stats`,
    * `depsdb plain` — builds `deps/deps.json`. Requires `meta/` dir contents.
    * `depsdb resolved` — builds `deps/deps-resolved.json`. Requires `deps/deps.json`.
    * `depsdb nested` — builds `deps/deps-nested.json`.
      Requires `stats.json` and `deps/deps-resolved.json`.
      _Should take about 6 minutes._
    * `depsdb stats` — builds `deps/deps-nested.txt`.
      Requires `stats.json` and `deps/deps-nested.json`.
      _Should take about 30 seconds._
  * `packages` — builds `current/` directory, downloading `latest` versions for all packages present
    in `byField.info.json`. Outdated files that were present in the `current/` directory are moved
    to `outdated/`.
  * `extract` — runs subcommands `partials`, `totals`,
    * `extract partials` —
    * `extract totals` —
  * `code search {regex}` — performs a code search over a specified regular expression using the
    pre-built dataset.
  * `ast execute {file.js}` — performs an AST search using the pre-built dataset. Example script
    is located in `examples/ast_status.js`, run with `gzemnid ast execute ./examples/ast_status.js`.
  * `server` — starts the web server providing the search API endpoints.

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
