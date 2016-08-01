#!/bin/bash
dir="$1"
out="du.$dir.txt"
outsort="du.$dir.sorted.txt"
find "./$dir" -type f | xargs -n10 -I{} du -b "{}" | sed s/"\.\/$dir"// > "$out"
cat "$out" | sort -rn > "$outsort"
