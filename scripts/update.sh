#!/bin/bash
time=`date -uIminutes | sed s/'\+.*'//`
mkdir -p test log current current.ex outdated outdated.ex

###
# Helper methods
###

function test_list_new {
    rm "./test/packages."*
    cd new && ls -1 | sort > "../test/packages.new.txt" && cd .. && echo "test.packages.new.txt done"
    cd new.ex && ls -1 | sort > "../test/packages.new.ex.txt" && cd .. && echo "test.packages.new.ex.txt done"
    diff "./test/packages.new.txt" "./test/packages.new.ex.txt" > "./test/packages.new.diff"
    cat "./test/packages.new.diff"
    [ -s "./test/packages.new.diff" ] && exit
}

function test_list_curr {
    cd current && ls -1 | sort > "../test/packages.curr.txt" && cd .. && echo "test.packages.curr.txt done"
    cd current.ex && ls -1 | sort > "../test/packages.curr.ex.txt" && cd .. && echo "test.packages.curr.ex.txt done"
    diff "./test/packages.curr.txt" "./test/packages.curr.ex.txt" > "./test/packages.curr.diff"
    cat "./test/packages.curr.diff"
    [ -s "./test/packages.curr.diff" ] && exit
}

###
# Command blocks
###

function get {
    cd ./meta && ./get.sh && cd .. && echo "meta done!"
    mkdir new || exit
    cd new && bash ../meta/update.wget.txt && cd .. && "Download done!"
    cd new && ls -1 | sort > "../log/packages.new.$time.txt" && cd .. && echo "Updated list done!"
    cd current && bash ../meta/update.mv.txt && cd .. && echo "Outdated done!"
    cd current.ex && bash ../meta/update.mv.ex.txt && cd .. && echo "Outdated ex done!"
    ./helpers/unpack.sh ./new && echo "Unpack done!"
    test_list_new
    test_list_curr
    ./helpers/perms.sh ./new.ex && echo "Perms done!"
    cd new && cat "../test/packages.new.txt" | xargs -n1 -I{} mv "{}" ../current && cd .. && echo "Move 1/2 done!"
    cd new.ex && cat "../test/packages.new.txt" | xargs -n1 -I{} mv "{}" ../current.ex && cd .. && echo "Move 2/2 done!"
    test_list_curr
    rmdir new new.ex || exit
}

get

echo "Done!"
exit