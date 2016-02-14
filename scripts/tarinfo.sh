#!/bin/bash
dir="$1/../tarinfo"
if [ -z "$2" ]; then
    mkdir -p "$dir"
    rm -f "$dir/*.tmp"
    ls -1 "$1" | sort | xargs -n1 -I{} "$0" "$1" "{}"
else
    if [ ! -f "$dir/$2.txt" ]; then
        tar -ztvf "$1/$2" 2>/dev/null | sort | sed -E s/'^(([^ ]+ +){5})'/"\1$2 "/ > "$dir/$2.tmp"
        mv "$dir/$2.tmp" "$dir/$2.txt"
    fi
    cat "$dir/$2.txt"
fi
