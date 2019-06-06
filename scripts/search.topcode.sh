#!/bin/bash
echo grep -aE "$2" '"'"$1"'"'
lz4cat slim.topcode.1000.txt.lz4 | grep -aE $2 "$1"
