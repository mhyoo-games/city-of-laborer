// 노동자의 도시 — 하루 규칙. 화면과 떨어진 순수 계산 (node --test로 바로 테스트).
// 하루: 새벽 기상 → 인력사무소(일 고르기·뽑히기) → 오전 일 → 점심 → 오후 일 → 일당 → 저녁 → 일기 → 잠
import {
  JOBS, KINDS, LICENSES, GEAR, MEALS, EVENINGS, BACKGROUNDS, NPCS, NPC_IDS, LEVEL_XP, RANKS, FEE, BOSS_LINES, DIARY, STAMPS, LICENSE_IDS,
  TIERS, MODES, SAUNA_NIGHT, ADVANCE, BILLS, type Mode, type Home,
  type Kind, type LicenseId, type GearId, type MealId, type EveningId, type BgId, type NpcId, type Weather,
} from './data.ts';
import { rand, pick, hash } from './rng.ts';

export type Phase = 'wake' | 'office' | 'work1' | 'lunch' | 'work2' | 'pay' | 'evening' | 'night' | 'rest' | 'ending';

export interface Job { id: string; kind: Kind; site: string; pay: number; shady: boolean; named: boolean; tier: 1 | 2 | 3 }
export interface PayResult {
  kind: Kind; site: string; grade: string; score: number; scores: number[];
  base: number; levelBonus: number; weatherBonus: number; licenseBonus: number; namedBonus: number; tip: number;
  fee: number; advance: number; net: number; unpaid: boolean; half: boolean; comment: string; repDelta: number; levelUp: boolean; level: number;
}
export interface Unpaid { amount: number; site: string; due: number | null }

export interface Game {
  v: 1; name: string; bg: BgId; seed: number; day: number; phase: Phase;
  money: number; earned: number; goal: number; goalName: string; goalDone: boolean;
  rep: number; stamina: number; staminaMax: number; fatigue: number; mood: number; recover: number;
  xp: Record<Kind, number>; done: Record<Kind, number>;
  licenses: LicenseId[]; study: LicenseId | null; studyNights: number; gear: GearId[];
  bond: Record<NpcId, number>; seen: Record<NpcId, number>;
  weather: Weather; board: Job[]; job: Job | null; late: boolean; scores: number[];
  hurtDays: number; burnout: boolean; named: { kind: Kind; site: string } | null; namedStreak: number;
  streak: number; worked: number; noJob: number; rested: number; sCount: number;
  unpaid: Unpaid[]; lunchbox: boolean; stamps: string[]; diary: Array<{ day: number; text: string }>;
  today: string[]; lastPay: PayResult | null; story: { npc: NpcId; lines: string[] } | null; tries: number;
  // 살아남기
  mode: Mode; home: Home; hunger: number; rentOwed: number; advance: number; streetNights: number; endKind: 'goal' | 'fall';
}
/** 이번 판의 방값·생활비 */
export const rentOf = (g: Game) => MODES[g.mode].rent;
export const livingOf = (g: Game) => MODES[g.mode].living;

// ─────────── 숫자 도우미 ───────────
export const won = (n: number) => (n < 0 ? '-' : '') + Math.abs(Math.round(n)).toLocaleString('ko-KR') + '원';
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export function levelOf(xp: number): number { let l = 1; for (let i = 1; i < LEVEL_XP.length; i++) if (xp >= LEVEL_XP[i]) l = i + 1; return l; }
export function nextXp(xp: number): [number, number] {
  const l = levelOf(xp); if (l >= LEVEL_XP.length) return [1, 1];
  return [xp - LEVEL_XP[l - 1], LEVEL_XP[l] - LEVEL_XP[l - 1]];
}
export function rank(g: Game): string { const s = KINDS.reduce((a, k) => a + levelOf(g.xp[k]), 0); let r = RANKS[0][1]; for (const [n, name] of RANKS) if (s >= n) r = name; return r; }
export function weekday(day: number): number { return (day - 1) % 7; }
export const daysToRent = (g: Game) => 7 - ((g.day - 1) % 7);
const zero = <T extends string>(ks: readonly T[]): Record<T, number> => Object.fromEntries(ks.map((k) => [k, 0])) as Record<T, number>;

export function newGame(name: string, bg: BgId, seed = Date.now() % 100000, mode: Mode = 'normal'): Game {
  const b = BACKGROUNDS[bg];
  const xp = zero(KINDS);
  for (const k of KINDS) xp[k] = b.skill[k] ?? 0;
  const g: Game = {
    v: 1, name: name.trim().slice(0, 8) || '나', bg, seed, day: 1, phase: 'wake',
    money: b.money, earned: 0, goal: b.goal, goalName: b.goalName, goalDone: false,
    rep: b.rep, stamina: b.staminaMax, staminaMax: b.staminaMax, fatigue: 0, mood: 60, recover: b.recover,
    xp, done: zero(KINDS), licenses: [...b.licenses], study: null, studyNights: 0, gear: [],
    bond: zero(NPC_IDS), seen: zero(NPC_IDS),
    weather: 'sun', board: [], job: null, late: false, scores: [],
    hurtDays: 0, burnout: false, named: null, namedStreak: 0,
    streak: 0, worked: 0, noJob: 0, rested: 0, sCount: 0,
    unpaid: [], lunchbox: false, stamps: [], diary: [], today: [], lastPay: null, story: null, tries: 0,
    mode, home: 'room', hunger: 0, rentOwed: 0, advance: 0, streetNights: 0, endKind: 'goal',
  };
  return g;
}

/** 그날 날씨 (게임마다·날마다 정해짐). 첫날은 늘 맑음 */
export function weatherFor(seed: number, day: number): Weather {
  if (day === 1) return 'sun';
  const r = rand(hash(seed, day, 7))();
  if (r < 0.14) return 'rain';
  if (r < 0.22) return 'heat';
  if (r < 0.3) return 'cold';
  if (r < 0.5) return 'cloud';
  return 'sun';
}

const gearMul = (g: Game, key: 'stamina' | 'fatigue' | 'injury') => g.gear.reduce((m, id) => m * ((GEAR[id] as any)[key] ?? 1), 1);
export const hasSafety = (g: Game) => g.licenses.includes('safety');

/** 일당 계산 (숙련·날씨·자격증·지명·위험한 업체) */
export function payFor(g: Game, kind: Kind, shady: boolean, named: boolean, weather = g.weather, tier: 1 | 2 | 3 = 2) {
  const j = JOBS[kind];
  const base = Math.round(j.base * TIERS[tier].pay / 5000) * 5000;
  const levelBonus = base * 0.08 * (levelOf(g.xp[kind]) - 1);
  const weatherBonus = weather === 'heat' || weather === 'cold' ? base * 0.1 : 0;
  const licenseBonus = (kind === 'sort' && g.licenses.includes('forklift') ? base * 0.25 : 0) + (kind === 'pipe' && g.licenses.includes('welding') ? base * 0.3 : 0);
  const namedBonus = named ? base * 0.05 : 0;
  const shadyBonus = shady ? base * 0.25 : 0;
  const r5 = (n: number) => Math.round(n / 5000) * 5000;
  return { base, levelBonus: r5(levelBonus), weatherBonus: r5(weatherBonus), licenseBonus: r5(licenseBonus), namedBonus: r5(namedBonus), shadyBonus: r5(shadyBonus),
    total: r5(base + levelBonus + weatherBonus + licenseBonus + namedBonus + shadyBonus) };
}

/** 오늘 인력사무소 칠판 */
export function makeBoard(g: Game): Job[] {
  const r = rand(hash(g.seed, g.day, 31));
  const rain = g.weather === 'rain';
  const pool = KINDS.filter((k) => !(rain && JOBS[k].build));
  const n = clamp(3 + Math.floor(r() * 3) - (g.late ? 1 : 0) - (rain ? 1 : 0), 2, 5);
  const out: Job[] = [];
  if (g.named && !(rain && JOBS[g.named.kind].build)) {
    out.push({ id: 'named', kind: g.named.kind, site: g.named.site, pay: payFor(g, g.named.kind, false, true).total, shady: false, named: true, tier: 2 });
  }
  let guard = 0;
  while (out.length < n && guard++ < 40) {
    const kind = pick(r, pool);
    const site = pick(r, JOBS[kind].sites);
    if (out.some((o) => o.kind === kind && o.site === site)) continue;
    const shady = r() < 0.16 && !out.some((o) => o.shady);
    const tr = r(), hardDays = Math.min(0.15, g.day * 0.005);
    const tier: 1 | 2 | 3 = tr < 0.3 - hardDays ? 1 : tr < 0.78 - hardDays ? 2 : 3;
    out.push({ id: 'j' + out.length, kind, site: shady ? '(처음 보는 업체) ' + site : site, pay: payFor(g, kind, shady, false, g.weather, tier).total, shady, named: false, tier });
  }
  // 공장·물류 일은 하나는 꼭 있다 (이수증이 없는 첫날에도 지원할 곳이 있게)
  if (!out.some((o) => !JOBS[o.kind].build)) {
    const kind = pick(r, KINDS.filter((k) => !JOBS[k].build));
    const i = out.findIndex((o) => !o.named);
    const job: Job = { id: 'jf', kind, site: pick(r, JOBS[kind].sites), pay: payFor(g, kind, false, false).total, shady: false, named: false, tier: 2 };
    if (i >= 0) out[i] = job; else out.push(job);
  }
  return out;
}

/** 뽑힐 가능성 0~1 (0이면 아예 안 됨) */
export function hireChance(g: Game, job: Job): number {
  const j = JOBS[job.kind];
  if (j.build && !hasSafety(g)) return 0;
  if (j.need && !g.licenses.includes(j.need)) return 0;
  if (job.named) return 1;
  let p = 0.28 + g.rep * 0.006 + (levelOf(g.xp[job.kind]) - 1) * 0.07;
  if (g.late) p -= 0.25;
  p += TIERS[job.tier ?? 2].hire + MODES[g.mode].hire;
  if (g.home === 'street') p -= 0.12;           // 씻지 못한 행색
  if (g.hunger >= 2) p -= 0.05;
  if (job.shady) p += 0.25;
  if (g.bg === 'elder' && j.hard >= 3) p -= 0.2;      // 힘쓰는 일은 젊은 사람부터
  if (g.bg === 'youth' && j.hard >= 3) p += 0.1;
  if (g.bg === 'elder' && j.risk >= 2) p += 0.1;       // 위험한 일은 경험 많은 사람부터
  p -= g.tries * 0.08;                                 // 한 번 떨어지면 남은 자리는 더 치열
  return clamp(p, 0.05, 0.97);
}
export function chanceWord(p: number): string { return p <= 0 ? '안 돼요' : p >= 0.85 ? '거의 확실' : p >= 0.6 ? '될 것 같다' : p >= 0.35 ? '글쎄' : '어렵다'; }

// ─────────── 새벽 ───────────
export function wake(g: Game, choice: 'up' | 'snooze' | 'rest'): void {
  if (g.phase !== 'wake') return;
  g.today = [];
  g.story = null;
  if (g.hurtDays > 0 || g.burnout || choice === 'rest') {
    const why = g.hurtDays > 0 ? 'hurt' : g.burnout ? 'burnout' : 'rest';
    g.phase = 'rest';
    g.streak = 0;
    g.rested++;
    g.fatigue = clamp(g.fatigue - 30 * g.recover, 0, 100);
    g.mood = clamp(g.mood + (why === 'burnout' ? 25 : 8), 0, 100);
    g.burnout = false;
    g.today.push(why === 'hurt' ? '다친 데가 아파 하루 종일 누워 있었다.' : why === 'burnout' ? '아무것도 할 힘이 없었다. 몸보다 마음이 지쳤다.' : pick(rand(hash(g.seed, g.day, 3)), DIARY.rest));
    return;
  }
  g.late = choice === 'snooze';
  if (g.late) g.stamina = clamp(g.stamina + 10, 0, g.staminaMax);
  g.tries = 0;
  g.board = makeBoard(g);
  g.phase = 'office';
}

export interface ApplyResult { ok: boolean; line: string; reason: 'ok' | 'chance' | 'tired' | 'safety' | 'license' }
/** 일에 지원 (roll: 0~1 난수) */
export function apply(g: Game, jobId: string, roll: number): ApplyResult {
  const job = g.board.find((b) => b.id === jobId);
  if (g.phase !== 'office' || !job) return { ok: false, line: '', reason: 'chance' };
  const fill = (s: string) => s.replaceAll('{name}', g.name).replaceAll('{site}', job.site);
  if (g.stamina < 25 || g.fatigue > 88) return { ok: false, line: fill(BOSS_LINES.tired), reason: 'tired' };
  const j = JOBS[job.kind];
  if (j.build && !hasSafety(g)) return { ok: false, line: BOSS_LINES.noSafety, reason: 'safety' };
  if (j.need && !g.licenses.includes(j.need)) return { ok: false, line: BOSS_LINES.noLicense, reason: 'license' };
  const p = hireChance(g, job);
  const r = rand(hash(g.seed, g.day, 99 + g.tries));
  if (roll < p) {
    g.job = job;
    g.scores = [];
    g.phase = 'work1';
    g.board = [];
    return { ok: true, line: fill(job.named ? BOSS_LINES.named : pick(r, BOSS_LINES.hired)), reason: 'ok' };
  }
  g.tries++;
  g.board = g.board.filter((b) => b.id !== jobId);
  return { ok: false, line: pick(r, BOSS_LINES.rejected), reason: 'chance' };
}

/** 오늘 일을 못 받고 돌아가기 */
export function goHome(g: Game): void {
  if (g.phase !== 'office') return;
  g.noJob++;
  g.streak = 0;
  g.named = null;
  g.namedStreak = 0;
  const rain = g.weather === 'rain';
  g.today.push(rain ? DIARY.rain[0] : pick(rand(hash(g.seed, g.day, 5)), DIARY.noJob));
  if (rain && !g.stamps.includes('rainDay')) g.stamps.push('rainDay');
  g.mood = clamp(g.mood - (rain ? 2 : 8), 0, 100);
  g.fatigue = clamp(g.fatigue - 10, 0, 100);
  g.phase = 'evening';
}
/** 쉬는 날(또는 다친 날)을 보내고 저녁으로 */
export function endRest(g: Game): void { if (g.phase === 'rest') g.phase = 'evening'; }

// ─────────── 현장 ───────────
/** 한 번 일할 때 드는 체력·피로 (점수가 나쁘면 허둥대느라 더 든다) */
export function workCost(g: Game, kind: Kind, score: number) {
  const j = JOBS[kind];
  const w = g.weather === 'heat' ? 1.3 : g.weather === 'cold' ? 1.15 : 1;
  const flail = 1.15 - score / 400;
  return {
    stamina: Math.round(j.hard * 11 * w * flail * gearMul(g, 'stamina')),
    fatigue: Math.round(j.hard * 4.5 * w * gearMul(g, 'fatigue') * (g.bg === 'elder' ? 1.4 : 1)),
  };
}
/** 미니게임에 넘길 몸 상태: 1이면 쌩쌩, 0.6이면 지쳐서 둔함 */
export function bodyFactor(g: Game): number { return clamp(0.55 + (g.stamina / 100) * 0.45 - Math.max(0, g.fatigue - 60) / 200, 0.5, 1); }
/** 미니게임 난이도 0~1 (숙련이 오르면 쉬워지고, 오후·날씨는 어려워짐) */
export function difficulty(g: Game, kind: Kind, session: 1 | 2): number {
  const tier = TIERS[g.job?.tier ?? 2].d;
  return clamp(0.35 + (session === 2 ? 0.15 : 0) + (g.day > 10 ? 0.1 : 0) - (levelOf(g.xp[kind]) - 1) * 0.06 + (g.weather === 'heat' ? 0.05 : 0) + tier + MODES[g.mode].d, 0.1, 1);
}

export interface SessionResult { hurt: boolean; levelUp: boolean; xp: number; stamina: number; fatigue: number; sentHome?: boolean }
/** 오전 점수가 이보다 낮으면 반나절만 하고 돌려보낸다 */
export const SEND_HOME = 30;
/** 하루 생활비 (버스비·통신비·빨래·커피) */
/** 보통 모드 하루 생활비 (고된 삶은 livingOf) */
export const LIVING = 8000;
export function finishSession(g: Game, score: number, roll: number): SessionResult {
  if (!g.job || (g.phase !== 'work1' && g.phase !== 'work2')) return { hurt: false, levelUp: false, xp: 0, stamina: 0, fatigue: 0 };
  score = clamp(Math.round(score), 0, 100);
  const kind = g.job.kind;
  g.scores.push(score);
  const c = workCost(g, kind, score);
  g.stamina = clamp(g.stamina - c.stamina, 0, g.staminaMax);
  g.fatigue = clamp(g.fatigue + c.fatigue, 0, 100);
  const before = levelOf(g.xp[kind]);
  const xp = Math.round(score / 9) + 3;
  g.xp[kind] += xp;
  const levelUp = levelOf(g.xp[kind]) > before;
  // 다침: 위험 × 피로 × 서툼 × 보호구
  const tired = g.fatigue > 60 ? (g.fatigue - 50) / 12 : 0.4;
  const sloppy = score < 40 ? 2 : score < 60 ? 1.3 : 1;
  const pHurt = JOBS[kind].risk * 0.012 * tired * sloppy * gearMul(g, 'injury') * (g.stamina < 15 ? 2 : 1) * MODES[g.mode].injury * (g.hunger >= 2 ? 1.5 : 1);
  const hurt = roll < pHurt;
  if (hurt) {
    g.hurtDays = 2 + (JOBS[kind].risk >= 2 ? 1 : 0);
    g.today.push(DIARY.hurt);
  }
  // 오전에 너무 못하면 반장님이 "오늘은 그만 가 봐" — 반나절 일당만
  const sentHome = !hurt && g.phase === 'work1' && score < SEND_HOME;
  if (sentHome) g.today.push('오전만 하고 돌려보내졌다. 반나절 일당만 받았다.');
  g.phase = hurt || sentHome ? 'pay' : g.phase === 'work1' ? 'lunch' : 'pay';
  return { hurt, levelUp, xp, stamina: c.stamina, fatigue: c.fatigue, sentHome };
}

export function lunch(g: Game, meal: MealId): boolean {
  if (g.phase !== 'lunch') return false;
  const m = MEALS[meal];
  if (meal === 'lunchbox' && !g.lunchbox) return false;
  if (g.money < m.cost && m.cost > 0) return false;
  g.money -= m.cost;
  if (meal === 'lunchbox') g.lunchbox = false;
  g.stamina = clamp(g.stamina + m.stamina, 0, g.staminaMax);
  g.mood = clamp(g.mood + m.mood + (g.gear.includes('thermos') ? GEAR.thermos.mood! : 0), 0, 100);
  if (meal === 'skip') g.today.push('점심을 굶었다. 오후 내내 배에서 소리가 났다.');
  g.phase = 'work2';
  return true;
}

export function gradeOf(score: number): string { return score >= 88 ? 'S' : score >= 72 ? 'A' : score >= 52 ? 'B' : score >= 32 ? 'C' : 'F'; }

/** 일당 받기 */
export function payday(g: Game, roll: number): PayResult | null {
  if (g.phase !== 'pay' || !g.job) return null;
  const job = g.job, kind = job.kind;
  const half = g.scores.length < 2;                         // 다쳐서 오전만
  const score = Math.round(g.scores.reduce((a, b) => a + b, 0) / Math.max(1, g.scores.length));
  const grade = gradeOf(score);
  const p = payFor(g, kind, job.shady, job.named);
  const r = rand(hash(g.seed, g.day, 77));
  const tip = grade === 'S' && r() < 0.5 ? 10000 : 0;      // 반장님이 챙겨 주는 수고비
  let gross = p.total * (half ? 0.5 : 1);
  const fee = Math.round(gross * FEE / 1000) * 1000;
  const unpaid = job.shady && roll < 0.35;
  const adv = unpaid ? 0 : Math.min(g.advance, gross - fee + tip);
  g.advance -= adv;
  const net = gross - fee + tip - adv;
  if (unpaid) {
    g.unpaid.push({ amount: net, site: job.site, due: null });
    g.today.push(DIARY.unpaid);
    g.mood = clamp(g.mood - 15, 0, 100);
  } else {
    g.money += net;
    g.earned += net;
  }
  const repDelta = ({ S: 6, A: 3, B: 0, C: -4, F: -10 } as Record<string, number>)[grade] + (half ? -2 : 0);
  g.rep = clamp(g.rep + repDelta, 0, 100);
  g.mood = clamp(g.mood + ({ S: 10, A: 5, B: 1, C: -4, F: -10 } as Record<string, number>)[grade], 0, 100);
  const npc = JOBS[kind].npc;
  g.bond[npc] += grade === 'S' || grade === 'A' ? 2 : 1;
  g.done[kind]++;
  g.worked++;
  g.streak++;
  if (grade === 'S') g.sCount++;
  if (grade === 'S' && job.tier === 3 && !g.stamps.includes('tough')) g.stamps.push('tough');
  if (grade === 'S' && !half) {
    g.namedStreak = job.named ? g.namedStreak + 1 : 0;
    g.named = { kind, site: job.site.replace('(처음 보는 업체) ', '') };
  } else { g.named = null; g.namedStreak = 0; }
  const lv = levelOf(g.xp[kind]);
  const comment = pick(r, BOSS_LINES.grade[grade]);
  g.today.push(pick(r, DIARY.grade[grade]));
  const res: PayResult = {
    kind, site: job.site, grade, score, scores: [...g.scores], base: p.base * (half ? 0.5 : 1), levelBonus: p.levelBonus, weatherBonus: p.weatherBonus,
    licenseBonus: p.licenseBonus, namedBonus: p.namedBonus + p.shadyBonus, tip, fee, advance: adv, net, unpaid, half, comment, repDelta, levelUp: false, level: lv,
  };
  g.lastPay = res;
  g.job = null;
  g.phase = 'evening';
  return res;
}

// ─────────── 저녁 ───────────
/** 오늘 같이 일한 사람 (없으면 가장 친한 사람) */
export function todayNpc(g: Game): NpcId {
  if (g.lastPay && g.phase !== 'rest') return JOBS[g.lastPay.kind].npc;
  return NPC_IDS.reduce((a, b) => (g.bond[b] > g.bond[a] ? b : a), NPC_IDS[0]);
}
/** 포장마차에서 들을 이야기가 남았나 */
export function storyReady(g: Game, npc: NpcId): boolean { return g.seen[npc] < NPCS[npc].stories.length && g.bond[npc] >= g.seen[npc] * 2 + 1; }

export function canEvening(g: Game, id: EveningId): boolean {
  const e = EVENINGS[id];
  if (g.money < e.cost) return false;
  if (id === 'study') return !!g.study;
  if (id === 'report') return g.unpaid.some((u) => u.due === null);
  if (id === 'cook') return g.home === 'room';
  if (id === 'room') return g.home !== 'room' && g.money >= rentOf(g);
  return true;
}
export function evening(g: Game, id: EveningId): boolean {
  if (g.phase !== 'evening' || !canEvening(g, id)) return false;
  const e = EVENINGS[id];
  g.money -= e.cost;
  g.mood = clamp(g.mood + e.mood, 0, 100);
  g.fatigue = clamp(g.fatigue + e.fatigue, 0, 100);
  g.story = null;
  const fam = BACKGROUNDS[g.bg].family;
  switch (id) {
    case 'pocha': {
      const npc = todayNpc(g);
      g.bond[npc] += 1;
      if (storyReady(g, npc)) {
        g.story = { npc, lines: NPCS[npc].stories[g.seen[npc]] };
        g.seen[npc]++;
        g.today.push(`${NPCS[npc].name}과 한잔했다. ` + g.story.lines[0].replace(/^"|"$/g, '').slice(0, 40) + '…');
      } else g.today.push(`${NPCS[npc].name}과 포장마차에 갔다. 별말 없이 국물만 마셨다.`);
      break;
    }
    case 'cook': g.lunchbox = true; g.today.push('내일 도시락을 싸 두었다.'); break;
    case 'sauna': g.today.push('찜질방에서 땀을 뺐다. 조금 살 것 같다.'); break;
    case 'call': g.today.push(`${fam}에게 전화했다. 괜찮다고, 잘 지낸다고 말했다.`); break;
    case 'study': {
      g.studyNights++;
      const L = LICENSES[g.study!];
      if (g.studyNights >= L.nights) {
        g.licenses.push(L.id);
        g.today.push(`${L.name}을(를) 땄다!`);
        g.study = null; g.studyNights = 0;
      } else g.today.push(`${L.name} 공부를 했다. (${g.studyNights}/${L.nights})`);
      break;
    }
    case 'report': {
      for (const u of g.unpaid) if (u.due === null) u.due = g.day + 3;
      g.today.push('노동청에 진정을 넣었다. 사흘 뒤에 들어온단다.');
      break;
    }
    case 'konbini': g.today.push('편의점 도시락으로 저녁을 때웠다.'); break;
    case 'sleep': g.today.push(g.home === 'room' ? '일찍 누웠다.' : '일찍 몸을 뉘었다.'); break;
    case 'room': {
      g.money -= rentOf(g);
      g.home = 'room'; g.streetNights = 0;
      g.today.push(DIARY.backHome);
      if (!g.stamps.includes('comeback')) g.stamps.push('comeback');
      break;
    }
  }
  g.phase = 'night';
  return true;
}
/** 자격증 학원 등록 (돈은 먼저 낸다) */
export function startStudy(g: Game, id: LicenseId): boolean {
  const L = LICENSES[id];
  if (g.study || g.licenses.includes(id) || g.money < L.cost) return false;
  if (id === 'signal' && !hasSafety(g)) return false;
  g.money -= L.cost;
  g.study = id;
  g.studyNights = 0;
  return true;
}
export function buyGear(g: Game, id: GearId): boolean {
  if (g.gear.includes(id) || g.money < GEAR[id].cost) return false;
  g.money -= GEAR[id].cost;
  g.gear.push(id);
  return true;
}

// ─────────── 밤 ───────────
/** 일기를 쓰고 방값·도장·목표를 따진다. 결과 일기 글을 돌려준다 */
export function night(g: Game): string {
  if (g.phase !== 'night') return '';
  const lines = [`${g.day}일째. ${DIARY.weather[g.weather]}`, ...g.today];
  const r = rand(hash(g.seed, g.day, 61));
  // 하루 생활비: 못 내면 굶는다 (돈은 0 밑으로 내려가지 않는다)
  const living = livingOf(g);
  if (g.money >= living) { g.money -= living; g.hunger = 0; }
  else {
    g.money = 0; g.hunger++;
    g.mood = clamp(g.mood - 8, 0, 100);
    lines.push(pick(r, DIARY.hungry));
  }
  // 일주일마다 꼭 나가는 돈 (학자금·집 생활비·약값)
  if (g.day % 7 === 0) {
    const b = BACKGROUNDS[g.bg], amt = Math.round(b.weekly * MODES[g.mode].weekly / 1000) * 1000;
    if (g.money >= amt) { g.money -= amt; lines.push(`${b.weeklyName}: ${won(amt)}.`); }
    else { g.mood = clamp(g.mood - 12, 0, 100); lines.push(`이번 주는 ${b.weeklyName}를 못 했다. ${b.family} 얼굴이 떠올랐다.`); }
  }
  // 가끔 날아오는 청구서
  if (r() < MODES[g.mode].bills) {
    const [what, amt] = pick(r, BILLS);
    g.money = Math.max(0, g.money - amt);
    lines.push(`${what} (${won(amt)})`);
  }
  // 방값 (일주일마다). 두 주 밀리면 방에서 나와야 한다
  if (g.home === 'room' && g.day % 7 === 0) {
    const rent = rentOf(g);
    if (g.money >= rent + g.rentOwed) { g.money -= rent + g.rentOwed; g.rentOwed = 0; lines.push(DIARY.rent); }
    else {
      g.rentOwed += rent;
      g.mood = clamp(g.mood - 15, 0, 100);
      if (g.rentOwed >= rent * 2) { g.home = 'sauna'; g.rentOwed = 0; lines.push(DIARY.evicted); g.mood = clamp(g.mood - 10, 0, 100); }
      else lines.push(DIARY.noRent);
    }
  }
  // 방이 없으면: 찜질방 값이 있으면 찜질방, 없으면 거리
  if (g.home !== 'room') {
    if (g.money >= SAUNA_NIGHT) { g.money -= SAUNA_NIGHT; g.home = 'sauna'; g.streetNights = 0; g.mood = clamp(g.mood - 2, 0, 100); lines.push(pick(r, DIARY.sauna)); }
    else {
      g.home = 'street'; g.streetNights++;
      g.mood = clamp(g.mood - 10, 0, 100);
      lines.push(pick(r, DIARY.street));
      const cold = g.weather === 'cold' || g.weather === 'rain' ? 0.35 : 0.12;
      if (g.hurtDays === 0 && r() < cold) { g.hurtDays = 2; lines.push(DIARY.sick); }
    }
  }
  const text = lines.join(' ');
  g.diary.push({ day: g.day, text });
  if (g.diary.length > 120) g.diary.shift();
  checkStamps(g);
  // 오래 굶거나 오래 거리에서 자면 쓰러진다
  if (g.hunger >= 5 || g.streetNights >= 7) { g.phase = 'ending'; g.endKind = 'fall'; return text; }
  if (!g.goalDone && g.money >= g.goal) { g.goalDone = true; g.endKind = 'goal'; g.phase = 'ending'; }
  return text;
}

/** 소장님 가불 (돈이 바닥났을 때 한 번. 다음 일당에서 뺀다) */
export function canAdvance(g: Game): boolean { return g.phase === 'office' && g.advance === 0 && g.money < 30000 && g.rep >= 10; }
export function takeAdvance(g: Game): boolean {
  if (!canAdvance(g)) return false;
  g.money += ADVANCE; g.advance = ADVANCE;
  g.rep = clamp(g.rep - 3, 0, 100);
  g.today.push(DIARY.advance);
  return true;
}

export function checkStamps(g: Game): string[] {
  const got: string[] = [];
  const add = (id: string, ok: boolean) => { if (ok && !g.stamps.includes(id)) { g.stamps.push(id); got.push(id); } };
  add('first', g.worked >= 1);
  add('firstS', g.sCount >= 1);
  add('week', g.day >= 7);
  add('streak5', g.streak >= 5);
  add('named3', g.namedStreak >= 3);
  add('allJobs', (['clean', 'sort', 'line', 'pipe', 'crane'] as Kind[]).every((k) => g.done[k] > 0));
  add('allNew', KINDS.every((k) => g.done[k] > 0));
  add('license', g.licenses.length > BACKGROUNDS[g.bg].licenses.length);
  add('allLicense', LICENSE_IDS.every((l) => g.licenses.includes(l)));
  add('story', NPC_IDS.some((n) => g.seen[n] >= NPCS[n].stories.length));
  add('allStory', NPC_IDS.every((n) => g.seen[n] >= NPCS[n].stories.length));
  add('master', KINDS.some((k) => levelOf(g.xp[k]) >= 5));
  add('million', g.money >= 1000000);
  add('goal', g.goalDone);
  return got;
}
export const stampName = (id: string) => STAMPS.find((s) => s.id === id)?.name ?? id;

/** 목표를 이룬 뒤 계속하기: 다음 꿈 */
export function continueAfterGoal(g: Game): void {
  if (g.phase !== 'ending') return;
  g.goal = g.goal + 3000000;
  g.goalName = '다음 꿈: 내 이름으로 된 작은 가게';
  g.goalDone = false;
  g.phase = 'night';
  sleep(g);
}

export interface SleepNews { repaid: number; burnout: boolean; healed: boolean }
export function sleep(g: Game): SleepNews {
  const news: SleepNews = { repaid: 0, burnout: false, healed: false };
  if (g.phase !== 'night') return news;
  g.day++;
  if (g.hurtDays > 0) { g.hurtDays--; news.healed = g.hurtDays === 0; }
  // 어디서 잤는지가 회복을 정한다: 방 > 찜질방 > 거리, 굶으면 기운이 안 난다
  const bed = g.home === 'room' ? 1 : g.home === 'sauna' ? 0.8 : 0.5;
  g.fatigue = clamp(g.fatigue - 16 * g.recover * bed, 0, 100);
  const cap = g.staminaMax - g.hunger * 12 - (g.home === 'street' ? 12 : 0);
  g.stamina = clamp(cap - g.fatigue * 0.45, 20, g.staminaMax);
  g.mood = clamp(g.mood + ((g.home === 'room' ? 50 : g.home === 'sauna' ? 40 : 25) - g.mood) * 0.08, 0, 100);
  if (g.mood <= 5) { g.burnout = true; news.burnout = true; }
  for (const u of g.unpaid) if (u.due !== null && u.due <= g.day) { g.money += u.amount; g.earned += u.amount; news.repaid += u.amount; }
  if (news.repaid > 0) { g.unpaid = g.unpaid.filter((u) => !(u.due !== null && u.due <= g.day)); g.today = []; if (!g.stamps.includes('unpaid')) g.stamps.push('unpaid'); }
  g.weather = weatherFor(g.seed, g.day);
  g.lastPay = null;
  g.story = null;
  g.phase = 'wake';
  return news;
}

// ─────────── 저장 ───────────
export const SAVE_KEY = 'col_save';
export function parseSave(raw: unknown): Game | null {
  let o: any = raw;
  if (typeof raw === 'string') { try { o = JSON.parse(raw); } catch { return null; } }
  if (!o || typeof o !== 'object' || o.v !== 1 || !BACKGROUNDS[o.bg as BgId]) return null;
  const g = newGame(String(o.name ?? '나'), o.bg, Number(o.seed) || 1);
  const num = (k: keyof Game, lo: number, hi: number) => { const v = Number(o[k]); if (Number.isFinite(v)) (g as any)[k] = clamp(v, lo, hi); };
  num('day', 1, 99999); num('money', -1e9, 1e10); num('earned', 0, 1e10); num('goal', 1, 1e10); num('rep', 0, 100);
  num('stamina', 0, 200); num('staminaMax', 30, 200); num('fatigue', 0, 100); num('mood', 0, 100); num('recover', 0.5, 2);
  num('hurtDays', 0, 9); num('namedStreak', 0, 999); num('streak', 0, 99999); num('worked', 0, 99999); num('noJob', 0, 99999);
  num('rested', 0, 99999); num('sCount', 0, 99999); num('studyNights', 0, 9);
  if (typeof o.goalName === 'string') g.goalName = o.goalName;
  g.goalDone = !!o.goalDone; g.burnout = !!o.burnout; g.lunchbox = !!o.lunchbox;
  for (const k of KINDS) { g.xp[k] = Math.max(0, Number(o.xp?.[k]) || 0); g.done[k] = Math.max(0, Number(o.done?.[k]) || 0); }
  for (const n of NPC_IDS) { g.bond[n] = Math.max(0, Number(o.bond?.[n]) || 0); g.seen[n] = clamp(Number(o.seen?.[n]) || 0, 0, NPCS[n].stories.length); }
  if (Array.isArray(o.licenses)) g.licenses = o.licenses.filter((l: any) => LICENSES[l as LicenseId]);
  if (Array.isArray(o.gear)) g.gear = o.gear.filter((x: any) => GEAR[x as GearId]);
  g.study = LICENSES[o.study as LicenseId] && !g.licenses.includes(o.study) ? o.study : null;
  if (Array.isArray(o.stamps)) g.stamps = o.stamps.filter((s: any) => STAMPS.some((t) => t.id === s));
  if (Array.isArray(o.diary)) g.diary = o.diary.filter((d: any) => d && typeof d.text === 'string').slice(-120).map((d: any) => ({ day: Number(d.day) || 0, text: d.text }));
  if (Array.isArray(o.unpaid)) g.unpaid = o.unpaid.filter((u: any) => u && Number(u.amount) > 0).map((u: any) => ({ amount: Number(u.amount), site: String(u.site ?? ''), due: u.due == null ? null : Number(u.due) }));
  if (MODES[o.mode as Mode]) g.mode = o.mode;
  if (o.home === 'room' || o.home === 'sauna' || o.home === 'street') g.home = o.home;
  num('hunger', 0, 9); num('rentOwed', 0, 1e8); num('advance', 0, 1e7); num('streetNights', 0, 99);
  if (o.named && JOBS[o.named.kind as Kind]) g.named = { kind: o.named.kind, site: String(o.named.site) };
  g.weather = weatherFor(g.seed, g.day);
  // 하루 중간에 껐으면 그날 새벽부터 다시 (일당을 두 번 받는 일이 없게)
  g.phase = o.phase === 'ending' && g.money >= g.goal ? 'ending' : 'wake';
  if (o.phase === 'ending' && o.endKind === 'fall') { g.phase = 'ending'; g.endKind = 'fall'; }
  if (g.phase === 'wake' && !g.goalDone && g.money >= g.goal) { g.goalDone = true; }
  return g;
}
