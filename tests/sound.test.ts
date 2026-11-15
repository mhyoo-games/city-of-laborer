import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRACKS, parseNotes } from '../src/audio/sound.ts';

test('곡마다 멜로디와 베이스 길이가 같고, 북은 16칸', () => {
  for (const [name, t] of Object.entries(TRACKS)) {
    const len = (s: string) => parseNotes(s).reduce((a, [, d]) => a + d, 0);
    assert.equal(len(t.lead), len(t.bass), name);
    assert.equal(t.drum.length, 16, name);
  }
});
