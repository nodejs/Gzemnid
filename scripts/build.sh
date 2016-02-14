#!/bin/bash
time=`date -uIminutes | sed s/'\+.*'//`
out="data-$time"
mkdir "$out" || exit

function list_one {
    echo "$1"
}

function list {
    cd current && ls -1 | sort > "../$out/packages.txt" && cd .. && lzop -9 "../$out/packages.txt" && echo "packages.txt done"
    cd current.ex && cat "../$out/packages.txt" | xargs -n1 -I{} ../helpers/list.sh "{}" > "../$out/files.txt" && lzop "../$out/files.txt" && cd .. && echo "files.txt done"
}

function ldu {
    ./helpers/du.sh ./current > "./$out/du.current.txt" && lzop -9 "./$out/du.current.txt" && echo "du.current.txt done"
    ./helpers/du.sh ./current.ex > "./$out/du.current.txt" && lzop -9 "./$out/du.current.txt" && echo "du.current.ex.txt done"
}

function media {
    rm -rf "$out/media/$1"
    mkdir -p "$out/media/$1"
    cd current.ex
    t=1000000
    #TODO: fix
    for i in `lzgrep -iE "$2" "../$out/files.txt.lzo"`; do
        cp "$i" "../$out/media/$1/$t-"`echo "$i" | sed "s/\.tgz\/.*/.$1/"`
        t=$((t + 1))
    done
    cd ..
}

function code {
    cp code.excluded.txt "$out"
    mkdir -p "$out/slim"
    excluded="(^|/)(`cat code.excluded.txt | grep '.' | tr '\\n' '|' | sed -E s/'([.?)(])'/'\\\\\\1'/g | sed s/'\\*'/'\\.*'/g | sed s/'|$'//`)(/|$)"
    cat "./$out/files.txt" | grep -vE "$excluded" | grep -iE "$2" > "./$out/slim/slim.files.$1.txt" && lzop -9 "./$out/slim/slim.files.$1.txt" && echo "slim.files.$1.txt done"
    cd current.ex && cat "../$out/slim/slim.files.$1.txt" | sed s/"'"/'\\'"'"/g | sed s/'"'/'\\"'/g | xargs -n1 -I{} grep -HnP '[^\s]' "{}" | grep -vE '.{500}' > "../$out/slim/slim.code.$1.txt" && cd .. && echo "slim.code.$1.txt done"
    lzop "./$out/slim/slim.code.$1.txt" -o "./$out/slim/slim.code.$1.lzo" && echo "slim.code.$1.lzo done"
}

list
#ldu
media jpg '\.jpe?g$'
code ts '\.ts$'
code coffee '\.coffee$'
code js '\.js$'
code php '\.php$'

echo "Done!"
exit