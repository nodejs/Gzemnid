#!/bin/bash
if [ -z "$2" ]; then
	ls -1 "$1" | sort | xargs -n1 -I{} "$0" "$1" "{}"
else
	tar -ztvf "$1/$2" 2>/dev/null | sort | sed -E s/'^(([^ ]+ +){5})'/"\1$2 "/
fi