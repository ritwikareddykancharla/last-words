import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { peaks } from './audio';
import { commonsFile, linguaLibreSpeaker, parseLexemes, type Row } from './lexemes';
import { emptyPack, PACK_FORMAT, safeAudioUrl, slug, validatePack, type AudioRef, type LanguagePack, type Word } from './pack';
import { buildChoice, mulberry32, normalizeGloss } from './quiz';
import { INTERVALS_MS, isLearned, LEARNED_BOX, MAX_BOX, newCard, pickNext, review, type Card } from './srs';

const nonBlank = (max: number) => fc.string({ minLength: 1, maxLength: max }).filter((s) => s.trim().length > 0);

const audio: fc.Arbitrary<AudioRef> = fc.oneof(
  fc.webUrl({ validSchemes: ['https'] }).map((url): AudioRef => ({ kind: 'url', url })),
  nonBlank(30).map((key): AudioRef => ({ kind: 'local', key })),
  fc.base64String({ maxLength: 64 }).map((b): AudioRef => ({ kind: 'data', dataUrl: `data:audio/webm;codecs=opus;base64,${b}` })),
);

const word: fc.Arbitrary<Word> = fc.record(
  { id: nonBlank(20), text: nonBlank(40), gloss: nonBlank(60), audio, speaker: nonBlank(30), license: nonBlank(20) },
  { requiredKeys: ['id', 'text', 'gloss'] },
);

const pack: fc.Arbitrary<LanguagePack> = fc
  .record({
    id: nonBlank(30),
    name: nonBlank(40),
    endonym: fc.option(nonBlank(40), { nil: undefined }),
    origin: fc.constantFrom('wikidata' as const, 'community' as const),
    words: fc.uniqueArray(word, { selector: (w) => w.id, maxLength: 12 }),
    updated: fc.date({ min: new Date(2000, 0, 1), max: new Date(2100, 0, 1), noInvalidDate: true }).map((d) => d.toISOString()),
  })
  .map((p) => {
    const out: LanguagePack = { format: PACK_FORMAT, id: p.id, name: p.name, origin: p.origin, words: p.words, updated: p.updated };
    if (p.endonym) out.endonym = p.endonym;
    return out;
  });

describe('language packs', () => {
  it('any valid pack survives export to JSON and import unchanged', () => {
    fc.assert(
      fc.property(pack, (p) => {
        const result = validatePack(JSON.parse(JSON.stringify(p)));
        expect(result).toEqual({ ok: true, pack: p });
      }),
    );
  });

  it('rejects unsafe audio anywhere in an imported pack', () => {
    fc.assert(
      fc.property(pack.filter((p) => p.words.length > 0), fc.nat(), fc.constantFrom('javascript:alert(1)', 'data:text/html;base64,PHNjcmlwdD4=', 'ftp://x/y.wav', 'http://evil.example/a.wav'), (p, i, bad) => {
        const w = p.words[i % p.words.length] as Word;
        const tampered = { ...p, words: p.words.map((x) => (x === w ? { ...x, audio: { kind: 'url', url: bad } } : x)) };
        const result = validatePack(JSON.parse(JSON.stringify(tampered)));
        expect(result.ok).toBe(false);
      }),
    );
  });

  it('rejects junk with reasons instead of throwing', () => {
    for (const junk of [null, 42, 'pack', [], { format: 'nope' }, { ...emptyPack('X', undefined, new Date()), words: [{ id: 'a' }] }]) {
      const r = validatePack(junk);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.length).toBeGreaterThan(0);
    }
  });

  it('only https audio (and Commons) is considered safe', () => {
    expect(safeAudioUrl('https://upload.wikimedia.org/a.wav')).toBe(true);
    expect(safeAudioUrl('http://commons.wikimedia.org/wiki/Special:FilePath/a.wav')).toBe(true);
    expect(safeAudioUrl('javascript:alert(1)')).toBe(false);
  });

  it('slugs are always url-safe and non-empty', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(slug(s)).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$|^pack$/);
      }),
    );
  });
});

describe('spaced repetition', () => {
  const answers = fc.array(fc.tuple(fc.boolean(), fc.integer({ min: 0, max: 10 * 86_400_000 })), { maxLength: 40 });

  it('boxes stay in range, right answers never move a card down, wrong answers go to box 1', () => {
    fc.assert(
      fc.property(answers, (seq) => {
        let c: Card = newCard();
        let now = 0;
        for (const [ok, dt] of seq) {
          now += dt;
          const next = review(c, ok, now);
          expect(next.box).toBeGreaterThanOrEqual(1);
          expect(next.box).toBeLessThanOrEqual(MAX_BOX);
          if (ok) expect(next.box).toBe(Math.min(MAX_BOX, c.box + 1));
          else expect(next.box).toBe(1);
          expect(next.due).toBe(now + (INTERVALS_MS[next.box] as number));
          expect(next.seen).toBe(c.seen + 1);
          expect(next.correct).toBeLessThanOrEqual(next.seen);
          c = next;
        }
      }),
    );
  });

  it('a word is learned after LEARNED_BOX right answers in a row', () => {
    let c = newCard();
    for (let i = 0; i < LEARNED_BOX; i++) {
      expect(isLearned(c)).toBe(false);
      c = review(c, true, i);
    }
    expect(isLearned(c)).toBe(true);
  });

  it('pickNext prefers the most overdue review, then new words, never repeats when it can avoid it', () => {
    const cardArb = fc.option(fc.record({ box: fc.integer({ min: 0, max: MAX_BOX }), due: fc.integer({ min: 0, max: 1000 }), seen: fc.nat(9), correct: fc.nat(9) }), { nil: undefined });
    fc.assert(
      fc.property(fc.array(cardArb, { minLength: 1, maxLength: 10 }), fc.integer({ min: 0, max: 1000 }), fc.option(fc.nat(9), { nil: undefined }), (cs, now, avoidIdx) => {
        const ids = cs.map((_, i) => `w${i}`);
        const cards: Record<string, Card> = {};
        cs.forEach((c, i) => {
          if (c) cards[`w${i}`] = c;
        });
        const avoid = avoidIdx !== undefined ? ids[avoidIdx % ids.length] : undefined;
        const pick = pickNext(ids, cards, now, avoid);
        expect(pick).not.toBeNull();
        if (ids.length > 1 && avoid !== undefined) expect(pick).not.toBe(avoid);
        const pool = ids.filter((id) => !(ids.length > 1 && id === avoid));
        const overdue = pool.filter((id) => (cards[id]?.box ?? 0) > 0 && (cards[id]?.due ?? Infinity) <= now);
        if (overdue.length) {
          const minDue = Math.min(...overdue.map((id) => cards[id]?.due ?? Infinity));
          expect(cards[pick as string]?.due).toBe(minDue);
          expect(overdue).toContain(pick);
        } else if (pool.some((id) => (cards[id]?.box ?? 0) === 0)) {
          expect(cards[pick as string]?.box ?? 0).toBe(0);
        }
      }),
    );
  });
});

describe('quiz', () => {
  it('always offers distinct meanings with exactly one right answer', () => {
    fc.assert(
      fc.property(fc.uniqueArray(word, { selector: (w) => w.id, minLength: 1, maxLength: 15 }), fc.nat(), fc.integer(), (ws, i, seed) => {
        const target = ws[i % ws.length] as Word;
        const { options, answer } = buildChoice(ws, target, mulberry32(seed));
        expect(options[answer]).toBe(target.gloss);
        const norm = options.map(normalizeGloss);
        expect(new Set(norm).size).toBe(options.length);
        expect(options.length).toBeLessThanOrEqual(4);
        expect(options.length).toBeGreaterThanOrEqual(1);
      }),
    );
  });

  it('treats "the cat", "Cat." and "cat" as the same answer', () => {
    expect(normalizeGloss('the cat')).toBe(normalizeGloss('Cat.'));
  });
});

describe('Wikidata lexemes', () => {
  const base = 'http://commons.wikimedia.org/wiki/Special:FilePath/';
  it('reads speaker and file from Lingua Libre names', () => {
    const file = commonsFile(`${base}LL-Q12107%20(bre)-ThonyVezbe-lard.wav`);
    expect(file).toBe('LL-Q12107 (bre)-ThonyVezbe-lard.wav');
    expect(linguaLibreSpeaker(file as string)).toBe('ThonyVezbe');
    expect(linguaLibreSpeaker('Cy-cath.ogg')).toBeUndefined();
  });

  it('one word per lexeme and per spelling, only safe https audio, nothing blank', () => {
    const row = fc.record({
      lexeme: fc.integer({ min: 1, max: 20 }).map((n) => ({ value: `http://www.wikidata.org/entity/L${n}` })),
      lemma: fc.constantFrom('ki', 'Ki', 'dour', 'tan', ' ', 'heol').map((value) => ({ value })),
      gloss: fc.constantFrom('dog', 'water', 'fire', '', 'sun').map((value) => ({ value })),
      audio: fc.constantFrom(`${base}LL-Q12107%20(bre)-X-ki.wav`, 'javascript:alert(1)', 'https://upload.wikimedia.org/a.ogg').map((value) => ({ value })),
    });
    fc.assert(
      fc.property(fc.array(row, { maxLength: 40 }), (rows: Row[]) => {
        const words = parseLexemes(rows);
        expect(new Set(words.map((w) => w.id)).size).toBe(words.length);
        expect(new Set(words.map((w) => w.text.toLowerCase())).size).toBe(words.length);
        for (const w of words) {
          expect(w.text.trim()).not.toBe('');
          expect(w.gloss.trim()).not.toBe('');
          expect(w.audio?.kind === 'url' && w.audio.url.startsWith('https://')).toBe(true);
        }
      }),
    );
  });
});

describe('waveforms', () => {
  it('peaks gives n bars in [0, 1] with the loudest at exactly 1 (or all 0 for silence)', () => {
    fc.assert(
      fc.property(fc.array(fc.double({ min: -1, max: 1, noNaN: true }), { maxLength: 500 }), fc.integer({ min: 1, max: 64 }), (xs, n) => {
        const p = peaks(xs, n);
        expect(p).toHaveLength(n);
        for (const v of p) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
        const loud = xs.some((x) => x !== 0);
        if (loud && xs.length >= n) expect(Math.max(...p)).toBeCloseTo(1, 10);
        if (!loud) expect(p.every((v) => v === 0)).toBe(true);
      }),
    );
  });
});
