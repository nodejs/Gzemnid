# Using pre-built datasets

If you want to just consume the datasets (instead of building them on your side)
and e.g. grep the patterns in the ecosystem usage, this page is for you.

You might also want to read [data structures](Data_structures.md) documentation,
for more info, but that is not strictly required.

## Location

At the moment, the datasets are hosted at <http://gzemnid.oserv.org/datasets/>,
grouped per day of the dataset build start time (i.e. when packages list was
synced)

For example, directory `out.2018-07-24/` has dataset which corresponds to the
registry state at `2018-07-24`.

Data is lz4-compressed. There is no need to decompress it, except for the case
when you need to use it elsewhere (most likely that would relate to only jsons).

## System requirements

You are expected to be running on a Unix shell with `lz4` installed (and some
standard tools, including `grep`, `sed`, and such).
