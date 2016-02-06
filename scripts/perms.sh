#!/bin/bash
find "$1" -type d -and -not -perm -u+x -or -not -perm -u+r > "perms.wrong$2.delta.txt"
cat "perms.wrong$2.delta.txt" >> "perms.wrong$2.txt"
cat "perms.wrong$2.delta.txt" | xargs -I{} find {} -type d -not -perm -u+x | xargs -I{} chmod u+x "{}"
cat "perms.wrong$2.delta.txt" | xargs -I{} find {} -not -perm -u+r | xargs -I{} chmod u+r "{}"
