// 정해진 씨앗으로 늘 같은 난수 (같은 날 같은 칠판·같은 날씨)
export function hash(...ns: number[]): number {
  let h = 2166136261 >>> 0;
  for (const n of ns) {
    h ^= (n | 0) + 0x9e3779b9 + ((h << 6) >>> 0) + (h >>> 2);
    h = Math.imul(h ^ (h >>> 16), 2246822507) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
  }
  return (h ^ (h >>> 16)) >>> 0;
}
/** 0~1 난수를 내는 함수 (mulberry32) */
export function rand(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function pick<T>(r: () => number, a: readonly T[]): T { return a[Math.floor(r() * a.length) % a.length]; }
