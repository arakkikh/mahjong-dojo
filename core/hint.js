// ヒント：おすすめの打牌・鳴き・リーチと、その理由を文章で返す（ヒント付き対局で使う）。

// 他の牌とつながらない牌か（同じ牌がなく、数牌なら2つ以内の近くに同じ色の牌がない）
function isIsolated(counts, kind) {
  if (counts[kind] >= 2) return false;
  if (kind >= 27) return true;
  const n = kind % 9;
  for (let d = -2; d <= 2; d++) {
    if (!d) continue;
    if (n + d < 0 || n + d > 8) continue;
    if (counts[kind + d] > 0) return false;
  }
  return true;
}

function kindsList(kinds) { return kinds.map(kindName).join('・'); }

// あなたの番のおすすめ。
// 返り値: { action: 'tsumo'|'riichi'|'discard', id, kind, title, reasons: [文], choices: [{ kind, shanten, total, tiles }], mode }
function hintTurn(g, seat) {
  const h = g.h;
  const sc = tsumoScore(g, seat);
  if (sc) {
    return { action: 'tsumo', title: 'ツモ和了できます！', reasons: [`役: ${sc.yaku.map(y => y.name).join('・')}（${scoreLabelPlain(sc)}）`] };
  }
  const m = meldCount(g, seat);
  const tiles = handTiles(g, seat).filter(id => canDiscardId(g, seat, id));
  const counts = countsOfIds(handTiles(g, seat));
  const vis = gameVisible(g);
  const choices = discardChoices(counts, m, vis).filter(c => tiles.some(id => kindOf(id) === c.kind));
  const best = choices[0];
  const riichiSeats = [0, 1, 2, 3].filter(s => s !== seat && h.riichi[s]);
  const pickId = kind => {
    const ids = tiles.filter(id => kindOf(id) === kind);
    ids.sort((a, b) => (isRedId(a, g.rules) - isRedId(b, g.rules)) || ((b === h.drawn) - (a === h.drawn)));
    return ids[0];
  };

  // 守り
  if (riichiSeats.length && best.shanten >= 2) {
    const scored = choices.map((c, i) => Object.assign({ c, i }, safetyInfo(g, c.kind, riichiSeats)));
    scored.sort((a, b) => (b.safe - a.safe) || (a.i - b.i));
    const top = scored[0];
    return {
      action: 'discard', mode: 'defense', kind: top.c.kind, id: pickId(top.c.kind),
      title: `守り：${kindName(top.c.kind)} を捨てよう`,
      reasons: [
        `${riichiSeats.map(s => SEAT_NAME[s]).join('・')}がリーチしています。あなたの手はまだ${best.shanten}シャンテンで遠いので、和了を目指すより振り込まないことを優先しましょう（ベタオリ）。`,
        `${kindName(top.c.kind)}：${top.reason}`,
      ],
      choices: scored.slice(0, 4).map(x => Object.assign({ safeReason: x.reason }, x.c)),
    };
  }

  // リーチ
  const rc = riichiCandidates(g, seat);
  if (rc.length) {
    const r = cpuChooseRiichi(g, seat) || rc[0];
    const c = countsOfIds(handTiles(g, seat));
    c[kindOf(r)]--;
    const w = waits(c, m);
    const left = w.reduce((s, k) => s + Math.max(0, 4 - c[k] - vis[k] - (k === kindOf(r) ? 1 : 0)), 0);
    return {
      action: 'riichi', mode: 'attack', kind: kindOf(r), id: r,
      title: `リーチ！ ${kindName(kindOf(r))} を捨ててリーチしよう`,
      reasons: [
        `${kindName(kindOf(r))} を捨てると聴牌。待ちは ${kindsList(w)}（残り${left}枚）。`,
        'リーチは門前で聴牌していればつけられる役です。役がない手でも和了れるようになり、一発・裏ドラのチャンスもあります。',
      ],
      choices: choices.slice(0, 3),
      waits: w,
    };
  }

  // 攻め：受け入れの多い打牌
  const top = choices.filter(c => c.shanten === best.shanten && c.total === best.total);
  top.sort((a, b) => (tileUsefulness(a.kind) - tileUsefulness(b.kind)) || (a.kind - b.kind));
  const k = top[0].kind;
  const reasons = [];
  const sNow = best.shanten;
  if (sNow === 0) {
    reasons.push(`${kindName(k)} を捨てると聴牌。待ちは ${kindsList(best.ukeire.map(u => u.kind))}（残り${best.total}枚）。`);
  } else {
    reasons.push(`${kindName(k)} を捨てても ${sNow}シャンテンのまま。次に引くと手が進む牌が ${top[0].ukeire.length}種類 ${best.total}枚 あって、いちばん多い選び方です。`);
  }
  const c13 = counts.slice();
  if (isIsolated(c13, k)) {
    if (isHonor(k)) reasons.push(`${kindName(k)} は1枚だけの字牌で、他の牌とつながりません。`);
    else reasons.push(`${kindName(k)} はまわりに同じ色の牌がなく、孤立しています。`);
  }
  if (top.length > 1) reasons.push(`${kindsList(top.slice(1).map(c => c.kind))} を捨てても同じくらいです。`);
  const worse = choices.find(c => c.shanten > sNow);
  if (worse) reasons.push(`たとえば ${kindName(worse.kind)} を捨てると ${worse.shanten}シャンテンに戻ってしまいます。`);
  if (!isMenzen(g, seat) && !hasYakuhaiMeld(g, seat)) {
    reasons.push('鳴いているので役が必要です。役牌がないなら、1・9・字牌を手から外してタンヤオを目指しましょう。');
  }
  return { action: 'discard', mode: 'attack', kind: k, id: pickId(k), title: `${kindName(k)} を捨てよう`, reasons, choices: choices.slice(0, 4) };
}

function scoreLabelPlain(sc) {
  if (sc.yakuman) return sc.limit;
  return `${sc.han}翻${sc.fu}符` + (sc.limit ? ' ' + sc.limit : '');
}

// 鳴き・ロンを聞かれたときのおすすめ。{ action: 'ron'|'pon'|'kan'|'chi'|'pass', opt, title, reasons }
function hintCall(g) {
  const h = g.h;
  const cl = h.claims;
  const ho = cl && cl.human;
  if (!ho) return null;
  const id = h.last.id;
  if (ho.ron) {
    const sc = ronScore(g, HUMAN, id, h.last.kakan);
    return { action: 'ron', title: 'ロンしよう！', reasons: [`役: ${sc.yaku.map(y => y.name).join('・')}（${scoreLabelPlain(sc)}）`] };
  }
  const k = kindOf(id);
  const before = shanten(countsOfIds(h.hands[HUMAN]), meldCount(g, HUMAN));
  const riichiOthers = [1, 2, 3].some(s => h.riichi[s]);
  if (ho.pon && cpuWantsCall(g, HUMAN, 'pon', id) && !(riichiOthers && before >= 2)) {
    const why = isYakuhaiFor(g, HUMAN, k)
      ? `${kindName(k)} は役牌なので、ポンすると役（1翻）が確定します。`
      : 'ポンすると手が進みます。役（役牌・タンヤオ）もあります。';
    return { action: 'pon', title: 'ポンしよう', reasons: [why] };
  }
  if (ho.chi && !(riichiOthers && before >= 2)) {
    const o = cpuChooseChi(g, HUMAN, id, cl.chiOptions);
    if (o) return { action: 'chi', opt: o, title: 'チーしよう', reasons: ['チーすると手が進み、タンヤオ（または役牌）で和了れる形です。'] };
  }
  const reasons = [];
  if (isMenzen(g, HUMAN) && before <= 1) reasons.push('門前のまま聴牌すればリーチができます。鳴くとリーチできなくなります。');
  else if (!isYakuhaiFor(g, HUMAN, k) && !hasYakuhaiMeld(g, HUMAN) && !tanyaoRoute(g, HUMAN, [id])) reasons.push('鳴くと役がなくなるかもしれません。役がないと和了れません。');
  else reasons.push('鳴いても手が進まない（シャンテン数が変わらない）ので、見送りましょう。');
  if (riichiOthers && before >= 2) reasons.push('リーチしている人がいるので、無理に鳴かず守りを考えましょう。');
  return { action: 'pass', title: 'スキップしよう', reasons };
}
