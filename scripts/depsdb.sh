#!/bin/bash
echo 'Query: "'"$1"
lz4cat deps-nested.txt.lz4 | grep -aE $2 '"'"$1" | sed -E s/':.*'//
