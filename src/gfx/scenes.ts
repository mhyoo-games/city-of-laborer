// 장면 그림: 새벽 거리·인력사무소·고시원·함바집·포장마차, 그리고 다섯 가지 현장
import { tile, person, rect, text, INK, T, type Look } from './tiles.ts';
import { Sort, Line, Pipe, Crane, Clean, type Mini } from '../games/mini.ts';
import { NPCS, type NpcId, type Weather, type Kind } from '../core/data.ts';

export const W = 320, H = 180;
export const ME: Look = { helmet: 'yellow', suit: 'grey', hair: 'black' };
export const npcLook = (id: NpcId): Look => ({
  helmet: NPCS[id].helmet,
  suit: ({ kim: 'navy', park: 'brown', nguyen: 'grey', sujin: 'orange', minsu: 'green' } as Record<NpcId, string>)[id],
  hair: id === 'park' ? 'grey' : id === 'kim' ? 'black' : 'brown',
});
const EXTRAS: Look[] = [
  { helmet: 'white', suit: 'brown', hair: 'grey' }, { helmet: 'blue', suit: 'navy', hair: 'black' },
  { helmet: 'red', suit: 'green', hair: 'black' }, { helmet: 'green', suit: 'grey', hair: 'brown' },
  { helmet: 'orange', suit: 'navy', hair: 'white' }, { helmet: 'white', suit: 'grey', hair: 'black' },
];

// ─────────── 하늘·도시 ───────────
type Sky = 'dawn' | 'day' | 'dusk' | 'night';
const SKIES: Record<Sky, string[]> = {
  dawn: ['#2b2747', '#5a4466', '#c77a6e', '#f0b27a'],
  day: ['#6fb3e0', '#93c9e8', '#bfe0ee', '#e3f1f2'],
  dusk: ['#3b2a4f', '#7a4a6a', '#d0705a', '#f2a65a'],
  night: ['#120f22', '#1b1830', '#262240', '#302a4a'],
};
function sky(c: CanvasRenderingContext2D, k: Sky, wx: Weather, h = H): void {
  let cols = SKIES[k];
  if (wx === 'rain' || wx === 'cloud') cols = k === 'night' ? ['#141420', '#1c1c2a', '#24242f', '#2a2a36'] : ['#4c5562', '#5f6874', '#717a84', '#858c94'];
  const band = h / cols.length;
  cols.forEach((col, i) => rect(c, 0, i * band, W, band + 1, col));
  if (k === 'night' && wx !== 'rain') for (let i = 0; i < 26; i++) rect(c, (i * 73) % W, (i * 37) % 70, 1, 1, '#d8d4ff');
  if (k === 'dawn' && wx === 'sun') { c.fillStyle = '#ffd890'; c.beginPath(); c.arc(250, h - 8, 14, Math.PI, 0); c.fill(); }
  if (k === 'day' && wx !== 'rain' && wx !== 'cloud') { c.fillStyle = wx === 'heat' ? '#fff0a0' : '#fff8d8'; c.beginPath(); c.arc(270, 26, 11, 0, Math.PI * 2); c.fill(); }
}
const BLD = [[0, 46, 28], [26, 70, 22], [46, 38, 30], [74, 82, 18], [90, 52, 34], [122, 64, 24], [144, 30, 36], [178, 74, 26], [202, 44, 30], [230, 90, 20], [248, 56, 32], [278, 70, 24], [300, 40, 30]];
function city(c: CanvasRenderingContext2D, base: number, col: string, lit: string | null, seed = 0): void {
  for (const [x, h, w] of BLD) {
    rect(c, x, base - h, w, h, col);
    if (lit) for (let yy = base - h + 5; yy < base - 4; yy += 7) for (let xx = x + 3; xx < x + w - 3; xx += 6) if (((xx * 7 + yy * 3 + seed) % 5) === 0) rect(c, xx, yy, 2, 3, lit);
  }
  // 타워 크레인 두 대
  for (const [x, h, arm] of [[60, 118, 70], [214, 104, -60]]) {
    rect(c, x, base - h, 3, h, col);
    rect(c, Math.min(x, x + arm), base - h, Math.abs(arm) + 10, 2, col);
    rect(c, x - 8 * Math.sign(arm), base - h - 2, 8, 6, col);
    rect(c, x + arm * 0.7, base - h + 2, 1, 20, col);
  }
}
function weatherFx(c: CanvasRenderingContext2D, wx: Weather, t: number): void {
  if (wx === 'rain') { c.fillStyle = 'rgba(190,210,240,.55)'; for (let i = 0; i < 70; i++) { const x = (i * 47 + t * 40) % (W + 20) - 10, y = (i * 29 + t * 260) % (H + 10) - 10; c.fillRect(Math.round(x), Math.round(y), 1, 5); } }
  if (wx === 'cold') { c.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 40; i++) { const x = (i * 53 + Math.sin(t + i) * 10) % W, y = (i * 31 + t * 22) % H; c.fillRect(Math.round(x), Math.round(y), 2, 2); } }
  if (wx === 'heat') { c.fillStyle = 'rgba(255,140,40,.10)'; c.fillRect(0, 0, W, H); }
}
function floorRow(c: CanvasRenderingContext2D, y: number, alt = 0): void { for (let x = 0; x < W; x += T) tile(c, ((x / T + alt) % 3), x, y); }
function van(c: CanvasRenderingContext2D, x: number, y: number, lights: boolean): void {
  rect(c, x, y, 54, 22, '#e8e4dc', INK); rect(c, x + 38, y - 6, 16, 10, '#e8e4dc', INK);
  rect(c, x + 41, y - 4, 11, 6, '#5d7290'); rect(c, x + 4, y + 4, 30, 7, '#5d7290');
  rect(c, x + 2, y + 13, 50, 2, '#4c7fd0');
  for (const wx of [x + 8, x + 40]) { rect(c, wx, y + 18, 9, 9, '#2b2530'); rect(c, wx + 3, y + 21, 3, 3, '#8a8a96'); }
  if (lights) { rect(c, x + 52, y + 4, 3, 3, '#ffe68a'); c.fillStyle = 'rgba(255,230,140,.18)'; c.beginPath(); c.moveTo(x + 55, y + 4); c.lineTo(x + 110, y - 8); c.lineTo(x + 110, y + 26); c.fill(); }
}

// ─────────── 장면 ───────────
export type SceneName = 'title' | 'room' | 'roomNight' | 'office' | 'lunch' | 'pocha' | 'street' | 'site' | 'end';
export interface SceneOpt { wx: Weather; t: number; kind?: Kind; npc?: NpcId; crowd?: number; me?: boolean; gone?: boolean }

export function scene(c: CanvasRenderingContext2D, name: SceneName, o: SceneOpt): void {
  c.imageSmoothingEnabled = false;
  const t = o.t;
  switch (name) {
    case 'title': case 'end': {
      const dawn = name === 'end';
      sky(c, dawn ? 'dawn' : 'night', 'sun');
      city(c, 140, dawn ? '#3a2e48' : '#221d36', dawn ? '#f8d890' : '#f8d070', 3);
      rect(c, 0, 140, W, 40, '#2c2638');
      for (let x = 0; x < W; x += 24) rect(c, (x - t * 20) % (W + 24), 158, 12, 2, '#6a6070');
      for (let i = 0; i < 5; i++) { const x = ((i * 70 + t * 14) % (W + 40)) - 20; person(c, EXTRAS[i], x, 126, false, 1, Math.abs(Math.sin(t * 6 + i)) * 1.5); }
      break;
    }
    case 'street': case 'office': {
      sky(c, 'dawn', o.wx, 120);
      city(c, 112, '#3a3048', '#e8c48a', 1);
      // 인력사무소 건물 (오른쪽은 메뉴가 덮으니 왼쪽에)
      const bx = 24;
      rect(c, bx, 52, 120, 64, '#6b5a5a', INK); rect(c, bx, 52, 120, 6, '#504048');
      rect(c, bx + 8, 60, 104, 16, '#2e5c9a', INK); text(c, '새벽 인력', bx + 60, 68, '#ffffff', 'center', 11);
      rect(c, bx + 48, 84, 26, 32, '#3a2a30', INK); rect(c, bx + 50, 86, 22, 28, '#f0c070');
      rect(c, bx + 12, 84, 26, 18, '#f0c070', INK); rect(c, bx + 84, 84, 26, 18, '#f0c070', INK);
      rect(c, 0, 116, W, 64, '#3d3644');
      for (let x = 0; x < W; x += T) tile(c, 3, x, 116);
      // 기다리는 사람들 (쪼그려 앉거나 서서)
      const n = o.crowd ?? 7;
      for (let i = 0; i < n; i++) {
        const x = 18 + i * 34 + (i % 2) * 6, y = 128 + (i % 3) * 8;
        person(c, EXTRAS[i % EXTRAS.length], x, y, i % 2 === 0);
        if (i % 3 === 0) { rect(c, x + 12, y + 2, 3, 4, '#f4f0e8'); const s = (t * 0.6 + i) % 1; c.fillStyle = `rgba(255,255,255,${0.5 - s * 0.5})`; c.fillRect(x + 13, y - 2 - s * 8, 1, 2); }
      }
      if (o.me) person(c, ME, 86, 142, false, 1, Math.abs(Math.sin(t * 2)) * 0.6);
      if (!o.gone) van(c, 150, 134, true);
      rect(c, 8, 26, 34, 12, '#1a1622', INK); text(c, '04:50', 25, 32, '#ff6a5a', 'center', 9);
      weatherFx(c, o.wx, t);
      break;
    }
    case 'room': case 'roomNight': {
      const night = name === 'roomNight';
      rect(c, 0, 0, W, H, night ? '#2a2434' : '#3a3242');
      rect(c, 0, 132, W, 48, night ? '#3a2e30' : '#4a3a38');
      for (let x = 0; x < W; x += 20) rect(c, x, 132, 1, 48, '#00000030');
      // 창문
      rect(c, 78, 22, 72, 54, INK);
      c.save(); c.beginPath(); c.rect(81, 25, 66, 48); c.clip(); c.translate(81, 25); c.scale(66 / W, 48 / 120);
      sky(c, night ? 'night' : 'dawn', o.wx, 120); city(c, 120, night ? '#141020' : '#3a3048', '#f0c070', 2); weatherFx(c, o.wx, t);
      c.restore();
      rect(c, 113, 25, 2, 48, INK); rect(c, 81, 48, 66, 2, INK);
      // 옷걸이에 걸린 작업복·안전모
      rect(c, 36, 34, 2, 60, '#8a7a70'); rect(c, 26, 44, 22, 30, '#8b9bb4', INK); rect(c, 28, 36, 18, 8, '#fdbe53', INK);
      // 이불·베개
      rect(c, 6, 112, 112, 26, '#7a8ab0', INK); rect(c, 10, 104, 34, 14, '#f0eadc', INK);
      rect(c, 46, 108, 70, 18, '#9aa8c8', INK);
      person(c, ME, 18, 96, false, 1, night ? 0 : Math.abs(Math.sin(t * 1.4)));
      // 알람 시계
      rect(c, 122, 118, 26, 14, '#d8d2c8', INK); text(c, night ? '23:10' : '04:30', 135, 125, night ? '#7ad0ff' : '#ff6a5a', 'center', 9);
      if (!night && Math.floor(t * 3) % 2 === 0) text(c, '따르릉', 135, 108, '#ffe08a', 'center', 9);
      if (night) { c.fillStyle = 'rgba(255,220,140,.12)'; c.fillRect(0, 0, W, H); }
      break;
    }
    case 'lunch': {
      sky(c, 'day', o.wx, 110);
      city(c, 108, '#8aa0b8', null);
      for (let x = 0; x < W; x += T) { tile(c, (x / T) % 3, x, 110); tile(c, (x / T + 1) % 3, x, 126); tile(c, (x / T + 2) % 3, x, 142); tile(c, (x / T) % 3, x, 158); tile(c, 1, x, 174); }
      // 함바집 천막
      rect(c, 6, 40, 146, 70, '#e8e0d0', INK);
      for (let x = 6; x < 152; x += 16) rect(c, x, 34, 8, 10, '#d8483a');
      rect(c, 6, 34, 146, 2, INK);
      text(c, '함바 식당', 79, 54, '#c83a2e', 'center', 12);
      rect(c, 18, 66, 122, 30, '#b88a5a', INK);
      // 밥 먹는 사람들
      for (let i = 0; i < 4; i++) { person(c, i === 1 ? ME : EXTRAS[i + 1], 22 + i * 28, 82 + (i === 1 ? Math.abs(Math.sin(t * 4)) : 0), i % 2 === 1); rect(c, 26 + i * 28, 80, 7, 4, '#f4f0e8', INK); }
      tile(c, 72, 220, 96); tile(c, 84, 236, 96); tile(c, 126, 260, 100); tile(c, 109, 280, 104);
      weatherFx(c, o.wx, t);
      break;
    }
    case 'pocha': {
      sky(c, 'night', o.wx, 120);
      city(c, 116, '#151224', '#f0c070', 5);
      rect(c, 0, 116, W, 64, '#1e1a26');
      // 주황 포장마차
      rect(c, 6, 50, 146, 86, '#e8743a', INK);
      c.fillStyle = 'rgba(255,190,110,.35)'; c.fillRect(12, 60, 134, 70);
      rect(c, 6, 44, 146, 10, '#c85a2a', INK);
      text(c, '오뎅 · 소주', 79, 70, '#fff4de', 'center', 12);
      rect(c, 78, 54, 2, 8, INK); c.fillStyle = '#fff0a0'; c.beginPath(); c.arc(79, 64, 3, 0, Math.PI * 2); c.fill();
      rect(c, 18, 112, 122, 8, '#8a5a3a', INK);
      person(c, ME, 36, 98, false); if (o.npc) person(c, npcLook(o.npc), 104, 98, true);
      rect(c, 66, 104, 5, 8, '#5aa05a', INK); rect(c, 76, 106, 8, 6, '#f4f0e8', INK);
      for (let i = 0; i < 3; i++) { const s = (t * 0.5 + i * 0.33) % 1; c.fillStyle = `rgba(255,255,255,${0.4 - s * 0.4})`; c.fillRect(78 + i, 100 - s * 14, 2, 2); }
      weatherFx(c, o.wx, t);
      break;
    }
    case 'site': {
      siteBg(c, o.kind ?? 'clean', o.wx);
      // 현장 소품
      const props: Record<Kind, number[]> = { clean: [109, 126, 117], sort: [73, 85, 110], line: [75, 111, 74], pipe: [94, 123, 92], crane: [124, 125, 72] };
      props[o.kind ?? 'clean'].forEach((i, k) => tile(c, i, 12 + k * 18, 140));
      person(c, ME, 56, 116, false, 1, Math.abs(Math.sin(t * 3)));
      if (o.npc) person(c, npcLook(o.npc), 84, 116, true);
      weatherFx(c, o.wx, t);
      break;
    }
  }
}

function siteBg(c: CanvasRenderingContext2D, kind: Kind, wx: Weather): void {
  const indoor = kind === 'sort' || kind === 'line';
  if (indoor) {
    rect(c, 0, 0, W, H, '#3a3242');
    for (let x = 0; x < W; x += T) { tile(c, 44 + (x / T) % 4, x, 0); tile(c, 44 + (x / T + 2) % 4, x, 16); }
    for (let y = 32; y < H; y += T) for (let x = 0; x < W; x += T) tile(c, 9 + ((x / T + y / T) % 3), x, y);
  } else {
    sky(c, 'day', wx, 90);
    city(c, 90, '#8aa0b8', null);
    for (let y = 90; y < H; y += T) floorRow(c, y, y / T);
  }
}

// ─────────── 현장 미니게임 그림 ───────────
export function drawMini(c: CanvasRenderingContext2D, m: Mini, wx: Weather): void {
  c.imageSmoothingEnabled = false;
  if (m instanceof Sort) drawSort(c, m);
  else if (m instanceof Line) drawLine(c, m);
  else if (m instanceof Pipe) drawPipe(c, m);
  else if (m instanceof Crane) drawCrane(c, m, wx);
  else if (m instanceof Clean) drawClean(c, m, wx);
  for (const p of m.pops) text(c, p.text, p.x, p.y - p.t * 18, p.good ? '#bff07a' : '#ff8a7a', 'center', 10);
  // 남은 시간 막대
  const f = m.left() / m.dur;
  rect(c, 8, 4, 304, 6, INK); rect(c, 9, 5, 302 * f, 4, f < 0.2 ? '#ff6a5a' : '#ffd06a');
  if (wx === 'rain' && !(m instanceof Sort) && !(m instanceof Line)) weatherFx(c, wx, m.t);
}
function conveyor(c: CanvasRenderingContext2D, y: number, x0: number, x1: number, t: number, speed: number, flip: boolean): void {
  const frames = [37, 38, 39];
  const k = Math.floor(t * speed / 8) % 3;
  for (let x = x0; x < x1; x += T) tile(c, frames[(k + x / T) % 3], x, y, flip);
}
function drawSort(c: CanvasRenderingContext2D, m: Sort): void {
  siteBg(c, 'sort', 'sun');
  // 위: 트럭 짐칸, 아래: 대차
  rect(c, 20, 40, 120, 36, '#c8483a', INK); text(c, '▲ 빨강: 트럭', 80, 58, '#fff4de', 'center', 10);
  rect(c, 20, 132, 120, 30, '#3a6ac8', INK); text(c, '▼ 파랑: 대차', 80, 147, '#fff4de', 'center', 10);
  text(c, '◀ 딱지 없으면 그냥 보내기', 150, 122, '#ffe08a', 'left', 9);
  conveyor(c, Sort.Y - 8, 0, W, m.t, m.speed(), true);
  rect(c, Sort.ZONE[0], Sort.Y - 30, Sort.ZONE[1] - Sort.ZONE[0], 46, 'rgba(255,224,120,.12)', '#ffe08a');
  person(c, ME, Sort.ZONE[0] + 10, Sort.Y - 34, false, 1, m.events.length ? 2 : 0);
  for (const b of m.boxes) {
    const s = b.big ? 1.5 : 1, x = b.x - 8 * s, y = Sort.Y - 2 - 16 * s + b.oy;
    tile(c, b.big ? 85 : 73, x, y, false, s);
    if (b.lane !== 'pass') rect(c, x + 5 * s, y + 6 * s, 6 * s, 4 * s, b.lane === 'up' ? '#ff4a3a' : '#3a8aff', INK);
    if (b.big && b.state === 'move' && b.hits > 0) text(c, `${b.hits}/${m.need(b)}`, b.x, y - 6, '#fff', 'center', 9);
  }
  text(c, `${m.good}개`, 312, 20, '#bff07a', 'right', 10);
  if (m.combo >= 3) text(c, `${m.combo}연속`, 312, 32, '#ffe08a', 'right', 9);
}
function drawLine(c: CanvasRenderingContext2D, m: Line): void {
  siteBg(c, 'line', 'sun');
  conveyor(c, Line.Y - 8, 0, W, m.t, m.speed(), false);
  // 누름틀
  const X = Line.X, drop = m.press > 0 ? 10 : 0;
  rect(c, X - 18, 40, 36, 14, '#8a96b0', INK); rect(c, X - 3, 54, 6, 22 + drop, '#c8d0e0', INK); rect(c, X - 10, 74 + drop, 20, 8, '#e88a3a', INK);
  rect(c, X - m.win(), Line.Y - 20, m.win() * 2, 2, '#ffe08a');
  tile(c, 111, X + 26, Line.Y - 28); tile(c, 75, X - 42, Line.Y - 28);
  person(c, npcLook('nguyen'), 250, Line.Y - 30, true);
  person(c, ME, X - 8, Line.Y + 14, false);
  for (const p of m.parts) {
    const y = Line.Y - 16 + (p.state === 'out' ? 22 : 0);
    tile(c, p.bad ? 98 : 74, p.x - 8, y);
    if (p.state === 'done') rect(c, p.x - 3, y + 2, 6, 3, p.bad ? '#3a2a2a' : '#7ad07a');
  }
  text(c, `완성 ${m.good}`, 312, 20, '#bff07a', 'right', 10);
  text(c, 'Z 철컥 · X 불량 빼기', 8, 172, '#ffe08a', 'left', 9);
}
function drawPipe(c: CanvasRenderingContext2D, m: Pipe): void {
  siteBg(c, 'pipe', 'sun');
  rect(c, 0, 30, W, 150, 'rgba(40,30,44,.78)');
  const S = Pipe.CELL, ox = Pipe.OX, oy = Pipe.OY;
  tile(c, 90, ox - 22, oy + m.r0 * S + 3);
  tile(c, 95, ox + Pipe.W * S + 4, oy + m.r1 * S + 3);
  for (let y = 0; y < Pipe.H; y++) for (let x = 0; x < Pipe.W; x++) {
    const cell = m.grid[y][x], px = ox + x * S, py = oy + y * S;
    rect(c, px, py, S, S, '#4a4256', '#2c2534');
    const col = cell.wet ? '#4ab0ff' : '#b8c0d0', cx = px + S / 2, cy = py + S / 2;
    const w = 6;
    rect(c, cx - w / 2, cy - w / 2, w, w, col, INK);
    if (cell.m & 1) rect(c, cx - w / 2, py, w, S / 2, col, INK);
    if (cell.m & 4) rect(c, cx - w / 2, cy, w, S / 2, col, INK);
    if (cell.m & 2) rect(c, cx, cy - w / 2, S / 2, w, col, INK);
    if (cell.m & 8) rect(c, px, cy - w / 2, S / 2, w, col, INK);
    rect(c, cx - 2, cy - 2, 4, 4, col);
  }
  const blink = Math.floor(m.t * 4) % 2 === 0;
  c.strokeStyle = blink ? '#ffe08a' : '#fff4de'; c.lineWidth = 2;
  c.strokeRect(ox + m.cx * S + 1, oy + m.cy * S + 1, S - 2, S - 2);
  if (!m.flowing && m.state === 'play') text(c, `물 들어오기까지 ${Math.ceil(m.wait)}초 · 다 이었으면 X로 밸브 열기`, 160, 40, '#ffe08a', 'center', 9);
  else if (m.state === 'play') text(c, '물이 흐른다!', 160, 40, '#7ac8ff', 'center', 10);
  text(c, `이은 관 ${m.results.filter((s) => s >= 85).length}`, 312, 20, '#bff07a', 'right', 10);
  person(c, npcLook('kim'), 286, 150, true);
}
function drawCrane(c: CanvasRenderingContext2D, m: Crane, wx: Weather): void {
  siteBg(c, 'crane', wx);
  for (let x = 0; x < W; x += T) tile(c, 55, x, Crane.TOP - 14);
  tile(c, 128, m.x - 8, Crane.TOP - 12);
  const [lx, ly] = m.loadPos();
  c.strokeStyle = '#2c2534'; c.lineWidth = 1; c.beginPath(); c.moveTo(m.x + 0.5, Crane.TOP); c.lineTo(lx + 0.5, ly - 6); c.stroke();
  tile(c, 127, lx - 8, ly - 14);
  tile(c, 74, lx - 8, ly - 7);
  // 쌓인 층과 깃발
  const floors = Math.round((164 - m.platY) / 18);
  for (let i = 0; i < floors; i++) for (let k = -1; k <= 1; k++) tile(c, 72, m.tx - 8 + k * 16, 164 - 18 * (i + 1) + 2);
  rect(c, m.tx - m.tw, m.platY - 1, m.tw * 2, 2, '#ffe08a');
  tile(c, 125, m.tx + 12, m.platY - 16);
  person(c, ME, 20, 148, false);
  rect(c, 34, 150, 3, 6, '#3a3a44');      // 무전기
  const swing = Math.abs(m.om * m.L);
  text(c, swing < 12 ? '흔들림 ●' : swing < 30 ? '흔들림 ●●' : '흔들림 ●●●', 8, 20, swing < 12 ? '#bff07a' : swing < 30 ? '#ffe08a' : '#ff8a7a', 'left', 9);
  text(c, `내린 짐 ${m.loads}/4`, 312, 20, '#bff07a', 'right', 10);
}
const JUNK = [114, 121, 97, 107];
function drawClean(c: CanvasRenderingContext2D, m: Clean, wx: Weather): void {
  for (let y = 24; y < H; y += T) for (let x = 0; x < W; x += T) tile(c, (x / T + y / T) % 3, x, y);
  rect(c, 0, 0, W, 24, '#8aa0b8');
  for (let x = 0; x < W; x += T) tile(c, 117 + (x / T) % 3, x, 14);
  tile(c, 109, m.bin.x - 8, m.bin.y - 10, false, 1.25); text(c, '마대', m.bin.x + 2, m.bin.y + 16, '#fff4de', 'center', 8);
  for (const j of m.junk) tile(c, JUNK[j.type], j.x - 8, j.y - 8);
  // 지게차 길 표시
  c.strokeStyle = 'rgba(255,200,60,.25)'; c.setLineDash([3, 4]); c.beginPath();
  m.route.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.stroke(); c.setLineDash([]);
  tile(c, 110, m.fork.x - 8, m.fork.y - 10, m.route[(m.fork.i + 1) % 4][0] < m.route[m.fork.i][0]);
  const blink = m.stun > 0 && Math.floor(m.t * 12) % 2 === 0;
  if (!blink) person(c, ME, m.px - 8, m.py - 12, m.facing < 0, 1, m.running ? Math.abs(Math.sin(m.t * 18)) * 2 : 0);
  for (let i = 0; i < m.carry; i++) rect(c, m.px - 4 + i * 3, m.py - 18 - i * 2, 4, 3, '#c8a070', INK);
  text(c, `치운 것 ${m.delivered}/${m.target()}`, 312, 20, '#bff07a', 'right', 10);
  text(c, `들고 있음 ${m.carry}/3`, 8, 20, '#ffe08a', 'left', 9);
  weatherFx(c, wx, m.t);
}
