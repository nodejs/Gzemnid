#!/bin/bash
ext="$1"
out="$2"
tgz="$3"
cat "$out/slim.files$ext.txt" | sed s/"'"/'\\'"'"/g | sed s/'"'/'\\"'/g | xargs -n1 -I{} grep -HnP '[^\s]' "{}" | grep -vE '.{500}' > "$out/slim.code$ext.txt"
true
