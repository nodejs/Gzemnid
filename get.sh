#!/bin/bash
rm -f byField.json
wget https://skimdb.npmjs.com/registry/_design/scratch/_view/byField -O byField.json
node parse.js
node update.js
