// Kenney Tiny Factory 묶음 그림(16px, 12×11칸)과 사람 색 바꾸기
export const T = 16;
let sheet: HTMLImageElement | null = null;
const workers = new Map<string, HTMLCanvasElement>();

export function loadSheet(): Promise<void> {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => { sheet = im; res(); };
    im.onerror = () => res();
    im.src = 'assets/kenney/tinyfactory.png';
  });
}

/** i번 칸을 (x, y)에 그린다. flip이면 좌우 뒤집기, s는 크기 배율 */
export function tile(c: CanvasRenderingContext2D, i: number, x: number, y: number, flip = false, s = 1): void {
  if (!sheet) return;
  i = Math.floor(i);
  const sx = (i % 12) * T, sy = Math.floor(i / 12) * T;
  if (flip) { c.save(); c.translate(Math.round(x) + T * s, Math.round(y)); c.scale(-1, 1); c.drawImage(sheet, sx, sy, T, T, 0, 0, T * s, T * s); c.restore(); }
  else c.drawImage(sheet, sx, sy, T, T, Math.round(x), Math.round(y), T * s, T * s);
}

// 120번 일꾼 그림의 색: 안전모(밝은·어두운), 작업복(보통·밝은·허리띠), 머리카락, 살
const HELMET = { light: [253, 190, 83], dark: [227, 134, 40] };
const SUIT = { mid: [139, 155, 180], light: [192, 203, 220], belt: [62, 78, 110] };
const HAIR = [189, 108, 74];
export interface Look { helmet: string; suit?: string; hair?: string; skin?: string }
const HELMETS: Record<string, [number[], number[]]> = {
  yellow: [[253, 190, 83], [227, 134, 40]],
  white: [[244, 244, 240], [190, 196, 204]],
  red: [[232, 86, 74], [172, 50, 50]],
  blue: [[96, 160, 230], [58, 102, 176]],
  orange: [[250, 150, 60], [206, 96, 32]],
  green: [[122, 200, 98], [70, 140, 64]],
};
const SUITS: Record<string, [number[], number[], number[]]> = {
  grey: [[139, 155, 180], [192, 203, 220], [62, 78, 110]],
  navy: [[74, 92, 140], [120, 140, 190], [40, 48, 84]],
  green: [[96, 130, 96], [150, 180, 140], [52, 74, 56]],
  brown: [[150, 112, 86], [196, 160, 126], [86, 60, 50]],
  orange: [[222, 124, 60], [244, 176, 112], [140, 70, 40]],
};
const HAIRS: Record<string, number[]> = { brown: [189, 108, 74], black: [70, 52, 60], grey: [176, 176, 186], white: [232, 230, 226] };
const same = (p: Uint8ClampedArray, i: number, c: number[]) => Math.abs(p[i] - c[0]) < 8 && Math.abs(p[i + 1] - c[1]) < 8 && Math.abs(p[i + 2] - c[2]) < 8;

/** 안전모·작업복·머리 색을 바꾼 일꾼 그림 (16×16 캔버스) */
export function worker(look: Look): HTMLCanvasElement | null {
  if (!sheet) return null;
  const key = `${look.helmet}/${look.suit ?? 'grey'}/${look.hair ?? 'brown'}`;
  let cv = workers.get(key);
  if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = T; cv.height = T;
  const c = cv.getContext('2d')!;
  c.drawImage(sheet, (120 % 12) * T, Math.floor(120 / 12) * T, T, T, 0, 0, T, T);
  const d = c.getImageData(0, 0, T, T), p = d.data;
  const h = HELMETS[look.helmet] ?? HELMETS.yellow, s = SUITS[look.suit ?? 'grey'], hr = HAIRS[look.hair ?? 'brown'];
  const put = (i: number, col: number[]) => { p[i] = col[0]; p[i + 1] = col[1]; p[i + 2] = col[2]; };
  for (let i = 0; i < p.length; i += 4) {
    if (p[i + 3] === 0) continue;
    if (same(p, i, HELMET.light)) put(i, h[0]);
    else if (same(p, i, HELMET.dark)) put(i, h[1]);
    else if (same(p, i, SUIT.mid)) put(i, s[0]);
    else if (same(p, i, SUIT.light)) put(i, s[1]);
    else if (same(p, i, SUIT.belt)) put(i, s[2]);
    else if (same(p, i, HAIR)) put(i, hr);
  }
  c.putImageData(d, 0, 0);
  workers.set(key, cv);
  return cv;
}
/** 일꾼을 그린다. bob은 걸음 흔들림(픽셀) */
export function person(c: CanvasRenderingContext2D, look: Look, x: number, y: number, flip = false, s = 1, bob = 0): void {
  const cv = worker(look);
  if (!cv) return;
  c.save();
  c.translate(Math.round(x) + (flip ? T * s : 0), Math.round(y - bob));
  if (flip) c.scale(-1, 1);
  c.drawImage(cv, 0, 0, T * s, T * s);
  c.restore();
}

export const INK = '#3f2631';
export function rect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, line?: string): void {
  c.fillStyle = fill; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  if (line) { c.strokeStyle = line; c.lineWidth = 1; c.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w) - 1, Math.round(h) - 1); }
}
/** 캔버스 글자 (테두리 있는 픽셀 글꼴) */
export function text(c: CanvasRenderingContext2D, s: string, x: number, y: number, col = '#fff4de', align: CanvasTextAlign = 'center', size = 11, bold = true): void {
  c.font = `${bold ? 'bold ' : ''}${size}px Galmuri, sans-serif`;
  c.textAlign = align; c.textBaseline = 'middle';
  c.fillStyle = INK;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) c.fillText(s, Math.round(x) + dx, Math.round(y) + dy);
  c.fillStyle = col; c.fillText(s, Math.round(x), Math.round(y));
}
