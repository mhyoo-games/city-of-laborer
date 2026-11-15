import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../src/core/sim.ts';
import { JOBS, KINDS, BG_IDS, NPCS, NPC_IDS, MEALS, RENT, type BgId } from '../src/core/data.ts';
import { rand } from '../src/core/rng.ts';

test('새 게임: 사연마다 다른 출발', () => {
  const y = S.newGame('준호', 'youth', 1), f = S.newGame('', 'father', 1), e = S.newGame('철수', 'elder', 1);
  assert.equal(f.name, '나');
  assert.ok(y.staminaMax > e.staminaMax && e.rep > y.rep);
  assert.ok(S.levelOf(e.xp.pipe) >= 3 && S.levelOf(y.xp.pipe) === 1);
  assert.ok(e.licenses.includes('signal') && !S.hasSafety(y));
  assert.equal(y.phase, 'wake');
});

test('칠판: 날마다 같고, 비 오면 건설 현장이 없다', () => {
  const g = S.newGame('a', 'youth', 42);
  S.wake(g, 'up');
  const b1 = JSON.stringify(g.board);
  const g2 = S.newGame('a', 'youth', 42); S.wake(g2, 'up');
  assert.equal(JSON.stringify(g2.board), b1);
  assert.ok(g.board.length >= 2 && g.board.length <= 5);
  // 비 오는 날을 찾아 본다
  let rainy = 0;
  for (let d = 2; d < 200; d++) {
    if (S.weatherFor(42, d) !== 'rain') continue;
    rainy++;
    const h = S.newGame('a', 'father', 42); h.day = d; h.weather = 'rain'; S.wake(h, 'up');
    assert.ok(h.board.every((j) => !JOBS[j.kind].build), '비 오는 날 건설 일');
  }
  assert.ok(rainy > 10 && rainy < 50, `비 오는 날 수 ${rainy}`);
  assert.equal(S.weatherFor(5, 1), 'sun');
});

test('뽑히기: 안전교육·자격증·피곤·늦잠', () => {
  const g = S.newGame('a', 'youth', 3);
  S.wake(g, 'up');
  const pipe = { id: 'x', kind: 'pipe' as const, site: 's', pay: 1, shady: false, named: false };
  assert.equal(S.hireChance(g, pipe), 0, '안전교육 없이 배관');
  g.licenses.push('safety');
  assert.ok(S.hireChance(g, pipe) > 0.3);
  const crane = { ...pipe, kind: 'crane' as const };
  assert.equal(S.hireChance(g, crane), 0, '신호수 교육 없이 크레인');
  const p0 = S.hireChance(g, pipe);
  g.late = true;
  assert.ok(S.hireChance(g, pipe) < p0 - 0.2, '늦게 오면 덜 뽑힘');
  g.late = false;
  g.rep = 90;
  assert.ok(S.hireChance(g, pipe) > p0, '평판이 좋으면 잘 뽑힘');
  assert.equal(S.hireChance(g, { ...pipe, named: true }), 1, '지명은 확실');
  // 피곤하면 소장님이 돌려보낸다
  g.board = [{ ...pipe, id: 'j0' }];
  g.stamina = 10;
  const r = S.apply(g, 'j0', 0);
  assert.equal(r.reason, 'tired');
  assert.ok(r.line.includes('a씨'));
  // 떨어지면 그 자리는 없어지고 남은 자리는 더 어렵다
  g.stamina = 100;
  const before = S.hireChance(g, g.board[0]);
  g.board.push({ ...pipe, id: 'j1' });
  const r2 = S.apply(g, 'j0', 0.999);
  assert.equal(r2.ok, false);
  assert.equal(g.board.length, 1);
  assert.ok(S.hireChance(g, g.board[0]) < before);
});

test('하루 한 바퀴: 일 → 점심 → 일 → 일당 → 저녁 → 일기 → 잠', () => {
  const g = S.newGame('준호', 'youth', 9);
  S.wake(g, 'up');
  g.board = [{ id: 'j0', kind: 'sort', site: '동부 물류센터', pay: 0, shady: false, named: false }];
  assert.ok(S.apply(g, 'j0', 0).ok);
  assert.equal(g.phase, 'work1');
  const st0 = g.stamina;
  S.finishSession(g, 90, 1);
  assert.equal(g.phase, 'lunch');
  assert.ok(g.stamina < st0, '일하면 체력이 줄어든다');
  assert.equal(S.lunch(g, 'lunchbox'), false, '도시락을 안 쌌으면 못 먹는다');
  const m0 = g.money;
  assert.ok(S.lunch(g, 'hamba'));
  assert.equal(g.money, m0 - MEALS.hamba.cost);
  S.finishSession(g, 95, 1);
  assert.equal(g.phase, 'pay');
  const m1 = g.money;
  const p = S.payday(g, 0.9)!;
  assert.equal(p.grade, 'S');
  assert.equal(p.fee, Math.round((p.net - p.tip) / 0.9 * 0.1 / 1000) * 1000, '소개비 10%');
  assert.equal(g.money, m1 + p.net);
  assert.ok(g.named && g.named.kind === 'sort', 'S면 내일 지명');
  assert.equal(g.phase, 'evening');
  assert.ok(S.evening(g, 'cook'));
  assert.ok(g.lunchbox);
  const diary = S.night(g);
  assert.ok(diary.startsWith('1일째.'));
  assert.ok(g.stamps.includes('first') && g.stamps.includes('firstS'));
  S.sleep(g);
  assert.equal(g.day, 2);
  assert.equal(g.phase, 'wake');
  S.wake(g, 'up');
  if (g.weather !== 'rain') assert.ok(g.board[0].named && S.hireChance(g, g.board[0]) === 1, '지명 일이 맨 위에');
});

test('일당: 숙련·날씨·자격증이 오르면 더 받는다', () => {
  const g = S.newGame('a', 'youth', 1);
  const a = S.payFor(g, 'pipe', false, false, 'sun').total;
  g.xp.pipe = 400;
  const b = S.payFor(g, 'pipe', false, false, 'sun').total;
  g.licenses.push('welding');
  const c = S.payFor(g, 'pipe', false, false, 'sun').total;
  const d = S.payFor(g, 'pipe', false, false, 'heat').total;
  assert.ok(a < b && b < c && c < d, `${a} ${b} ${c} ${d}`);
  assert.equal(a, JOBS.pipe.base);
  assert.ok(S.payFor(g, 'sort', false, false, 'sun').total < S.payFor(g, 'sort', true, false, 'sun').total, '처음 보는 업체는 더 준다고 한다');
});

test('못 받은 일당 → 노동청 진정 → 사흘 뒤 들어온다', () => {
  const g = S.newGame('a', 'father', 2);
  S.wake(g, 'up');
  g.board = [{ id: 'j0', kind: 'line', site: '(처음 보는 업체) 공장', pay: 0, shady: true, named: false }];
  S.apply(g, 'j0', 0);
  S.finishSession(g, 70, 1); S.lunch(g, 'ramen'); S.finishSession(g, 70, 1);
  const m = g.money;
  const p = S.payday(g, 0.1)!;
  assert.ok(p.unpaid && g.money === m && g.unpaid.length === 1);
  assert.ok(S.canEvening(g, 'report'));
  S.evening(g, 'report'); S.night(g); S.sleep(g);
  for (let i = 0; i < 3; i++) { S.wake(g, 'rest'); S.endRest(g); S.evening(g, 'sleep'); S.night(g); S.sleep(g); }
  assert.equal(g.unpaid.length, 0);
  assert.ok(g.money > m && g.stamps.includes('unpaid'));
});

test('다치면 며칠 쉰다, 보호구는 덜 다치게', () => {
  let hurtNo = 0, hurtGear = 0;
  for (let i = 0; i < 400; i++) {
    for (const gear of [false, true]) {
      const g = S.newGame('a', 'elder', i);
      if (gear) g.gear.push('belt', 'boots');
      S.wake(g, 'up');
      g.board = [{ id: 'j0', kind: 'crane', site: 's', pay: 0, shady: false, named: false }];
      S.apply(g, 'j0', 0);
      g.fatigue = 85;
      const r = S.finishSession(g, 30, rand(i * 7 + (gear ? 1 : 0))());
      if (r.hurt) { gear ? hurtGear++ : hurtNo++; assert.equal(g.phase, 'pay'); assert.ok(g.hurtDays >= 2); }
    }
  }
  assert.ok(hurtNo > 20 && hurtGear < hurtNo * 0.75, `보호구 없이 ${hurtNo}, 있으면 ${hurtGear}`);
  // 다친 날은 반만 받고, 다음 날은 쉰다
  const g = S.newGame('a', 'youth', 1);
  S.wake(g, 'up');
  g.board = [{ id: 'j0', kind: 'sort', site: 's', pay: 0, shady: false, named: false }];
  S.apply(g, 'j0', 0);
  g.phase = 'work1'; g.hurtDays = 0;
  g.scores = [];
  g.fatigue = 100;
  let r; do { g.phase = 'work1'; g.scores = []; r = S.finishSession(g, 10, 0); } while (!r.hurt);
  const p = S.payday(g, 1)!;
  assert.ok(p.half);
  S.evening(g, 'sleep'); S.night(g); S.sleep(g);
  S.wake(g, 'up');
  assert.equal(g.phase, 'rest', '다친 다음 날은 일 못 감');
});

test('자격증: 돈 내고 저녁마다 공부 → 이수', () => {
  const g = S.newGame('a', 'youth', 1);
  assert.equal(S.startStudy(g, 'signal'), false, '안전교육이 먼저');
  assert.ok(S.startStudy(g, 'safety'));
  g.phase = 'evening';
  assert.ok(S.evening(g, 'study'));
  assert.ok(S.hasSafety(g) && g.study === null);
  g.money = 1000000;
  assert.ok(S.startStudy(g, 'welding'));
  for (let i = 0; i < 5; i++) { g.phase = 'evening'; S.evening(g, 'study'); }
  assert.ok(g.licenses.includes('welding'));
  S.checkStamps(g);
  assert.ok(g.stamps.includes('license'));
});

test('포장마차에서 이야기가 하나씩 열린다', () => {
  const g = S.newGame('a', 'youth', 1);
  const got: string[] = [];
  for (let i = 0; i < 40; i++) {
    g.lastPay = { kind: 'line' } as S.PayResult;
    g.bond.nguyen += 2;
    g.phase = 'evening'; g.money = 1e6;
    S.evening(g, 'pocha');
    if (g.story) got.push(g.story.lines[0]);
  }
  assert.equal(got.length, NPCS.nguyen.stories.length);
  assert.equal(new Set(got).size, got.length, '같은 이야기 두 번 안 함');
  S.checkStamps(g);
  assert.ok(g.stamps.includes('story'));
});

test('방값은 일주일마다, 못 내면 마음이 무너진다', () => {
  const g = S.newGame('a', 'youth', 1);
  g.money = 50000;
  g.day = 7; g.phase = 'night';
  S.night(g);
  assert.equal(g.money, 50000 - RENT - S.LIVING);
  assert.ok(g.mood < 60);
});

test('저장: 고쳐서 읽기, 망가진 값도 받아 준다', () => {
  const g = S.newGame('준호', 'father', 77);
  g.day = 12; g.money = 777000; g.licenses.push('forklift'); g.seen.kim = 2; g.stamps.push('first', 'xxx');
  const back = S.parseSave(JSON.stringify(g))!;
  assert.equal(back.day, 12); assert.equal(back.money, 777000); assert.ok(back.licenses.includes('forklift'));
  assert.equal(back.seen.kim, 2); assert.deepEqual(back.stamps, ['first']);
  assert.equal(back.phase, 'wake');
  assert.equal(S.parseSave('{{'), null);
  assert.equal(S.parseSave({ v: 1, bg: 'nope' }), null);
  const odd = S.parseSave({ v: 1, bg: 'youth', day: 'x', money: 'y', xp: { pipe: -5 }, seen: { kim: 99 } })!;
  assert.equal(odd.day, 1); assert.equal(odd.xp.pipe, 0); assert.equal(odd.seen.kim, NPCS.kim.stories.length);
});

/** 사람처럼 하루를 보내는 봇: skill = 미니게임 평균 점수 */
function career(bg: BgId, skill: number, days: number, seed: number) {
  const g = S.newGame('봇', bg, seed);
  const r = rand(seed);
  let ended = 0;
  for (let d = 0; d < days; d++) {
    if (g.phase === 'ending') { if (!ended) ended = g.day; S.continueAfterGoal(g); }
    S.wake(g, g.fatigue > 75 ? 'rest' : 'up');
    if (g.phase === 'office') {
      // 먼저 필요한 이수증부터
      while (g.phase === 'office' && g.board.length) {
        const best = [...g.board].sort((a, b) => S.hireChance(g, b) * b.pay - S.hireChance(g, a) * a.pay)[0];
        if (S.hireChance(g, best) === 0) { g.board = g.board.filter((b) => b !== best); continue; }
        S.apply(g, best.id, r());
      }
      if (g.phase === 'office') S.goHome(g);
    }
    if (g.phase === 'rest') S.endRest(g);
    if (g.phase === 'work1') {
      const sc = () => Math.max(0, Math.min(100, skill + (r() - 0.5) * 20));
      S.finishSession(g, sc(), r());
      if (g.phase === 'lunch') { S.lunch(g, g.lunchbox ? 'lunchbox' : g.money > 20000 ? 'hamba' : 'ramen'); S.finishSession(g, sc(), r()); }
      S.payday(g, r());
    }
    if (g.phase === 'evening') {
      if (!S.hasSafety(g) && !g.study && g.money > 60000) S.startStudy(g, 'safety');
      else if (!g.study && g.money > 400000 && !g.licenses.includes('signal') && S.hasSafety(g)) S.startStudy(g, 'signal');
      if (!g.gear.includes('gloves') && g.money > 100000) S.buyGear(g, 'gloves');
      const ev = g.study ? 'study' : g.unpaid.some((u) => u.due === null) ? 'report' : g.fatigue > 55 ? 'sauna' : g.mood < 40 ? 'pocha' : 'cook';
      if (!S.evening(g, ev)) S.evening(g, 'sleep');
    }
    S.night(g);
    if (g.phase !== 'ending') S.sleep(g);
  }
  return { g, ended };
}

test('봇 60일: 잘하면 목표에 닿고, 못하면 겨우 버틴다', () => {
  for (const bg of BG_IDS) {
    const good = career(bg, 85, 70, 11), mid = career(bg, 60, 70, 12), bad = career(bg, 25, 70, 13);
    const e = (c: any) => c.ended ? c.ended + '일째 목표' : '못 닿음';
    console.log(`  ${bg}: 잘함 ${e(good)} 번 돈 ${S.won(good.g.earned)} / 보통 ${e(mid)} ${S.won(mid.g.earned)} / 서툼 ${e(bad)} ${S.won(bad.g.earned)} (일한 날 ${good.g.worked}/${mid.g.worked}/${bad.g.worked}, 칭호 ${S.rank(good.g)})`);
    assert.ok(good.ended >= 20 && good.ended <= 60, bg + ' 잘하면 20~60일 사이에 목표 (' + good.ended + ')');
    assert.ok(!mid.ended || mid.ended > good.ended, bg + ' 보통은 더 늦게');
    assert.ok(!bad.ended || bad.ended > (mid.ended || 0) + 20, bg + ' 서툴면 훨씬 늦거나 못 닿음');
    assert.ok(good.g.earned > mid.g.earned && mid.g.earned > bad.g.earned * 1.2, bg + ' 잘할수록 더 번다');
  }
});

test('일 게시판에는 공장·물류 일이 꼭 하나는 있다', () => {
  for (let seed = 0; seed < 300; seed++) {
    const g = S.newGame("나", "youth", seed);
    for (const late of [false, true]) {
      g.day = 1 + (seed % 9); g.late = late; g.weather = S.weatherFor(seed, g.day);
      const b = S.makeBoard(g);
      assert.ok(b.some((j) => !JOBS[j.kind].build), '이수증 없이 갈 곳이 없음 ' + seed);
    }
  }
});
