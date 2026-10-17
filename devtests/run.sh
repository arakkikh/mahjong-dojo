#!/bin/sh
# 全テストの実行。./devtests/run.sh
# macOS では jsc（インストール不要）、なければ node で動かす。
cd "$(dirname "$0")/.." || exit 1
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
if [ -x "$JSC" ]; then RUN="$JSC"; else RUN="node devtests/node_run.js"; fi
CORE="core/rng.js core/tiles.js core/rules.js core/wall.js core/hand.js core/solo.js core/yaku.js core/game.js core/cpu.js core/hint.js core/drill.js core/lessons.js core/records.js core/yakubook.js"
for t in hand solo yaku game drill records; do
  $RUN $CORE devtests/lib.js devtests/test_$t.js -e "report('$t')" 2>&1 | tail -20
done
