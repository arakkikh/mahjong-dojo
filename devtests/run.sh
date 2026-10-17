#!/bin/sh
# 全テストの実行。./devtests/run.sh
cd "$(dirname "$0")/.." || exit 1
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
CORE="core/rng.js core/tiles.js core/rules.js core/wall.js core/hand.js core/solo.js"
for t in hand solo; do
  $JSC $CORE devtests/lib.js devtests/test_$t.js -e "report('$t')" 2>&1 | tail -20
done
