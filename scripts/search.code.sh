#!/bin/bash
(lz4cat slim.code.mjs.txt.lz4; lz4cat slim.code.coffee.txt.lz4; lz4cat slim.code.ts.txt.lz4; lz4cat slim.code.js.txt.lz4) | grep -aE "$1" 
