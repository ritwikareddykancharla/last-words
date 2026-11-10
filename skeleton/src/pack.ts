/**
 * The skeleton's one shared data format: a language pack.
 * Every app built on Last Words reads and writes this shape.
 */

export const PACK_FORMAT = 'last-words/pack@1';

export type AudioRef =
  /** A public recording, e.g. on Wikimedia Commons. */
  | { kind: 'url'; url: string }
  /** A recording stored in this browser's IndexedDB under `key`. */
  | { kind: 'local'; key: string }
  /** A recording embedded in an exported pack. */
  | { kind: 'data'; dataUrl: string };

export interface Word {
  id: string;
  text: string;
  /** Meaning in English. */
  gloss: string;
  audio?: AudioRef;
  speaker?: string;
  license?: string;
  /** Where the word came from (a Wikidata lexeme or Commons file page). */
  source?: string;
}

export interface LanguagePack {
  format: typeof PACK_FORMAT;
  id: string;
  name: string;
  endonym?: string;
  /** UNESCO Atlas status, if known. */
  status?: string;
  origin: 'wikidata' | 'community';
  credit?: string;
  words: Word[];
  updated: string;
}

export const LIMITS = { id: 100, name: 80, text: 200, gloss: 300, speaker: 120, words: 5000, dataUrl: 4_000_000 } as const;

type Result = { ok: true; pack: LanguagePack } | { ok: false; errors: string[] };

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const str = (x: unknown, max: number, allowEmpty = false): x is string => typeof x === 'string' && x.length <= max && (allowEmpty || x.trim().length > 0);

/** Only https links (or Commons over http, which Wikidata still returns) and embedded audio are allowed. */
export function safeAudioUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || (u.protocol === 'http:' && u.hostname === 'commons.wikimedia.org');
  } catch {
    return false;
  }
}

function checkAudio(a: unknown, where: string, errors: string[]): AudioRef | undefined {
  if (a === undefined) return undefined;
  if (!isObj(a)) {
    errors.push(`${where}: audio must be an object`);
    return undefined;
  }
  if (a.kind === 'url' && typeof a.url === 'string' && safeAudioUrl(a.url)) return { kind: 'url', url: a.url };
  if (a.kind === 'local' && str(a.key, LIMITS.id)) return { kind: 'local', key: a.key };
  if (a.kind === 'data' && typeof a.dataUrl === 'string' && /^data:audio\/[\w.+-]+(;[\w=.+-]+)*;base64,[A-Za-z0-9+/=]*$/.test(a.dataUrl) && a.dataUrl.length <= LIMITS.dataUrl)
    return { kind: 'data', dataUrl: a.dataUrl };
  errors.push(`${where}: unsupported or unsafe audio`);
  return undefined;
}

/** Check untrusted JSON (an imported file) and return a clean pack, or every problem found. */
export function validatePack(input: unknown): Result {
  const errors: string[] = [];
  if (!isObj(input)) return { ok: false, errors: ['A pack must be a JSON object'] };
  if (input.format !== PACK_FORMAT) errors.push(`format must be "${PACK_FORMAT}"`);
  if (!str(input.id, LIMITS.id)) errors.push('id is missing or too long');
  if (!str(input.name, LIMITS.name)) errors.push('name is missing or too long');
  if (input.endonym !== undefined && !str(input.endonym, LIMITS.name, true)) errors.push('endonym is too long');
  if (input.status !== undefined && !str(input.status, LIMITS.name, true)) errors.push('status is too long');
  if (input.credit !== undefined && !str(input.credit, LIMITS.gloss, true)) errors.push('credit is too long');
  if (input.origin !== 'wikidata' && input.origin !== 'community') errors.push('origin must be "wikidata" or "community"');
  if (typeof input.updated !== 'string' || Number.isNaN(Date.parse(input.updated))) errors.push('updated must be a date');
  if (!Array.isArray(input.words)) errors.push('words must be a list');
  else if (input.words.length > LIMITS.words) errors.push(`at most ${LIMITS.words} words`);

  const words: Word[] = [];
  const ids = new Set<string>();
  if (Array.isArray(input.words)) {
    input.words.slice(0, LIMITS.words).forEach((w, i) => {
      const where = `word ${i + 1}`;
      if (!isObj(w)) return void errors.push(`${where}: must be an object`);
      if (!str(w.id, LIMITS.id)) return void errors.push(`${where}: id is missing`);
      if (ids.has(w.id)) return void errors.push(`${where}: duplicate id ${w.id}`);
      if (!str(w.text, LIMITS.text)) return void errors.push(`${where}: text is missing or too long`);
      if (!str(w.gloss, LIMITS.gloss)) return void errors.push(`${where}: meaning is missing or too long`);
      const audio = checkAudio(w.audio, where, errors);
      const word: Word = { id: w.id, text: w.text, gloss: w.gloss };
      if (audio) word.audio = audio;
      if (str(w.speaker, LIMITS.speaker)) word.speaker = w.speaker;
      if (str(w.license, LIMITS.name)) word.license = w.license;
      if (typeof w.source === 'string' && safeAudioUrl(w.source)) word.source = w.source;
      ids.add(w.id);
      words.push(word);
    });
  }
  if (errors.length) return { ok: false, errors };
  const pack: LanguagePack = {
    format: PACK_FORMAT,
    id: input.id as string,
    name: input.name as string,
    origin: input.origin as LanguagePack['origin'],
    words,
    updated: input.updated as string,
  };
  if (typeof input.endonym === 'string' && input.endonym) pack.endonym = input.endonym;
  if (typeof input.status === 'string' && input.status) pack.status = input.status;
  if (typeof input.credit === 'string' && input.credit) pack.credit = input.credit;
  return { ok: true, pack };
}

export function slug(s: string): string {
  return (
    s
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'pack'
  );
}

export function emptyPack(name: string, endonym: string | undefined, now: Date): LanguagePack {
  return {
    format: PACK_FORMAT,
    id: `community-${slug(name)}-${now.getTime().toString(36)}`,
    name: name.trim(),
    endonym: endonym?.trim() || undefined,
    origin: 'community',
    words: [],
    updated: now.toISOString(),
  };
}
