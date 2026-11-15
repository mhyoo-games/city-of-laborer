// 노동자의 도시 — 화면 흐름
// 제목 → 새로 시작(사연·이름) → [새벽 → 인력사무소 → 오전 일 → 점심 → 오후 일 → 일당 → 저녁 → 일기 → 잠] 반복 → 꿈을 이룸
import {
  JOBS, MEALS, EVENINGS, GEAR, GEAR_IDS, LICENSES, LICENSE_IDS, BACKGROUNDS, BG_IDS, NPCS, NPC_IDS, STAMPS, KINDS, DAYS, WEATHER_NAMES, WEATHER_ICON,
  BOSS_LINES, LEVEL_NAMES, MODES, TIERS, ADVANCE, type Kind, type BgId, type MealId, type EveningId, type Mode,
} from './core/data.ts';
import {
  newGame, wake, apply, goHome, endRest, hireChance, chanceWord, difficulty, bodyFactor, finishSession, lunch, payday, evening, canEvening,
  todayNpc, storyReady, startStudy, buyGear, night, sleep, continueAfterGoal, parseSave, levelOf, nextXp, rank, daysToRent, weekday, won, hasSafety,
  SAVE_KEY, canAdvance, takeAdvance, rentOf, livingOf, type Game, type SessionResult, type PayResult, type SleepNews,
} from './core/sim.ts';
import { hash } from './core/rng.ts';
import { makeMini, NO_INPUT, type Mini, type Key, type Inp } from './games/mini.ts';
import { loadSheet } from './gfx/tiles.ts';
import { scene, drawMini, W, H, type SceneName } from './gfx/scenes.ts';
import { text } from './gfx/tiles.ts';
import { Sound } from './audio/sound.ts';

type Screen = 'title' | 'new' | 'wake' | 'rest' | 'office' | 'intro' | 'work' | 'result' | 'lunch' | 'pay' | 'evening' | 'shop' | 'school' | 'story' | 'night' | 'ending' | 'book' | 'credits';
const MUTE_KEY = 'col_mute';

const cv = document.getElementById('game') as HTMLCanvasElement;
const cx = cv.getContext('2d')!;
const wrap = document.getElementById('wrap')!;
const hud = document.getElementById('hud')!;
const ui = document.getElementById('ui')!;
const snd = new Sound();
try { snd.setMuted(localStorage.getItem(MUTE_KEY) === '1'); } catch { /* */ }

let g: Game | null = null;
let screen: Screen = 'title';
let prev: Screen = 'title';
let t = 0, st = 0;
let mini: Mini | null = null;
let session: 1 | 2 = 1;
let countdown = 0;
let lastRes: SessionResult | null = null;
let lastPay: PayResult | null = null;
let news: SleepNews | null = null;
let diaryText = '';
let newStamps: string[] = [];
let storyI = 0;
let bookTab = 0;
let pickBg: BgId = 'youth';
let pickMode: Mode = 'normal';
/** 가난한 정도 0~2 (그림·말에 씀) */
const poorLevel = (x: Game | null) => !x ? 0 : x.home === 'street' || x.hunger >= 2 ? 2 : x.home === 'sauna' || x.hunger > 0 || x.money < 20000 ? 1 : 0;

// ─────────── 저장 ───────────
function loadGame(): Game | null { try { return parseSave(localStorage.getItem(SAVE_KEY)); } catch { return null; } }
function store(): void { if (!g) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(g)); } catch { /* 저장 못 해도 계속 */ } }

// ─────────── 화면 크기 ───────────
function fit(): void {
  const vw = window.innerWidth, vh = window.innerHeight;
  const touch = document.body.classList.contains('touch');
  // 세로 휴대폰: 위에 그림, 아래에 메뉴를 제 크기로 (960 폭을 줄이면 글자가 너무 작다)
  const portrait = vh > vw * 1.1 && vw < 760;
  document.body.classList.toggle('portrait', portrait);
  const s = portrait ? vw / 960 : Math.min(vw / 960, vh / 540);
  wrap.style.transform = `scale(${s})`;
  wrap.style.left = `${(vw - 960 * s) / 2}px`;
  const top = portrait ? 0 : (vh - 540 * s) / 2;
  wrap.style.top = `${top}px`;
  if (portrait) {
    if (ui.parentElement === wrap) { document.body.append(hud, ui); }
    hud.style.top = `${540 * s}px`;
    ui.style.top = `${540 * s + (hud.classList.contains('off') ? 0 : hud.offsetHeight)}px`;
  } else if (ui.parentElement !== wrap) { wrap.append(hud, ui); hud.style.top = ''; ui.style.top = ''; }
  void touch;
}
window.addEventListener('resize', fit);
window.addEventListener('orientationchange', () => setTimeout(fit, 200));

// ─────────── 입력 ───────────
const held: Partial<Record<Key, boolean>> = {};
let hit: Partial<Record<Key, boolean>> = {};
const KEYMAP: Record<string, Key> = { ArrowLeft: 'L', ArrowRight: 'R', ArrowUp: 'U', ArrowDown: 'D', KeyZ: 'A', Space: 'A', Enter: 'A', KeyX: 'B', KeyA: 'L', KeyD: 'R', KeyW: 'U', KeyS: 'D' };
window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement)?.tagName === 'INPUT' && e.code !== 'Enter') return;
  snd.unlock();
  const k = KEYMAP[e.code];
  if (e.code === 'Escape' || e.code === 'Backspace') { if (screen === 'book' || screen === 'shop' || screen === 'school' || screen === 'credits') { e.preventDefault(); back(); } return; }
  if (!k) return;
  e.preventDefault();
  if (!held[k]) hit[k] = true;
  held[k] = true;
  if (screen !== 'work') menuKey(k);
});
window.addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) held[k] = false; });
window.addEventListener('blur', () => { for (const k in held) held[k as Key] = false; });
window.addEventListener('pointerdown', () => snd.unlock(), { capture: true });
window.addEventListener('touchstart', () => { if (!document.body.classList.contains('touch')) { document.body.classList.add('touch'); fit(); } }, { passive: true });
for (const b of Array.from(document.querySelectorAll<HTMLButtonElement>('#pad button'))) {
  const k = b.dataset.k as Key;
  const down = (e: Event) => { e.preventDefault(); snd.unlock(); if (!held[k]) hit[k] = true; held[k] = true; b.classList.add('on'); };
  const up = (e: Event) => { e.preventDefault(); held[k] = false; b.classList.remove('on'); };
  b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
}

// ─────────── 메뉴 ───────────
interface Opt { label: string; sub?: string; tags?: Array<[string, boolean?]>; on: () => void; off?: boolean; sfx?: string }
let opts: Opt[] = [];
let sel = 0;
function esc(s: string): string { return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!)); }
function panel(cls: string, html: string, list: Opt[], row = false): void {
  opts = list;
  sel = Math.max(0, list.findIndex((o) => !o.off));
  const p = document.createElement('div');
  p.className = 'panel ' + cls;
  p.innerHTML = html + (list.length ? `<div class="opts${row ? ' row' : ''}"></div>` : '');
  const box = p.querySelector('.opts');
  list.forEach((o, i) => {
    const b = document.createElement('button');
    b.className = 'opt';
    b.disabled = !!o.off;
    b.innerHTML = esc(o.label) + (o.tags ?? []).map(([s, warn]) => `<span class="tag${warn ? ' warn' : ''}">${esc(s)}</span>`).join('') + (o.sub ? `<small>${esc(o.sub)}</small>` : '');
    b.addEventListener('click', () => choose(i));
    b.addEventListener('pointerenter', () => { if (!o.off) { sel = i; mark(); } });
    box!.appendChild(b);
  });
  ui.replaceChildren(p);
  mark();
}
function mark(scroll = false): void {
  const bs = ui.querySelectorAll<HTMLButtonElement>('.opt');
  bs.forEach((b, i) => b.classList.toggle('sel', i === sel));
  if (scroll) bs[sel]?.scrollIntoView({ block: 'nearest' });
}
function choose(i: number): void {
  const o = opts[i];
  if (!o || o.off) { snd.sfx('no'); return; }
  snd.sfx(o.sfx ?? 'select');
  o.on();
}
function menuKey(k: Key): void {
  if (!opts.length) return;
  if (k === 'U' || k === 'L' || k === 'D' || k === 'R') {
    const d = k === 'U' || k === 'L' ? -1 : 1;
    for (let n = 0; n < opts.length; n++) { sel = (sel + d + opts.length) % opts.length; if (!opts[sel].off) break; }
    snd.sfx('tick'); mark(true);
  } else if (k === 'A') {
    if ((document.activeElement as HTMLElement)?.tagName === 'INPUT') return;
    choose(sel);
  } else if (k === 'B' && (screen === 'book' || screen === 'shop' || screen === 'school' || screen === 'credits')) back();
}
function toast(s: string): void {
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = s;
  wrap.appendChild(d); setTimeout(() => d.remove(), 2700);
}
const say = (who: string, s: string) => `<div class="say"><b>${esc(who)}</b> ${esc(s)}</div>`;

// ─────────── 위쪽 상태 막대 ───────────
function bar(v: number, max: number, col: string): string { return `<span class="bar"><i style="width:${Math.max(0, Math.min(100, v / max * 100))}%;background:${col}"></i></span>`; }
function drawHud(): void {
  const hide = !g || screen === 'title' || screen === 'new' || screen === 'work' || screen === 'credits' || screen === 'ending';
  hud.classList.toggle('off', hide);
  if (document.body.classList.contains('portrait')) fit();
  if (hide || !g) return;
  hud.innerHTML = `<span>${g.day}일째 ${DAYS[weekday(g.day)]} ${WEATHER_ICON[g.weather]}</span>`
    + `<span>체력${bar(g.stamina, g.staminaMax, '#7ad07a')}</span>`
    + `<span>피로${bar(g.fatigue, 100, '#e86a5a')}</span>`
    + `<span>마음${bar(g.mood, 100, '#6ab0f0')}</span>`
    + `<span class="goal">꿈${bar(g.money, g.goal, '#ffd06a')}</span>`
    + (g.hunger ? `<span style="color:#ff8a7a">배고픔 ${'●'.repeat(Math.min(5, g.hunger))}</span>` : '')
    + `<span>${g.home === 'room' ? '🏠 고시원' : g.home === 'sauna' ? '♨️ 찜질방' : '🌃 거리'}</span>`
    + `<span class="money" style="${g.money < 20000 ? 'color:#ff8a7a' : ''}">${won(g.money)}${g.advance ? ` <small>(가불 -${won(g.advance)})</small>` : ''}</span>`;
}

// ─────────── 화면 바꾸기 ───────────
function go(s: Screen): void {
  if (s === 'book' || s === 'credits') { if (screen !== 'book' && screen !== 'credits') prev = screen; }
  screen = s; st = 0;
  document.body.dataset.screen = s;
  ui.replaceChildren(); opts = [];
  const music: Partial<Record<Screen, string>> = { title: 'title', new: 'title', credits: 'title', wake: 'dawn', office: 'dawn', rest: 'evening', intro: 'work', work: 'work', result: 'work', lunch: 'lunch', pay: 'lunch', evening: 'evening', shop: 'evening', school: 'evening', story: 'evening', night: 'evening', ending: 'ending' };
  if (music[s]) snd.music(music[s]!);
  (SCREENS[s] ?? (() => {}))();
  drawHud();
}
function back(): void { go(prev); }
const bookOpt = (): Opt => ({ label: '📒 수첩 보기', sub: '숙련·자격증·사람들·도장·일기', on: () => go('book') });

// ─────────── 각 화면 ───────────
const SCREENS: Partial<Record<Screen, () => void>> = {
  title() {
    const saved = loadGame();
    const list: Opt[] = [];
    if (saved) list.push({ label: '이어하기', sub: `${saved.name} · ${BACKGROUNDS[saved.bg].name} · ${saved.day}일째 · ${won(saved.money)}`, on: () => { g = saved; go(g.phase === 'ending' ? 'ending' : 'wake'); }, sfx: 'ok' });
    list.push({ label: saved ? '새로 시작 (지금 저장은 지워져요)' : '새벽 인력시장으로', on: () => go('new'), sfx: 'ok' });
    list.push({ label: snd.muted ? '🔇 소리 켜기' : '🔊 소리 끄기', on: () => { snd.setMuted(!snd.muted); try { localStorage.setItem(MUTE_KEY, snd.muted ? '1' : '0'); } catch { /* */ } go('title'); } });
    list.push({ label: '만든 사람 · 사용한 것', on: () => go('credits') });
    const logo = document.createElement('div'); logo.className = 'logo'; logo.innerHTML = '노동자의 도시<small>새벽 네 시 반, 오늘도 일을 찾아 나선다</small>';
    panel('bottom', '', list, true);
    ui.prepend(logo);
  },
  credits() {
    panel('center', `<h2>만든 사람 · 사용한 것</h2>
      <p>만든 사람: 심심풀이</p>
      <p>그림: Kenney "Tiny Factory" (CC0) — 사람 색·하늘·도시·가게는 코드로 그렸어요.</p>
      <p>글꼴: 갈무리 Galmuri (SIL Open Font License 1.1)</p>
      <p>음악·효과음: 이 게임을 위해 새로 만든 곡, 브라우저에서 바로 합성해요.</p>
      <p class="muted">이야기 속 사람·회사·현장 이름은 모두 지어낸 것이에요. 일당·비용은 게임에 맞게 단순하게 정한 숫자예요.</p>`,
    [{ label: '돌아가기', on: back }]);
  },
  new() {
    const b = BACKGROUNDS[pickBg];
    const list: Opt[] = BG_IDS.map((id) => ({ label: `${BACKGROUNDS[id].name} (${BACKGROUNDS[id].age})${id === pickBg ? ' ✔' : ''}`, sub: `꿈: ${BACKGROUNDS[id].goalName} · ${won(BACKGROUNDS[id].goal)}`, on: () => { pickBg = id; go('new'); } }));
    for (const m of ['normal', 'hard'] as Mode[]) list.push({ label: `난이도: ${MODES[m].name}${m === pickMode ? ' ✔' : ''}`, sub: MODES[m].desc, on: () => { pickMode = m; go('new'); } });
    list.push({ label: '이 사람으로 시작', sub: '이름을 적고 시작해요', on: () => {
      const v = (ui.querySelector('input.name') as HTMLInputElement | null)?.value ?? '';
      g = newGame(v || ({ youth: '도윤', father: '상철', elder: '영수' } as Record<BgId, string>)[pickBg], pickBg, Math.floor(Math.random() * 1e6), pickMode);
      store(); go('wake');
    }, sfx: 'ok' });
    panel('wide', `<h2>누구의 하루를 살까요?</h2>
      <p>${esc(b.story)}</p>
      <p class="muted">매주 나가는 돈: ${esc(b.weeklyName)} ${won(b.weekly * MODES[pickMode].weekly)} · 처음 돈 ${won(b.money)} · 체력 ${b.staminaMax} · ${b.licenses.length ? '가진 것: ' + b.licenses.map((l) => LICENSES[l].name).join(', ') : '자격증 없음'}${Object.keys(b.skill).length ? ' · 해 본 일: ' + Object.keys(b.skill).map((k) => JOBS[k as Kind].name).join(', ') : ''}</p>
      <p>이름: <input class="name" maxlength="8" placeholder="${({ youth: '도윤', father: '상철', elder: '영수' } as Record<BgId, string>)[pickBg]}"></p>`, list);
    sel = BG_IDS.length + 2;
    mark();
  },
  wake() {
    if (!g) return go('title');
    const n = news; news = null;
    const lines: string[] = [];
    if (n?.repaid) lines.push(`<p>📩 노동청에서 연락이 왔다. 못 받았던 일당 <b>${won(n.repaid)}</b>이 들어왔다!</p>`);
    if (n?.healed) lines.push('<p>다친 데가 다 나았다. 오늘부터 다시 나갈 수 있다.</p>');
    if (g.hurtDays > 0) lines.push(`<p>🤕 다친 데가 욱신거린다. 오늘은 쉬어야 한다. (${g.hurtDays}일 더)</p>`);
    if (g.burnout) lines.push('<p>😶 몸을 일으킬 힘이 없다. 마음이 너무 지쳤다. 오늘은 쉬자.</p>');
    if (g.weather === 'rain') lines.push('<p>🌧️ 창밖에 비가 온다. 건설 현장은 공칠 것 같다.</p>');
    if (g.weather === 'heat') lines.push('<p>🔥 폭염 주의보. 일당은 조금 더 주지만 체력이 많이 든다.</p>');
    if (g.weather === 'cold') lines.push('<p>❄️ 한파. 손이 곱는다. 일당은 조금 더 준다.</p>');
    if (g.home === 'sauna') lines.push('<p>♨️ 찜질방 수면실에서 눈을 떴다. 허리가 뻐근하다. 방을 다시 얻으려면 일주일 치 방값이 필요하다.</p>');
    if (g.home === 'street') lines.push(`<p>🌃 ${g.streetNights}일째 거리에서 잤다. 씻지 못한 행색 때문에 잘 안 뽑힌다. 찜질방 값(9,000원)이라도 벌어야 한다.</p>`);
    if (g.hunger >= 3) lines.push(`<p>😵 ${g.hunger}일째 제대로 못 먹었다. 눈앞이 핑 돈다. 이대로면 쓰러진다.</p>`);
    else if (g.hunger) lines.push('<p>🍙 어제 저녁을 굶었다. 배에서 소리가 난다. 기운이 덜 난다.</p>');
    if (g.rentOwed) lines.push(`<p>📄 밀린 방값 ${won(g.rentOwed)}. 이번 주도 못 내면 방을 빼야 한다.</p>`);
    if (g.advance) lines.push(`<p class="muted">가불 ${won(g.advance)}은 다음 일당에서 빠진다.</p>`);
    if (g.named) lines.push(`<p>⭐ 어제 일한 ${esc(g.named.site)}에서 오늘도 불러 줄 것 같다.</p>`);
    const dr = daysToRent(g);
    const bgx = BACKGROUNDS[g.bg];
    lines.push(`<p class="muted">${dr === 1 ? '오늘 밤' : dr - 1 + '일 뒤'}: ${g.home === 'room' ? `방값 ${won(rentOf(g))} · ` : ''}${esc(bgx.weeklyName)} ${won(bgx.weekly * MODES[g.mode].weekly)} · 하루 생활비 ${won(livingOf(g))} · 꿈까지 ${won(Math.max(0, g.goal - g.money))}${g.mode === 'hard' ? ' · 고된 삶' : ''}</p>`);
    const cant = g.hurtDays > 0 || g.burnout;
    const list: Opt[] = cant
      ? [{ label: '오늘은 쉰다', on: () => { wake(g!, 'rest'); go('rest'); } }]
      : [
        { label: '일어나서 인력사무소로', sub: '새벽 4시 50분. 일찍 가야 일이 많다.', on: () => { wake(g!, 'up'); go('office'); }, sfx: 'ok' },
        { label: '5분만 더…', sub: '늦게 가면 남은 일이 적고 잘 안 뽑혀요. 대신 체력 +10', on: () => { wake(g!, 'snooze'); go('office'); } },
        { label: '오늘은 쉰다', sub: '피로가 많이 풀리고 마음도 조금 나아져요', on: () => { wake(g!, 'rest'); go('rest'); } },
      ];
    list.push(bookOpt());
    panel('right', `<h2>${g.day}일째 새벽 · ${DAYS[weekday(g.day)]}요일 ${WEATHER_ICON[g.weather]} ${WEATHER_NAMES[g.weather]}</h2>${lines.join('')}`, list);
  },
  rest() {
    if (!g) return;
    panel('right', `<h2>쉬는 날</h2><p>${esc(g.today[g.today.length - 1] ?? '')}</p><p class="muted">피로가 풀렸다. (피로 ${Math.round(g.fatigue)})</p>`,
      [{ label: '저녁이 되었다', on: () => { endRest(g!); go('evening'); } }]);
  },
  office() {
    if (!g) return;
    officeView();
  },
  intro() {
    if (!g?.job) return;
    const j = JOBS[g.job.kind], npc = NPCS[j.npc];
    const bf = bodyFactor(g);
    const body = bf > 0.9 ? '쌩쌩하다' : bf > 0.75 ? '조금 지쳤다' : '많이 지쳤다 — 손이 둔하다';
    panel('right', `<h2>${session === 1 ? '오전' : '오후'} · ${esc(j.name)}</h2>
      <p class="muted">${esc(g.job.site)} · 일 난이도 ${TIERS[g.job.tier].name} · ${LEVEL_NAMES[levelOf(g.xp[g.job.kind]) - 1]} · 몸 상태: ${body}</p>
      <p>${esc(j.howto)}</p>${say(npc.name, j.tip)}`,
    [{ label: '일 시작 (Z)', on: startWork, sfx: 'start' }]);
  },
  work() { /* 캔버스에서 */ },
  result() {
    if (!g || !lastRes) return;
    const r = lastRes, score = g.scores[g.scores.length - 1] ?? 0;
    const lines: string[] = [];
    lines.push(`<p>점수 <b>${score}</b> · 숙련 +${r.xp} · 체력 -${r.stamina} · 피로 +${r.fatigue}</p>`);
    if (r.levelUp) lines.push(`<p>⬆️ 손에 익었다! <b>${esc(JOBS[mini!.kind].name)} ${LEVEL_NAMES[levelOf(g.xp[mini!.kind]) - 1]}</b></p>`);
    if (r.hurt) lines.push('<p>🤕 <b>삐끗했다!</b> 반장님이 병원부터 가라고 했다. 오늘은 여기까지, 며칠은 쉬어야 한다.</p>');
    else if (r.sentHome) lines.push(say('반장', '"오늘은 그만 가 봐. 반나절 치는 쳐 줄게."'));
    else lines.push(`<p>${score >= 88 ? '몸이 알아서 움직였다!' : score >= 72 ? '손이 착착 붙었다.' : score >= 52 ? '그럭저럭 해냈다.' : score >= 32 ? '실수가 많았다…' : '엉망이었다. 반장님 눈치가 보인다.'}</p>`);
    const toPay = g.phase === 'pay';
    panel('right', `<h2>${session === 1 ? '오전' : '오후'} 일 끝</h2>${lines.join('')}`,
      [{ label: toPay ? '일당 받으러' : '점심 먹으러', on: () => go(toPay ? 'pay' : 'lunch'), sfx: 'ok' }]);
  },
  lunch() {
    if (!g) return;
    const list: Opt[] = (['hamba', 'ramen', 'lunchbox', 'skip'] as MealId[]).filter((m) => m !== 'lunchbox' || g!.lunchbox).map((m) => {
      const x = MEALS[m];
      return { label: `${x.name}${x.cost ? ' · ' + won(x.cost) : ''}`, sub: `${x.desc} (체력 +${x.stamina}${x.mood ? `, 마음 ${x.mood > 0 ? '+' : ''}${x.mood}` : ''})`, off: g!.money < x.cost,
        on: () => { lunch(g!, m); session = 2; go('intro'); } };
    });
    panel('right', `<h2>점심시간</h2><p>오전 일이 끝났다. 허리를 펴니 뚝 소리가 났다.</p><p class="muted">체력 ${Math.round(g.stamina)} / ${g.staminaMax}</p>`, list);
  },
  pay() {
    if (!g) return;
    if (g.phase === 'pay') {
      lastPay = payday(g, Math.random());
      if (lastPay && !lastPay.unpaid) snd.sfx('coin'); else snd.sfx('no');
    }
    const p = lastPay;
    if (!p) return go('evening');
    const row = (a: string, b: number, sign = '+') => b ? `<tr><td>${a}</td><td>${sign}${won(Math.abs(b))}</td></tr>` : '';
    const html = `<span class="grade" style="color:${({ S: '#c8483a', A: '#e88a3a', B: '#5a8a5a', C: '#6a6a8a', F: '#8a6f72' } as Record<string, string>)[p.grade]}">${p.grade}</span>
      <h2>일당 봉투</h2><p class="muted">${esc(p.site)} · ${esc(JOBS[p.kind].name)}${p.half ? ' · 반나절' : ''}</p>
      ${say('반장', p.comment)}
      ${p.unpaid ? `<p>💢 업체가 <b>"다음 주에 한꺼번에 줄게요"</b>라며 일당 <b>${won(p.net)}</b>을 주지 않았다. 저녁에 노동청에 진정을 넣을 수 있다.</p>` : `<table class="pay">
        ${row('기본 일당', p.base, '')}${row('숙련', p.levelBonus)}${row('날씨 수당', p.weatherBonus)}${row('자격증', p.licenseBonus)}${row('지명 · 위험', p.namedBonus)}
        ${row('인력사무소 소개비 10%', p.fee, '-')}${row('가불 갚기', p.advance, '-')}${row('반장님 수고비', p.tip)}
        <tr class="sum"><td>손에 쥔 돈</td><td>${won(p.net)}</td></tr></table>`}
      <p class="muted">평판 ${p.repDelta >= 0 ? '+' : ''}${p.repDelta}${p.grade === 'S' && !p.half ? ' · 내일 이 현장에서 지명이 들어올 것 같다!' : ''}</p>`;
    panel('right', html, [{ label: '퇴근', on: () => go('evening'), sfx: 'ok' }]);
  },
  evening() {
    if (!g) return;
    const npc = todayNpc(g), story = storyReady(g, npc);
    const list: Opt[] = (['room', 'pocha', 'cook', 'konbini', 'sauna', 'call', 'study', 'report', 'sleep'] as EveningId[])
      .filter((id) => (id !== 'study' || g!.study) && (id !== 'report' || g!.unpaid.some((u) => u.due === null)) && (id !== 'room' || g!.home !== 'room'))
      .map((id) => {
        const e = EVENINGS[id];
        const sub = id === 'room' ? `일주일 치 방값 ${won(rentOf(g!))}를 내고 다시 내 방으로` : id === 'cook' && g!.home !== 'room' ? '방이 없으면 밥을 해 먹을 데가 없다' : id === 'pocha' ? `${NPCS[npc].name}과 오뎅 국물에 한잔. 마음 +${e.mood}` : id === 'study' ? `${LICENSES[g!.study!].name} (${g!.studyNights}/${LICENSES[g!.study!].nights}일)` : e.desc;
        const tags: Array<[string, boolean?]> = id === 'pocha' && story ? [['이야기가 있을 것 같다']] : id === 'report' ? [['못 받은 일당', true]] : [];
        return { label: `${e.name}${e.cost ? ' · ' + won(e.cost) : ''}`, sub, tags, off: !canEvening(g!, id), on: () => {
          const ok = evening(g!, id);
          if (!ok) return;
          if (id === 'pocha' && g!.story) { storyI = 0; go('story'); } else finishDay();
        } };
      });
    list.push({ label: '🧤 작업용품 가게', sub: '장갑·보호대·안전화', on: () => go('shop') });
    if (!g.study) list.push({ label: '📚 학원 등록', sub: '이수증·자격증을 따면 갈 수 있는 현장이 늘어요', on: () => go('school') });
    list.push(bookOpt());
    const night0 = g.home === 'room' ? '' : g.money >= 9000 + livingOf(g) ? '<p class="muted">오늘 밤은 찜질방에서 자야 한다 (9,000원).</p>' : '<p style="color:#c8483a">찜질방 갈 돈도 없다. 오늘 밤은 거리에서…</p>';
    panel('right', `<h2>저녁</h2><p>${g.lastPay ? '하루 일이 끝났다. 다리가 후들거린다.' : '해가 진다.'}</p>${night0}<p class="muted">마음 ${Math.round(g.mood)} · 피로 ${Math.round(g.fatigue)}</p>`, list);
  },
  shop() {
    if (!g) return;
    const list: Opt[] = GEAR_IDS.map((id) => ({ label: `${GEAR[id].name} · ${won(GEAR[id].cost)}`, sub: GEAR[id].desc, tags: g!.gear.includes(id) ? [['가지고 있음']] : [], off: g!.gear.includes(id) || g!.money < GEAR[id].cost,
      on: () => { if (buyGear(g!, id)) { snd.sfx('coin'); toast(`${GEAR[id].name}을(를) 샀다`); go('shop'); } } }));
    list.push({ label: '돌아가기', on: back });
    prev = 'evening';
    panel('right', `<h2>작업용품 가게</h2><p class="muted">한 번 사면 계속 써요.</p>`, list);
  },
  school() {
    if (!g) return;
    const list: Opt[] = LICENSE_IDS.filter((id) => !g!.licenses.includes(id)).map((id) => {
      const L = LICENSES[id], needSafety = id === 'signal' && !hasSafety(g!);
      return { label: `${L.name} · ${won(L.cost)}`, sub: `${L.desc} · 저녁 ${L.nights}번 공부`, tags: needSafety ? [['안전교육 먼저', true]] : [], off: needSafety || g!.money < L.cost,
        on: () => { if (startStudy(g!, id)) { snd.sfx('coin'); toast(`${L.name} 학원에 등록했다`); go('evening'); } } };
    });
    list.push({ label: '돌아가기', on: back });
    prev = 'evening';
    panel('right', `<h2>학원 등록</h2><p class="muted">돈은 먼저 내고, 저녁마다 "자격증 공부"를 골라 정해진 날만큼 다니면 따요. 한 번에 하나씩.</p>`, list);
  },
  story() {
    if (!g?.story) return finishDay();
    const s = g.story, n = NPCS[s.npc];
    const last = storyI >= s.lines.length - 1;
    panel('bottom', `<p class="muted">${esc(n.name)} · ${esc(n.role)} (${g.seen[s.npc]}/${n.stories.length})</p><p>${esc(s.lines[storyI])}</p>`,
      [{ label: last ? '잔을 비웠다' : '…', on: () => { if (last) finishDay(); else { storyI++; go('story'); } } }]);
  },
  night() {
    if (!g) return;
    const stampHtml = newStamps.map((id) => `<p>🏅 도장: <b>${esc(STAMPS.find((s) => s.id === id)?.name ?? id)}</b></p>`).join('');
    panel('right', `<h2>오늘의 일기</h2><p>${esc(diaryText)}</p>${stampHtml}<p class="muted">남은 돈 ${won(g.money)}${g.home !== 'room' ? ` · 오늘 잠자리: ${g.home === 'sauna' ? '찜질방' : '거리'}` : ''}</p>`,
      [{ label: '불 끄고 잠들기', on: () => { news = sleep(g!); store(); go('wake'); } }, bookOpt()]);
  },
  ending() {
    if (!g) return;
    const b = BACKGROUNDS[g.bg];
    if (g.endKind === 'fall') {
      const FALL: Record<BgId, string> = {
        youth: '새벽 인력사무소 앞에서 쓰러졌다. 눈을 떠 보니 병원이었다. 엄마에게 전화가 왔지만 받지 못했다. 사회복지사가 쉼터와 긴급 생계 지원을 알려 주었다.',
        father: '현장 계단에서 다리가 풀렸다. 병원 침대 옆에서 아내가 울고 있었다. "왜 혼자 버텼어." 딸이 내 손을 잡았다. 처음부터, 같이 다시 해 보기로 했다.',
        elder: '공원 벤치에서 일어나지 못했다. 구급차 소리가 멀게 들렸다. 아내가 달려왔다. "당신 고생 그만해요." 오래 일한 손이 처음으로 떨렸다.',
      };
      panel('wide', `<h2>쓰러졌다</h2><p>${esc(FALL[g.bg])}</p>
        <h3>${esc(g.name)}의 기록</h3>
        <p>${g.day}일을 버텼다 · ${g.worked}일 일했다 · 번 돈 ${won(g.earned)} · 거리에서 잔 밤 ${g.streetNights} · 도장 ${g.stamps.length}/${STAMPS.length}개</p>
        <p class="muted">혼자 버티기 어려울 땐 도움을 청해도 괜찮아요. 다음엔 가불·찜질방·쉬는 날을 일찍 써 보세요.</p>`,
      [{ label: '같은 사람으로 처음부터 다시', on: () => { g = newGame(g!.name, g!.bg, Math.floor(Math.random() * 1e6), g!.mode); store(); go('wake'); }, sfx: 'ok' },
        { label: '제목으로', on: () => { try { localStorage.removeItem(SAVE_KEY); } catch { /* */ } g = null; go('title'); } }]);
      return;
    }
    const END: Record<BgId, string> = {
      youth: '고시원 짐은 상자 세 개면 충분했다. 작은 원룸의 창문으로 아침 해가 들어왔다. 이제 새벽 네 시 반에 일어나는 게 힘들지 않다.',
      father: '등록금 고지서를 딸에게 건넸다. "아빠, 이거…" 딸이 내 손을 잡았다. 굳은살이 박인 손이 부끄럽지 않았다.',
      elder: '제주도 바닷바람이 짰다. 아내가 웃었다. "당신 손이 아직 그렇게 단단할 줄 몰랐네." 오래 일한 손을 아내가 꼭 쥐었다.',
    };
    panel('wide', `<h2>꿈을 이뤘다 — ${esc(g.goalName)}</h2><p>${esc(END[g.bg])}</p>
      <h3>${esc(g.name)}의 기록</h3>
      <p>${g.day}일 동안 ${g.worked}일 일했다 · 번 돈 ${won(g.earned)} · ${esc(rank(g))} · 도장 ${g.stamps.length}/${STAMPS.length}개</p>
      <p class="muted">${b.name}(${b.age})의 이야기. 같이 일한 사람들: ${NPC_IDS.filter((n) => g!.bond[n] > 0).map((n) => NPCS[n].name).join(', ') || '없음'}</p>`,
    [{ label: '계속 일하기 (다음 꿈: 내 이름으로 된 작은 가게)', on: () => { continueAfterGoal(g!); store(); go('wake'); }, sfx: 'ok' },
      { label: '제목으로', on: () => { store(); go('title'); } }]);
  },
  book() { if (g) bookView(); },
};

function officeView(msg?: string, who = '소장'): void {
  if (!g) return;
  const greet = g.weather === 'rain' ? BOSS_LINES.rain : g.late ? '"늦었네. 좋은 자리는 벌써 다 나갔어요."' : '"자, 오늘 일 불러요!"';
  const list: Opt[] = g.board.map((job) => {
    const j = JOBS[job.kind], p = hireChance(g!, job);
    const tags: Array<[string, boolean?]> = [];
    tags.push([TIERS[job.tier].name, job.tier === 3]);
    if (job.named) tags.push(['지명']);
    if (job.shady) tags.push(['처음 보는 업체', true]);
    if (j.build) tags.push(['건설']);
    if (j.build && !hasSafety(g!)) tags.push(['이수증 필요', true]);
    if (j.need && !g!.licenses.includes(j.need)) tags.push([LICENSES[j.need].name + ' 필요', true]);
    return { label: `${j.name} · ${won(job.pay)}`, sub: `${job.site} · 뽑힐 가능성: ${chanceWord(p)} · ${'힘듦 ' + '●'.repeat(j.hard)} ${'위험 ' + '●'.repeat(j.risk)}`, tags,
      on: () => {
        const r = apply(g!, job.id, Math.random());
        if (r.ok) { snd.sfx('ok'); officeHired(r.line); }
        else { snd.sfx('no'); officeView(r.line); }
      } };
  });
  if (canAdvance(g)) list.push({ label: `소장님께 가불 부탁하기 (+${won(ADVANCE)})`, sub: '다음 일당에서 빼요. 평판이 조금 깎여요.', on: () => { takeAdvance(g!); snd.sfx('coin'); officeView('"…알았어. 이번 한 번이야. 다음 일당에서 뺄게."'); } });
  list.push({ label: g.board.length ? '오늘은 그냥 돌아간다' : '봉고차가 다 떠났다… 돌아간다', sub: '일당 없이 하루를 보내요', on: () => { goHome(g!); go('evening'); } });
  list.push(bookOpt());
  panel('right', `<h2>새벽 인력사무소</h2>${say(who, msg ?? greet)}${g.board.length ? '' : '<p>오늘 남은 일이 없다.</p>'}<p class="muted">평판 ${Math.round(g.rep)} · 오늘 ${g.tries}번 떨어짐</p>`, list);
}
function officeHired(line: string): void {
  panel('right', `<h2>뽑혔다!</h2>${say('소장', line)}<p>${esc(g!.job!.site)} · ${esc(JOBS[g!.job!.kind].name)} · ${won(g!.job!.pay)}</p>`,
    [{ label: '봉고차에 탄다', on: () => { session = 1; go('intro'); }, sfx: 'ok' }]);
}
function finishDay(): void {
  if (!g) return;
  const before = [...g.stamps];
  diaryText = night(g);
  newStamps = g.stamps.filter((s) => !before.includes(s));
  if (newStamps.length) snd.sfx('stamp');
  if (g.phase === 'ending') { store(); go('ending'); } else go('night');
}

function bookView(): void {
  if (!g) return;
  const tabs = ['나', '자격·장비', '사람들', '도장', '일기'];
  let body = '';
  if (bookTab === 0) {
    body = `<p><b>${esc(g.name)}</b> · ${BACKGROUNDS[g.bg].name}(${BACKGROUNDS[g.bg].age}) · ${esc(rank(g))} · 평판 ${Math.round(g.rep)}</p>
      <p>꿈: ${esc(g.goalName)} — ${won(g.money)} / ${won(g.goal)}</p>
      <p class="muted">${g.day}일째 · 일한 날 ${g.worked} · 쉰 날 ${g.rested} · 허탕 ${g.noJob} · 번 돈 ${won(g.earned)}</p>
      <h3>손에 익은 일</h3>` + KINDS.map((k) => {
        const [a, b] = nextXp(g!.xp[k]), lv = levelOf(g!.xp[k]);
        return `<p>${esc(JOBS[k].name)} · ${LEVEL_NAMES[lv - 1]} <span class="meter"><i style="width:${lv >= 5 ? 100 : a / b * 100}%"></i></span> <span class="muted">${g!.done[k]}번 함</span></p>`;
      }).join('');
  } else if (bookTab === 1) {
    body = '<h3>이수증 · 자격증</h3>' + LICENSE_IDS.map((id) => `<p>${g!.licenses.includes(id) ? '✅' : g!.study === id ? `📚 (${g!.studyNights}/${LICENSES[id].nights})` : '⬜'} ${esc(LICENSES[id].name)} <span class="muted">${esc(LICENSES[id].desc)}</span></p>`).join('')
      + '<h3>작업용품</h3>' + (g.gear.length ? g.gear.map((id) => `<p>🧤 ${esc(GEAR[id].name)} <span class="muted">${esc(GEAR[id].desc)}</span></p>`).join('') : '<p class="muted">아직 없음</p>')
      + (g.unpaid.length ? '<h3>못 받은 일당</h3>' + g.unpaid.map((u) => `<p>${esc(u.site)} ${won(u.amount)} <span class="muted">${u.due ? `${u.due}일째에 들어옴` : '진정을 넣어야 함'}</span></p>`).join('') : '');
  } else if (bookTab === 2) {
    body = NPC_IDS.map((n) => {
      const x = NPCS[n], met = g!.bond[n] > 0;
      return `<p><b>${met ? esc(x.name) : '???'}</b> <span class="muted">${met ? esc(x.role) : '아직 못 만남'}</span> ${met ? '♥'.repeat(Math.min(10, Math.ceil(g!.bond[n] / 2))) : ''} <span class="muted">이야기 ${g!.seen[n]}/${x.stories.length}</span></p>`;
    }).join('') + '<p class="muted">같이 일하고 저녁에 포장마차에 가면 이야기를 들려줘요.</p>';
  } else if (bookTab === 3) {
    body = `<div class="stamps">${STAMPS.map((s) => `<div class="stamp${g!.stamps.includes(s.id) ? ' on' : ''}"><b>${esc(s.name)}</b>${esc(s.desc)}</div>`).join('')}</div>`;
  } else {
    body = g.diary.length ? [...g.diary].reverse().slice(0, 30).map((d) => `<p><b>${d.day}일</b> ${esc(d.text)}</p>`).join('') : '<p class="muted">아직 쓴 일기가 없다.</p>';
  }
  const list: Opt[] = tabs.map((name, i) => ({ label: (i === bookTab ? '▶ ' : '') + name, on: () => { bookTab = i; bookView(); } }));
  list.push({ label: '닫기', on: back });
  panel('wide', `<h2>📒 수첩</h2>${body}`, list, true);
  sel = bookTab; mark();
}

// ─────────── 일하기 ───────────
function startWork(): void {
  if (!g?.job) return;
  const k = g.job.kind;
  mini = makeMini(k, difficulty(g, k, session), bodyFactor(g), hash(g.seed, g.day, session, 31));
  countdown = 3;
  go('work');
}
function endWork(): void {
  if (!g || !mini) return;
  const score = mini.score();
  lastRes = finishSession(g, score, Math.random());
  if (lastRes.hurt) snd.sfx('hurt'); else if (lastRes.levelUp) snd.sfx('level'); else snd.sfx('whistle');
  go('result');
}

// ─────────── 그리기 ───────────
function sceneFor(): SceneName {
  switch (screen) {
    case 'title': case 'new': case 'credits': return 'title';
    case 'wake': return g?.home === 'sauna' ? 'sauna' : g?.home === 'street' ? 'outside' : 'room';
    case 'rest': case 'night': return g?.home === 'sauna' ? 'sauna' : g?.home === 'street' ? 'outside' : 'roomNight';
    case 'office': return 'office';
    case 'lunch': return 'lunch';
    case 'evening': case 'shop': case 'school': case 'story': return 'pocha';
    case 'ending': return g?.endKind === 'fall' ? 'fall' : 'end';
    case 'book': return prev === 'office' ? 'office' : prev === 'wake' ? 'room' : prev === 'night' ? 'roomNight' : prev === 'evening' ? 'pocha' : 'room';
    default: return 'site';
  }
}
function frame(dt: number): void {
  t += dt; st += dt;
  if (screen === 'work' && mini && g) {
    const inp: Inp = countdown > 0 ? NO_INPUT : { held: { ...held }, hit };
    if (countdown > 0) {
      const before = Math.ceil(countdown);
      countdown -= dt;
      if (Math.ceil(countdown) !== before) snd.sfx(countdown <= 0 ? 'whistle' : 'tick');
    } else mini.step(dt, inp);
    for (const e of mini.events) snd.sfx(e);
    mini.events.length = 0;
    drawMini(cx, mini, g.weather);
    if (countdown > 0) text(cx, String(Math.ceil(countdown)), W / 2, H / 2, '#ffe08a', 'center', 32);
    else if (mini.t < 0.8) text(cx, '시작!', W / 2, H / 2, '#ffe08a', 'center', 24);
    if (mini.done) { text(cx, '그만! 수고했어', W / 2, H / 2, '#fff4de', 'center', 18); if (st > 0) { endWork(); } }
  } else {
    const kind = g?.job?.kind ?? g?.lastPay?.kind ?? 'clean';
    scene(cx, sceneFor(), { wx: g?.weather ?? 'sun', t, kind, npc: screen === 'story' ? g?.story?.npc : g ? todayNpc(g) : undefined, me: screen === 'office', crowd: g?.late ? 3 : 7, night: screen === 'night' || screen === 'rest', poor: poorLevel(g) });
    if (g && poorLevel(g) >= 2 && screen !== 'title' && screen !== 'ending') { const v = cx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, 200); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,10,20,.55)'); cx.fillStyle = v; cx.fillRect(0, 0, W, H); }
  }
  hit = {};
}
let last = performance.now();
function loop(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!document.hidden) frame(dt);
  requestAnimationFrame(loop);
}

// 개발용 (?dev=1)
if (new URLSearchParams(location.search).has('dev')) {
  (window as any).__col = {
    get screen() { return screen; }, get game() { return g; }, get mini() { return mini; }, go, choose, get opts() { return opts.map((o) => o.label); },
    newGame: (bg: BgId = 'youth', mode: Mode = 'normal') => { g = newGame('테스트', bg, 7, mode); store(); go('wake'); },
    poor: (home: 'room' | 'sauna' | 'street', hunger = 0, money = 3000) => { if (!g) return; g.home = home; g.hunger = hunger; g.money = money; g.streetNights = home === 'street' ? 2 : 0; },
    fall: () => { if (!g) return; g.endKind = 'fall'; g.phase = 'ending'; go('ending'); },
    hire: () => { const job = g && g.phase === 'office' ? g.board.find((b) => hireChance(g!, b) > 0) : null; if (!g || !job) return false; const r = apply(g, job.id, -1); if (r.ok) { session = 1; go('intro'); } return r.ok; },
    play: (kind: Kind) => { if (!g) g = newGame('테스트', 'elder', 7); g.licenses = ['safety', 'signal']; g.phase = 'work1'; g.job = { id: 'x', kind, site: JOBS[kind].sites[0], pay: 150000, shady: false, named: false, tier: 2 }; session = 1; startWork(); countdown = 0; },
    finishMini: (score = 80) => { if (mini) { (mini as any).score = () => score; mini.done = true; } },
  };
}

if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
fit();
loadSheet().then(() => { go('title'); requestAnimationFrame(loop); });
