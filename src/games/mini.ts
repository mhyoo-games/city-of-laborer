// 현장 미니게임 다섯 가지 — 규칙만 (그림은 gfx/scenes.ts). 좌표는 320×180 화면 픽셀.
// d: 어려움 0~1, body: 몸 상태 0.5~1 (지치면 둔해짐), seed: 난수 씨앗
import { rand } from '../core/rng.ts';
import type { Kind } from '../core/data.ts';

export type Key = 'L' | 'R' | 'U' | 'D' | 'A' | 'B';
export interface Inp { held: Partial<Record<Key, boolean>>; hit: Partial<Record<Key, boolean>> }
export const NO_INPUT: Inp = { held: {}, hit: {} };

export abstract class Mini {
  t = 0; done = false;
  events: string[] = [];          // 효과음 이름 (화면이 꺼내 간다)
  pops: Array<{ x: number; y: number; text: string; t: number; good: boolean }> = [];
  r: () => number;
  abstract kind: Kind;
  abstract dur: number;
  d: number; body: number;
  constructor(d: number, body: number, seed: number) { this.d = d; this.body = body; this.r = rand(seed); }
  abstract update(dt: number, inp: Inp): void;
  /** 0~100 */
  abstract score(): number;
  step(dt: number, inp: Inp): void {
    if (this.done) return;
    this.t += dt;
    this.update(dt, inp);
    for (const p of this.pops) p.t += dt;
    this.pops = this.pops.filter((p) => p.t < 0.8);
    if (this.t >= this.dur) this.done = true;
  }
  pop(x: number, y: number, text: string, good: boolean, sfx?: string): void { this.pops.push({ x, y, text, t: 0, good }); if (sfx) this.events.push(sfx); }
  left(): number { return Math.max(0, this.dur - this.t); }
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ─────────── 1. 택배 상하차: 딱지 색에 맞춰 밀기 ───────────
export type Lane = 'up' | 'down' | 'pass';
export interface Box { x: number; lane: Lane; big: boolean; hits: number; state: 'move' | Lane | 'miss'; oy: number; ok: boolean }
export class Sort extends Mini {
  kind = 'sort' as const; dur = 40;
  boxes: Box[] = []; next = 1; good = 0; bad = 0; combo = 0;
  static Y = 104; static ZONE = [70, 106];
  speed(): number { return 42 + this.d * 38 + this.t * 0.9; }
  need(b: Box): number { return b.big ? (this.body < 0.7 ? 3 : 2) : 1; }
  update(dt: number, inp: Inp): void {
    this.next -= dt;
    if (this.next <= 0) {
      const x = this.r();
      this.boxes.push({ x: 330, lane: x < 0.4 ? 'up' : x < 0.8 ? 'down' : 'pass', big: this.r() < 0.15 + this.d * 0.2, hits: 0, state: 'move', oy: 0, ok: false });
      this.next = (0.75 + this.r() * 0.6) * (1.15 - this.d * 0.35) * 60 / this.speed();
    }
    const v = this.speed();
    const dir: Lane | null = inp.hit.U ? 'up' : inp.hit.D ? 'down' : inp.hit.L ? 'pass' : null;
    if (dir) {
      // 구역 안에서 가장 앞(왼쪽)에 있는 상자
      const b = this.boxes.filter((b) => b.state === 'move' && b.x >= Sort.ZONE[0] - 6 && b.x <= Sort.ZONE[1] + 6).sort((a, c) => a.x - c.x)[0];
      if (b) {
        b.hits++;
        if (b.hits < this.need(b)) this.events.push('shove');
        else {
          b.state = dir;
          b.ok = dir === b.lane;
          if (b.ok) { this.good++; this.combo++; this.pop(b.x, Sort.Y - 18, this.combo >= 5 ? `${this.combo}연속!` : '좋아', true, 'box'); }
          else { this.bad++; this.combo = 0; this.pop(b.x, Sort.Y - 18, '거기 아냐!', false, 'bad'); }
        }
      } else this.events.push('whiff');
    }
    for (const b of this.boxes) {
      if (b.state === 'move') {
        b.x -= v * dt;
        if (b.x < Sort.ZONE[0] - 10) { b.state = 'miss'; this.bad++; this.combo = 0; this.pop(Sort.ZONE[0], Sort.Y - 18, '놓쳤다', false, 'bad'); }
      } else if (b.state === 'up') b.oy -= 120 * dt;
      else if (b.state === 'down') b.oy += 120 * dt;
      else if (b.state === 'pass') b.x -= v * 2.2 * dt;
      else b.x -= v * dt;
    }
    this.boxes = this.boxes.filter((b) => b.x > -30 && Math.abs(b.oy) < 80);
  }
  score(): number { const n = this.good + this.bad; return n === 0 ? 0 : 100 * this.good / n * Math.min(1, n / 12); }
}

// ─────────── 2. 공장 라인: 박자 맞춰 누르기, 불량은 빼기 ───────────
export interface Part { x: number; bad: boolean; state: 'move' | 'done' | 'out' | 'miss' }
export class Line extends Mini {
  kind = 'line' as const; dur = 40;
  parts: Part[] = []; next = 0.8; good = 0; bad = 0; perfect = 0; press = 0;
  static X = 160; static Y = 108;
  speed(): number { return 48 + this.d * 46 + this.t * 0.6; }
  win(): number { return (11 - this.d * 4) * (0.6 + this.body * 0.4); }
  update(dt: number, inp: Inp): void {
    this.press = Math.max(0, this.press - dt);
    this.next -= dt;
    if (this.next <= 0) {
      this.parts.push({ x: -10, bad: this.r() < 0.14 + this.d * 0.1, state: 'move' });
      this.next = [0.7, 0.95, 1.2][Math.floor(this.r() * 3)] * (1.1 - this.d * 0.3);
    }
    const v = this.speed(), W = this.win();
    const near = () => this.parts.filter((p) => p.state === 'move' && Math.abs(p.x - Line.X) <= W).sort((a, b) => Math.abs(a.x - Line.X) - Math.abs(b.x - Line.X))[0];
    if (inp.hit.A) {
      this.press = 0.15;
      const p = near();
      if (!p) { this.bad += 0.5; this.pop(Line.X, Line.Y - 26, '헛손질', false, 'whiff'); }
      else if (p.bad) { p.state = 'done'; this.bad++; this.pop(p.x, Line.Y - 26, '불량을 찍었다!', false, 'bad'); }
      else {
        p.state = 'done'; this.good++;
        const pf = Math.abs(p.x - Line.X) <= 3.5;
        if (pf) this.perfect++;
        this.pop(p.x, Line.Y - 26, pf ? '딱!' : '좋아', true, 'press');
      }
    }
    if (inp.hit.B) {
      const p = near();
      if (p && p.bad) { p.state = 'out'; this.good++; this.pop(p.x, Line.Y - 26, '불량 골라냄', true, 'toss'); }
      else if (p) { p.state = 'out'; this.bad++; this.pop(p.x, Line.Y - 26, '멀쩡한 걸 버렸다', false, 'bad'); }
    }
    for (const p of this.parts) {
      if (p.state === 'out') { p.x += v * 0.3 * dt; continue; }
      p.x += v * dt;
      if (p.state === 'move' && p.x > Line.X + W + 2) { p.state = 'miss'; this.bad++; this.pop(Line.X + 20, Line.Y - 26, p.bad ? '불량이 지나갔다' : '빠뜨렸다', false, 'bad'); }
    }
    this.parts = this.parts.filter((p) => p.x < 340);
  }
  score(): number { const n = this.good + this.bad; return n === 0 ? 0 : clamp(100 * this.good / n + this.perfect * 0.4, 0, 100) * Math.min(1, n / 15); }
}

// ─────────── 3. 배관: 관을 돌려 물길 잇기 ───────────
// 칸의 연결: 북 1 · 동 2 · 남 4 · 서 8
export const N = 1, E = 2, Sd = 4, Wd = 8;
export const rot = (m: number) => ((m << 1) | (m >> 3)) & 15;     // 시계 방향 90°
const opp = (dirBit: number) => ({ 1: 4, 2: 8, 4: 1, 8: 2 } as Record<number, number>)[dirBit];
const step = (x: number, y: number, dirBit: number): [number, number] => dirBit === N ? [x, y - 1] : dirBit === Sd ? [x, y + 1] : dirBit === E ? [x + 1, y] : [x - 1, y];
export interface Cell { m: number; wet: boolean; path: boolean }
export class Pipe extends Mini {
  kind = 'pipe' as const; dur = 55;
  static W = 7; static H = 4; static CELL = 22; static OX = 160 - (7 * 22) / 2; static OY = 52;
  grid: Cell[][] = []; r0 = 0; r1 = 0; cx = 0; cy = 0;
  wait = 0; tick = 0; flowing = false; wx = -1; wy = 0; from = Wd; wetCount = 0; pathLen = 0;
  results: number[] = []; state: 'play' | 'ok' | 'leak' = 'play'; pause = 0; early = 0;
  constructor(d: number, body: number, seed: number) { super(d, body, seed); this.newPuzzle(); }
  flowTick(): number { return (1.5 - this.d * 0.5) * (0.8 + this.body * 0.2); }
  newPuzzle(): void {
    const W = Pipe.W, H = Pipe.H, r = this.r;
    // 물길: 왼쪽 r0에서 오른쪽 r1까지 (가끔 위아래로 꺾임)
    let path: Array<[number, number]> = [];
    for (let tries = 0; tries < 50; tries++) {
      path = []; const seen = new Set<string>();
      let x = 0, y = Math.floor(r() * H);
      this.r0 = y; path.push([x, y]); seen.add(x + ',' + y);
      while (x < W - 1) {
        const opts: Array<[number, number]> = [[x + 1, y], [x + 1, y]];
        if (y > 0) opts.push([x, y - 1]);
        if (y < H - 1) opts.push([x, y + 1]);
        const ok = opts.filter(([a, b]) => !seen.has(a + ',' + b));
        if (!ok.length) break;
        [x, y] = ok[Math.floor(r() * ok.length)];
        path.push([x, y]); seen.add(x + ',' + y);
      }
      if (x === W - 1 && path.length >= W + 2) break;
    }
    this.r1 = path[path.length - 1][1];
    this.grid = Array.from({ length: H }, () => Array.from({ length: W }, () => ({ m: r() < 0.5 ? N | Sd : N | E, wet: false, path: false })));
    for (let i = 0; i < path.length; i++) {
      const [x, y] = path[i];
      const inDir = i === 0 ? Wd : dirTo(path[i - 1], path[i], true);
      const outDir = i === path.length - 1 ? E : dirTo(path[i], path[i + 1], false);
      this.grid[y][x] = { m: inDir | outDir, wet: false, path: true };
    }
    // 섞기
    for (const row of this.grid) for (const c of row) { const k = Math.floor(r() * 4); for (let i = 0; i < k; i++) c.m = rot(c.m); }
    this.pathLen = path.length;
    this.wait = (8 - this.d * 3) * (0.85 + this.body * 0.15);
    this.flowing = false; this.wx = -1; this.wy = this.r0; this.from = Wd; this.wetCount = 0; this.tick = 0; this.state = 'play'; this.early = 0;
    this.cx = 0; this.cy = this.r0;
  }
  update(dt: number, inp: Inp): void {
    if (this.state !== 'play') {
      this.pause -= dt;
      if (this.pause <= 0) this.newPuzzle();
      return;
    }
    if (inp.hit.L) this.cx = Math.max(0, this.cx - 1);
    if (inp.hit.R) this.cx = Math.min(Pipe.W - 1, this.cx + 1);
    if (inp.hit.U) this.cy = Math.max(0, this.cy - 1);
    if (inp.hit.D) this.cy = Math.min(Pipe.H - 1, this.cy + 1);
    if (inp.hit.A) {
      const c = this.grid[this.cy][this.cx];
      if (!c.wet) { c.m = rot(c.m); this.events.push('turn'); } else this.events.push('whiff');
    }
    if (!this.flowing) {
      this.wait -= dt;
      if (inp.hit.B) { this.early = Math.max(0, this.wait); this.wait = 0; this.events.push('valve'); }
      if (this.wait <= 0) { this.flowing = true; this.tick = 0.01; this.events.push('water'); }
      return;
    }
    this.tick -= dt;
    if (this.tick > 0) return;
    this.tick = this.flowTick();
    // 물이 한 칸 나아간다
    let nx: number, ny: number, enter: number;
    if (this.wx < 0) { nx = 0; ny = this.r0; enter = Wd; }
    else {
      const c = this.grid[this.wy][this.wx];
      const out = c.m & ~this.from;
      if (this.wx === Pipe.W - 1 && this.wy === this.r1 && out & E) { this.finish(true); return; }
      [nx, ny] = step(this.wx, this.wy, out);
      enter = opp(out);
    }
    if (nx < 0 || ny < 0 || nx >= Pipe.W || ny >= Pipe.H) { this.finish(false); return; }
    const n = this.grid[ny][nx];
    if (!(n.m & enter) || n.wet) { this.finish(false); return; }
    n.wet = true; this.wx = nx; this.wy = ny; this.from = enter; this.wetCount++;
    this.events.push('drip');
  }
  finish(ok: boolean): void {
    this.state = ok ? 'ok' : 'leak';
    const s = ok ? 85 + 15 * clamp(this.early / 5, 0, 1) : 40 * this.wetCount / this.pathLen;
    this.results.push(s);
    this.pause = 1.4;
    this.pop(160, Pipe.OY - 12, ok ? '물이 통한다!' : '물이 샌다!', ok, ok ? 'good' : 'leak');
  }
  /** 지금 칸들이 물길로 다 이어졌나 (봇·도움말용) */
  connected(): boolean {
    let x = 0, y = this.r0, from = Wd;
    for (let i = 0; i < Pipe.W * Pipe.H; i++) {
      const c = this.grid[y][x];
      if (!(c.m & from)) return false;
      const out = c.m & ~from;
      if (x === Pipe.W - 1 && y === this.r1 && out & E) return true;
      const [nx, ny] = step(x, y, out);
      if (nx < 0 || ny < 0 || nx >= Pipe.W || ny >= Pipe.H) return false;
      x = nx; y = ny; from = opp(out);
    }
    return false;
  }
  score(): number {
    const all = [...this.results];
    // 끝나는 순간 흐르던 퍼즐은, 하나도 못 끝냈을 때만 친다
    if (!all.length && this.state === 'play' && this.flowing) all.push(40 * this.wetCount / this.pathLen);
    if (!all.length) return 0;
    // 마무리한 개수도 본다 (55초에 두 개는 해야 제 몫)
    const done = this.results.filter((s) => s >= 85).length;
    return clamp(all.reduce((a, b) => a + b, 0) / all.length * Math.min(1, 0.55 + done * 0.25), 0, 100);
  }
}
function dirTo(a: [number, number], b: [number, number], incoming: boolean): number {
  // a→b로 갈 때, incoming이면 b에서 본 들어오는 쪽, 아니면 a에서 나가는 쪽
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const out = dx === 1 ? E : dx === -1 ? Wd : dy === 1 ? Sd : N;
  return incoming ? opp(out) : out;
}

// ─────────── 4. 크레인 신호수: 흔들림을 잡아 깃발 위에 ───────────
export class Crane extends Mini {
  kind = 'crane' as const; dur = 50;
  static TOP = 26; static G = 220;
  x = 60; vx = 0; ax = 0; th = 0; om = 0; L = 34; lowering = false;
  tx = 220; ty = 150; tw = 16; platY = 150; loads = 0; results: number[] = []; cool = 0; bumps = 0;
  constructor(d: number, body: number, seed: number) { super(d, body, seed); this.newTarget(); }
  newTarget(): void {
    this.tx = 150 + this.r() * 140;
    this.platY = 152 - Math.floor(this.r() * 4) * 18;     // 몇 층인지
    this.tw = 14 - this.d * 4;
    this.L = 34; this.th = 0; this.om = 0;
  }
  loadPos(): [number, number] { return [this.x + Math.sin(this.th) * this.L, Crane.TOP + Math.cos(this.th) * this.L]; }
  surfaceAt(px: number): number { return Math.abs(px - this.tx) <= 24 ? this.platY : 164; }
  update(dt: number, inp: Inp): void {
    this.cool = Math.max(0, this.cool - dt);
    const acc = 95 * (0.7 + this.body * 0.3);
    const want = (inp.held.R ? 1 : 0) - (inp.held.L ? 1 : 0);
    const vx0 = this.vx;
    this.vx += want * acc * dt;
    this.vx *= Math.exp(-(want ? 0.6 : 2.4) * dt);
    this.vx = clamp(this.vx, -62, 62);
    this.x = clamp(this.x + this.vx * dt, 24, 300);
    if (this.x <= 24 || this.x >= 300) this.vx = 0;
    this.ax = (this.vx - vx0) / Math.max(dt, 1e-4);
    // 진자: 크레인이 움직이면 짐이 뒤로 흔들린다. 바람이 조금 분다(어려울수록)
    const wind = Math.sin(this.t * 0.7) * 6 * this.d;
    const alpha = -(Crane.G / this.L) * Math.sin(this.th) - (this.ax / this.L) * Math.cos(this.th) + wind / this.L - (0.9 + this.body * 0.3) * this.om;
    this.om += alpha * dt;
    this.th += this.om * dt;
    if (this.cool > 0) return;
    if (inp.held.D) this.L = Math.min(150, this.L + 34 * dt);
    if (inp.held.U) this.L = Math.max(26, this.L - 40 * dt);
    const [lx, ly] = this.loadPos();
    if (ly + 7 >= this.surfaceAt(lx)) this.land(lx);
  }
  land(lx: number): void {
    const off = Math.abs(lx - this.tx);
    const swing = Math.abs(this.om * this.L);
    const onPlat = Math.abs(lx - this.tx) <= 24 && this.platY < 164;
    if (onPlat && off <= this.tw && swing < 30) {
      const q = clamp(100 - off * 2.5 - swing * 1.2, 55, 100);
      this.results.push(q); this.loads++;
      this.pop(this.tx, this.platY - 22, q >= 90 ? '완벽해요!' : '좋아요!', true, 'good');
      this.newTarget();
      this.cool = 0.6;
    } else {
      this.bumps++;
      this.pop(lx, this.surfaceAt(lx) - 20, swing >= 30 ? '흔들려요! 쿵!' : '자리가 아니에요!', false, 'thud');
      this.L = Math.max(26, this.L - 26); this.om *= -0.4; this.cool = 0.5;
    }
  }
  score(): number {
    if (!this.results.length) return Math.max(0, 10 - this.bumps * 3);
    const avg = this.results.reduce((a, b) => a + b, 0) / this.results.length;
    return clamp(avg * Math.min(1, this.loads / 4) - this.bumps * 4, 0, 100);
  }
}

// ─────────── 5. 현장 정리: 줍고 버리고, 지게차 피하기 ───────────
export interface Junk { x: number; y: number; type: number }
export class Clean extends Mini {
  kind = 'clean' as const; dur = 45;
  px = 160; py = 110; carry = 0; delivered = 0; hits = 0; stun = 0; running = false; facing = 1;
  junk: Junk[] = []; bin = { x: 28, y: 100 };
  fork = { i: 0, t: 0, x: 0, y: 0 };
  route: Array<[number, number]> = [[70, 46], [290, 46], [290, 160], [70, 160]];
  constructor(d: number, body: number, seed: number) { super(d, body, seed); for (let i = 0; i < 7; i++) this.spawn(); [this.fork.x, this.fork.y] = this.route[0]; }
  target(): number { return Math.round(11 + this.d * 6); }
  spawn(): void {
    for (let k = 0; k < 20; k++) {
      const x = 60 + this.r() * 245, y = 36 + this.r() * 130;
      if (Math.hypot(x - this.bin.x, y - this.bin.y) > 40) { this.junk.push({ x, y, type: Math.floor(this.r() * 4) }); return; }
    }
  }
  forkSpeed(): number { return 46 + this.d * 34; }
  update(dt: number, inp: Inp): void {
    // 지게차는 정해진 길을 돈다
    const f = this.fork, a = this.route[f.i], b = this.route[(f.i + 1) % this.route.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    f.t += this.forkSpeed() * dt / len;
    if (f.t >= 1) { f.t = 0; f.i = (f.i + 1) % this.route.length; }
    f.x = a[0] + (b[0] - a[0]) * f.t; f.y = a[1] + (b[1] - a[1]) * f.t;
    if (this.stun > 0) { this.stun -= dt; return; }
    const mx = (inp.held.R ? 1 : 0) - (inp.held.L ? 1 : 0), my = (inp.held.D ? 1 : 0) - (inp.held.U ? 1 : 0);
    this.running = !!inp.held.A && (mx !== 0 || my !== 0);
    const sp = (this.running ? 92 : 58) * this.body * (1 - this.carry * 0.08);
    const n = Math.hypot(mx, my) || 1;
    this.px = clamp(this.px + mx / n * sp * dt, 12, 308);
    this.py = clamp(this.py + my / n * sp * dt, 30, 170);
    if (mx) this.facing = mx;
    // 줍기 (한 번에 3개까지)
    for (const j of this.junk) if (this.carry < 3 && Math.hypot(j.x - this.px, j.y - this.py) < 11) { j.x = -99; this.carry++; this.events.push('pick'); }
    this.junk = this.junk.filter((j) => j.x > -50);
    if (this.carry > 0 && Math.hypot(this.bin.x - this.px, this.bin.y - this.py) < 18) {
      this.delivered += this.carry;
      this.pop(this.bin.x + 10, this.bin.y - 20, `+${this.carry}`, true, 'dump');
      for (let i = 0; i < this.carry; i++) this.spawn();
      this.carry = 0;
    }
    // 지게차에 치이면 멈칫하고 든 걸 떨어뜨린다
    if (Math.hypot(f.x - this.px, f.y - this.py) < 13) {
      this.hits++; this.stun = 1.3;
      for (let i = 0; i < this.carry; i++) this.junk.push({ x: clamp(this.px + (this.r() - 0.5) * 30, 50, 305), y: clamp(this.py + (this.r() - 0.5) * 30, 36, 166), type: 0 });
      this.carry = 0;
      this.pop(this.px, this.py - 20, '위험해요!', false, 'bonk');
      this.px = clamp(this.px + (this.px - f.x) * 1.5, 12, 308); this.py = clamp(this.py + (this.py - f.y) * 1.5, 30, 170);
    }
  }
  score(): number { return clamp(100 * Math.min(1, this.delivered / this.target()) - this.hits * 12, 0, 100); }
}

// ─────────── 6. 벽돌 쌓기: 오가는 벽돌을 아래 벽돌 위에 딱 맞게 ───────────
export interface Brick { x: number; w: number; perfect: boolean }
export class BrickWall extends Mini {
  kind = 'brick' as const; dur = 45;
  static BASE = 160; static H = 10;
  stack: Brick[] = []; x = 40; w = 0; dir = 1; wait = 0.4; walls = 0; drops = 0; acc = 0; perfects = 0; fallen = 0; combo = 0;
  constructor(d: number, body: number, seed: number) { super(d, body, seed); this.newWall(); }
  w0(): number { return 62 - this.d * 18; }
  speed(): number { return 80 + this.d * 160 + Math.min(14, this.stack.length) * 4; }
  tol(): number { return 1 + this.body * 2; }
  newWall(): void { this.stack = [{ x: 160, w: this.w0(), perfect: true }]; this.w = this.w0(); this.x = 40; this.dir = 1; this.walls++; }
  top(): Brick { return this.stack[this.stack.length - 1]; }
  update(dt: number, inp: Inp): void {
    if (this.wait > 0) { this.wait -= dt; if (this.fallen > 0) this.fallen -= dt; return; }
    this.x += this.dir * this.speed() * dt;
    if (this.x > 300 - this.w / 2) { this.x = 300 - this.w / 2; this.dir = -1; }
    if (this.x < 20 + this.w / 2) { this.x = 20 + this.w / 2; this.dir = 1; }
    if (!inp.hit.A) return;
    const t = this.top(), dx = this.x - t.x;
    this.drops++;
    if (Math.abs(dx) <= this.tol()) {
      this.stack.push({ x: t.x, w: this.w, perfect: true });
      this.acc += 1; this.perfects++; this.combo++;
      this.pop(t.x, this.y(this.stack.length) - 8, this.combo >= 3 ? `딱! ${this.combo}연속` : '딱!', true, 'press');
    } else {
      const lo = Math.max(this.x - this.w / 2, t.x - t.w / 2), hi = Math.min(this.x + this.w / 2, t.x + t.w / 2);
      const over = hi - lo;
      this.combo = 0;
      if (over < 6) {
        this.fallen = 1.2; this.wait = 2.4;
        this.pop(160, 90, '와르르! 처음부터', false, 'thud');
        this.newWall();
        return;
      }
      this.acc += Math.pow(over / this.w, 1.5);
      this.w = over;
      this.stack.push({ x: (lo + hi) / 2, w: over, perfect: false });
      this.pop((lo + hi) / 2, this.y(this.stack.length) - 8, over / t.w > 0.8 ? '좋아' : '삐뚤다', over / t.w > 0.8, 'box');
    }
    this.x = this.dir > 0 ? 20 + this.w / 2 : 300 - this.w / 2;
    this.wait = 0.35;
  }
  /** i층 벽돌의 화면 높이 (높이 쌓이면 아래로 밀어 보여 준다) */
  y(i: number): number { const shift = Math.max(0, this.stack.length - 9) * BrickWall.H; return BrickWall.BASE - i * BrickWall.H + shift; }
  target(): number { return 20 + this.d * 6; }
  score(): number { return clamp(100 * this.acc / this.target(), 0, 100); }
}

// ─────────── 7. 함바 주방: 주문 화살표를 순서대로 ───────────
export type Arrow = 'U' | 'D' | 'L' | 'R';
export interface Order { seq: Arrow[]; pos: number; t: number; max: number; dish: number }
export class Kitchen extends Mini {
  kind = 'kitchen' as const; dur = 45;
  orders: Order[] = []; next = 0.3; served = 0; lost = 0; slips = 0; shake = 0;
  len(): number { return 3 + Math.floor(this.d * 4 + this.r() * 1.5); }
  update(dt: number, inp: Inp): void {
    this.shake = Math.max(0, this.shake - dt);
    this.next -= dt;
    if (this.next <= 0 && this.orders.length < 3) {
      const n = this.len(), arrows: Arrow[] = ['U', 'D', 'L', 'R'];
      const max = (4 + n * 0.9) * (1.3 - this.d * 0.6) * (0.8 + this.body * 0.2);
      this.orders.push({ seq: Array.from({ length: n }, () => arrows[Math.floor(this.r() * 4)]), pos: 0, t: max, max, dish: Math.floor(this.r() * 4) });
      this.next = (2.6 - this.d * 1.3) * (0.8 + this.r() * 0.4);
      this.events.push('tick');
    }
    for (const o of this.orders) o.t -= dt;
    const gone = this.orders.filter((o) => o.t <= 0);
    if (gone.length) { this.lost += gone.length; this.orders = this.orders.filter((o) => o.t > 0); this.pop(250, 60, '손님이 그냥 갔다…', false, 'bad'); }
    const o = this.orders[0];
    const k = (['U', 'D', 'L', 'R'] as Arrow[]).find((a) => inp.hit[a]);
    if (!o || !k) return;
    if (o.seq[o.pos] === k) {
      o.pos++;
      this.events.push('turn');
      if (o.pos >= o.seq.length) {
        this.served++; this.orders.shift();
        this.pop(90, 70, o.t > o.max * 0.5 ? '빨리 나왔네!' : '나왔습니다!', true, 'good');
      }
    } else {
      o.pos = 0; this.slips++; this.shake = 0.25;
      this.pop(90, 70, '앗, 처음부터', false, 'bad');
    }
  }
  target(): number { return 10 + this.d * 6; }
  score(): number {
    const n = this.served + this.lost + this.slips * 0.3;
    return n === 0 ? 0 : clamp(100 * (this.served / n) * Math.min(1, this.served / this.target()), 0, 100);
  }
}

// ─────────── 8. 철근 나르기: 기우는 철근 바로잡기 + 걸림돌 넘기 ───────────
export class Rebar extends Mini {
  kind = 'rebar' as const; dur = 45;
  static TRIP = 600; static GOAL = 2300;
  th = 0; om = 0; dist = 0; stall = 0; jump = 0; drops = 0; trips = 0; stumbles = 0;
  gust = 0; gustT = 0; rocks: number[] = []; pushing = 0;
  constructor(d: number, body: number, seed: number) { super(d, body, seed); this.newTrip(); }
  newTrip(): void {
    this.rocks = [];
    let x = 120;
    while (x < Rebar.TRIP - 60) { this.rocks.push(x); x += 90 + this.r() * 120 - this.d * 30; }
  }
  pos(): number { return this.dist % Rebar.TRIP; }
  speed(): number { return 46 + this.body * 20; }
  update(dt: number, inp: Inp): void {
    // 바람·어깨 흔들림
    this.gustT -= dt;
    if (this.gustT <= 0) { this.gust = (this.r() * 2 - 1) * (0.7 + this.d * 2.2); this.gustT = 0.5 + this.r() * 0.7; }
    const u = ((inp.held.R ? 1 : 0) - (inp.held.L ? 1 : 0)) * 7.5 * (0.75 + this.body * 0.25);
    this.pushing = u;
    const k = 2.4 + this.d * 5;
    this.om += (k * Math.sin(this.th) + this.gust + u - 1.1 * this.om) * dt;
    this.th += this.om * dt;
    if (Math.abs(this.th) > 0.62) {
      this.drops++; this.stall = 2; this.th = 0; this.om = 0;
      this.pop(80, 70, '쨍그랑! 떨어뜨렸다', false, 'thud');
    }
    if (this.jump > 0) { this.jump -= dt; if (this.jump <= 0) this.om += (this.r() - 0.5) * 1.2; }
    else if (inp.hit.U && this.stall <= 0) { this.jump = 0.55; this.events.push('toss'); }
    if (this.stall > 0) { this.stall -= dt; this.th *= 0.9; this.om *= 0.9; return; }
    const before = this.pos();
    this.dist += this.speed() * dt;
    const now = this.pos();
    if (now < before) { this.trips++; this.newTrip(); this.pop(80, 60, '한 묶음 내려놓음!', true, 'dump'); return; }
    // 걸림돌
    for (const x of this.rocks) if (before < x && now >= x && this.jump <= 0) {
      this.stumbles++; this.stall = 0.6; this.om += (this.r() < 0.5 ? -1 : 1) * 2.6;
      this.pop(80, 70, '걸렸다!', false, 'bonk');
    }
  }
  score(): number { return clamp(100 * Math.min(1, this.dist / Rebar.GOAL) - this.drops * 7 - this.stumbles * 3, 0, 100); }
}

export function makeMini(kind: Kind, d: number, body: number, seed: number): Mini {
  switch (kind) {
    case 'sort': return new Sort(d, body, seed);
    case 'line': return new Line(d, body, seed);
    case 'pipe': return new Pipe(d, body, seed);
    case 'crane': return new Crane(d, body, seed);
    case 'clean': return new Clean(d, body, seed);
    case 'brick': return new BrickWall(d, body, seed);
    case 'kitchen': return new Kitchen(d, body, seed);
    case 'rebar': return new Rebar(d, body, seed);
  }
}
