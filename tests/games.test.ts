import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sort, Line, Pipe, Crane, Clean, makeMini, rot, E, Wd, type Mini, type Inp, type Key } from '../src/games/mini.ts';
import { KINDS } from '../src/core/data.ts';
import { rand } from '../src/core/rng.ts';

const DT = 1 / 60;
function play(m: Mini, bot: (m: any, f: number) => Inp): number {
  let f = 0;
  while (!m.done && f < 60 * 120) { m.step(DT, bot(m, f)); m.events.length = 0; f++; }
  return m.score();
}
const idle = () => ({ held: {}, hit: {} });
function masher(seed: number) {
  const r = rand(seed);
  const keys: Key[] = ['L', 'R', 'U', 'D', 'A', 'B'];
  return () => { const k = keys[Math.floor(r() * 6)]; return r() < 0.15 ? { held: { [k]: true }, hit: { [k]: true } } : { held: { [k]: r() < 0.5 }, hit: {} }; };
}

function sortBot(m: Sort, f: number): Inp {
  const b = m.boxes.filter((b) => b.state === 'move' && b.x <= Sort.ZONE[1] - 4).sort((a, c) => a.x - c.x)[0];
  if (!b || f % 2) return idle();
  const k: Key = b.lane === 'up' ? 'U' : b.lane === 'down' ? 'D' : 'L';
  return { held: { [k]: true }, hit: { [k]: true } };
}
function lineBot(m: Line): Inp {
  const p = m.parts.filter((p) => p.state === 'move' && Math.abs(p.x - Line.X) <= 2.2)[0];
  if (!p) return idle();
  const k: Key = p.bad ? 'B' : 'A';
  return { held: { [k]: true }, hit: { [k]: true } };
}
/** 물길을 따라가며 맞는 방향으로 돌리고, 다 이으면 밸브를 일찍 연다 */
function pipePlan(m: Pipe): Array<[number, number, number]> | null {
  const plan: Array<[number, number, number]> = [];
  const seen = new Set<string>();
  const go = (x: number, y: number, from: number): boolean => {
    if (x < 0 || y < 0 || x >= Pipe.W || y >= Pipe.H || seen.has(x + ',' + y)) return false;
    seen.add(x + ',' + y);
    const c = m.grid[y][x];
    let mm = c.m;
    for (let k = 0; k < 4; k++, mm = rot(mm)) {
      if (!(mm & from)) continue;
      const out = mm & ~from;
      plan.push([x, y, k]);
      if (x === Pipe.W - 1 && y === m.r1 && out & E) return true;
      const [nx, ny] = out === 1 ? [x, y - 1] : out === 4 ? [x, y + 1] : out === 2 ? [x + 1, y] : [x - 1, y];
      const nf = ({ 1: 4, 2: 8, 4: 1, 8: 2 } as any)[out];
      if (go(nx, ny, nf)) return true;
      plan.pop();
    }
    seen.delete(x + ',' + y);
    return false;
  };
  return go(0, m.r0, Wd) ? plan : null;
}
function pipeBot(m: Pipe, f: number): Inp {
  if (m.state !== 'play' || f % 3) return idle();
  if (m.connected()) return m.flowing ? idle() : { held: { B: true }, hit: { B: true } };
  const plan = pipePlan(m);
  const todo = plan?.find(([, , k]) => k > 0);
  if (!todo) return idle();
  const [x, y] = todo;
  const k: Key = m.cx < x ? 'R' : m.cx > x ? 'L' : m.cy < y ? 'D' : m.cy > y ? 'U' : 'A';
  return { held: { [k]: true }, hit: { [k]: true } };
}
function craneBot(m: Crane): Inp {
  const [lx] = m.loadPos();
  const err = m.tx - lx, swing = m.om * m.L;
  // 짐을 목표로 끌고 가되 흔들림을 따라 잡는다
  // 크레인을 목표로, 짐 밑으로 따라가며 흔들림을 잡는다
  const u = (m.tx - m.x) * 0.9 - m.vx * 0.55 + (lx - m.x) * 1.4;
  const held: Partial<Record<Key, boolean>> = {};
  if (u > 4) held.R = true; else if (u < -4) held.L = true;
  if (Math.abs(err) < 4 && Math.abs(swing) < 10 && Math.abs(m.vx) < 8) held.D = true;
  return { held, hit: {} };
}
function cleanBot(m: Clean): Inp {
  let tx: number, ty: number;
  if (m.carry >= 3 || (m.carry > 0 && !m.junk.length)) { tx = m.bin.x; ty = m.bin.y; }
  else { const j = [...m.junk].sort((a, b) => Math.hypot(a.x - m.px, a.y - m.py) - Math.hypot(b.x - m.px, b.y - m.py))[0]; tx = j.x; ty = j.y; }
  let dx = tx - m.px, dy = ty - m.py;
  const fd = Math.hypot(m.fork.x - m.px, m.fork.y - m.py);
  if (fd < 34) { dx = m.px - m.fork.x; dy = m.py - m.fork.y; }
  const held: Partial<Record<Key, boolean>> = { A: true };
  if (dx > 2) held.R = true; else if (dx < -2) held.L = true;
  if (dy > 2) held.D = true; else if (dy < -2) held.U = true;
  return { held, hit: {} };
}

const BOTS: Record<string, (m: any, f: number) => Inp> = { sort: sortBot, line: lineBot, pipe: pipeBot, crane: craneBot, clean: cleanBot };

test('다섯 가지 일: 잘하면 높고, 가만있으면 0점 가까이, 막 누르면 낮다', () => {
  for (const k of KINDS) {
    for (const d of [0.2, 0.5, 0.8]) {
      const good = play(makeMini(k, d, 1, 7), BOTS[k]);
      const tired = play(makeMini(k, d, 0.55, 7), BOTS[k]);
      const none = play(makeMini(k, d, 1, 7), idle);
      const mash = play(makeMini(k, d, 1, 7), masher(3));
      console.log(`  ${k} 어려움 ${d}: 잘함 ${good.toFixed(0)} · 지침 ${tired.toFixed(0)} · 가만 ${none.toFixed(0)} · 막 누름 ${mash.toFixed(0)}`);
      assert.ok(good >= 80, `${k} ${d} 잘하는 봇 ${good}`);
      assert.ok(none <= 15, `${k} ${d} 가만있기 ${none}`);
      assert.ok(mash <= 55, `${k} ${d} 막 누르기 ${mash}`);
    }
  }
});

test('상하차: 큰 상자는 여러 번, 지치면 더 많이', () => {
  const m = new Sort(0.5, 1, 1);
  assert.equal(m.need({ big: true } as any), 2);
  assert.equal(new Sort(0.5, 0.6, 1).need({ big: true } as any), 3);
});

test('배관: 퍼즐은 언제나 풀 수 있다', () => {
  for (let s = 0; s < 200; s++) {
    const m = new Pipe(0.5, 1, s);
    assert.ok(pipePlan(m), '풀 수 없는 퍼즐 ' + s);
    assert.ok(m.pathLen >= Pipe.W);
  }
});

test('크레인: 흔들리는 채 내리면 쿵', () => {
  const m = new Crane(0.5, 1, 2);
  for (let i = 0; i < 40; i++) m.step(DT, { held: { R: true }, hit: {} });
  for (let i = 0; i < 300 && !m.bumps; i++) m.step(DT, { held: { D: true }, hit: {} });
  assert.ok(m.bumps >= 1 && m.loads === 0);
});

test('현장 정리: 지게차에 치이면 떨어뜨리고 감점', () => {
  const m = new Clean(0.5, 1, 4);
  m.carry = 2; m.px = m.fork.x + 5; m.py = m.fork.y;
  m.step(DT, idle());
  assert.equal(m.carry, 0); assert.equal(m.hits, 1); assert.ok(m.stun > 1);
});
