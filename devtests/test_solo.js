// 山と1人打ちのテスト

test('山: 136枚がすべて1回ずつ、同じシードなら同じ並び', () => {
  const w = makeWall(42);
  const all = w.live.concat(w.dead).slice().sort((a, b) => a - b);
  eq(all, allTileIds());
  eq(w.dead.length, 14);
  eq(wallLeft(w), 122);
  eq(makeWall(42).live, w.live);
  ok(!same(makeWall(43).live, w.live));
  eq(doraIndicators(w), [w.dead[4]]);
  eq(uraIndicators(w), [w.dead[5]]);
});

test('1人打ち: 配牌13枚＋ツモ1枚で始まる', () => {
  const s = soloNew(1);
  eq(s.hand.length, 13);
  ok(s.drawn != null);
  eq(s.phase, 'discard');
  eq(s.draws, 1);
  eq(s.hand, sortIds(s.hand));
});

test('1人打ち: 打牌すると次の牌を引き、18回ツモったら終わる', () => {
  const s = soloNew(2);
  for (let i = 0; i < SOLO_MAX_DRAWS; i++) {
    eq(s.phase, 'discard');
    ok(soloDiscard(s, s.drawn), (i + 1) + '回目のツモ切り');
    eq(s.hand.length, 13);
  }
  eq(s.phase, 'end');
  eq(s.discards.length, SOLO_MAX_DRAWS);
  eq(s.drawn, null);
  ok(!soloDiscard(s, s.hand[0]), '終わった後は捨てられない');
  // 牌が増えたり減ったりしていない
  const used = s.hand.concat(s.discards);
  eq(new Set(used).size, 13 + SOLO_MAX_DRAWS);
});

test('1人打ち: 手にない牌は捨てられない', () => {
  const s = soloNew(3);
  ok(!soloDiscard(s, s.wall.dead[0]));
  ok(soloDiscard(s, s.hand[0]));
});

test('1人打ち: 和了の形ならツモ和了できる', () => {
  const s = soloNew(4);
  // 手を和了の形に差し替える（13枚 + ツモ1枚）
  const pick = text => {
    const used = new Set();
    return K(text).map(k => { let id = k * 4; while (used.has(id)) id++; used.add(id); return id; });
  };
  const ids = pick('123m456p789s11122z');
  s.hand = sortIds(ids.slice(0, 13));
  s.drawn = ids[13];
  ok(soloCanTsumo(s));
  ok(soloTsumo(s));
  eq(s.phase, 'win');
  const info = soloInfo(s);
  eq(info.shanten, -1);
  eq(info.agari.form, 'standard');
  eq(info.agari.parts.length, 1);
  eq(partGroups(info.agari.parts[0]).map(g => kindsText(g)), ['123m', '456p', '789s', '111z', '22z']);
});

test('1人打ち: 和了でなければツモ和了できない', () => {
  const s = soloNew(5);
  if (soloCanTsumo(s)) return;  // 配牌で和了の形なら（まずない）飛ばす
  ok(!soloTsumo(s));
  eq(s.phase, 'discard');
});

test('1人打ち: 聴牌で終わったら待ちを出す', () => {
  const s = soloNew(6);
  const pick = text => K(text).map((k, i, a) => k * 4 + a.slice(0, i).filter(x => x === k).length);
  s.hand = sortIds(pick('123m456p789s1122z'));
  s.drawn = null;
  s.phase = 'end';
  eq(codes(soloInfo(s).waits), ['1z', '2z']);
});
