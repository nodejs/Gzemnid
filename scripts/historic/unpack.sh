#!/bin/bash
dir="$1"
out="$dir.ex"
rm -rf "$out"
mkdir "$out"
cd "$out"
for i in `ls "../$dir"`; do
  echo "$i"
  mkdir "$i"
  cd "$i"
    tar --strip-components=1 -xf "../../$dir/$i"
  cd ..
done
cd ..