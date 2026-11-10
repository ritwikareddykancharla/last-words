import type { Word } from './pack';

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/** Glosses that differ only in case, spacing, punctuation or a leading article are the same answer. */
export function normalizeGloss(g: string): string {
  return g
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/^\s*(?:the|a|an|to)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface Choice {
  options: string[];
  answer: number;
}

/** Up to `size` meanings, all different, exactly one of them right. */
export function buildChoice(words: readonly Word[], target: Word, rng: Rng, size = 4): Choice {
  const seen = new Set([normalizeGloss(target.gloss)]);
  const distractors: string[] = [];
  for (const w of shuffle(rng, words)) {
    if (distractors.length >= size - 1) break;
    const n = normalizeGloss(w.gloss);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    distractors.push(w.gloss);
  }
  const options = shuffle(rng, [target.gloss, ...distractors]);
  return { options, answer: options.indexOf(target.gloss) };
}
