/** Language packs from Wikidata lexemes that have a pronunciation recording (P443) and an English meaning. */

import { PACK_FORMAT, safeAudioUrl, type LanguagePack, type Word } from './pack';

export interface Language {
  id: string;
  qid: string;
  name: string;
  endonym: string;
  /** UNESCO Atlas of the World's Languages in Danger. */
  status: string;
}

export const LANGUAGES: readonly Language[] = [
  { id: 'bre', qid: 'Q12107', name: 'Breton', endonym: 'Brezhoneg', status: 'Severely endangered' },
  { id: 'gle', qid: 'Q9142', name: 'Irish', endonym: 'Gaeilge', status: 'Definitely endangered' },
  { id: 'cym', qid: 'Q9309', name: 'Welsh', endonym: 'Cymraeg', status: 'Vulnerable' },
  { id: 'eus', qid: 'Q8752', name: 'Basque', endonym: 'Euskara', status: 'Vulnerable' },
];

export function lexemeQuery(qid: string, limit = 600): string {
  return `SELECT ?lexeme ?lemma ?gloss ?audio WHERE {
  ?lexeme dct:language wd:${qid} ; wikibase:lemma ?lemma ; ontolex:sense ?sense ; ontolex:lexicalForm ?form .
  ?form wdt:P443 ?audio .
  OPTIONAL { ?sense skos:definition ?def . FILTER(LANG(?def) = "en") }
  OPTIONAL { ?sense wdt:P5137 ?item . ?item rdfs:label ?itemLabel . FILTER(LANG(?itemLabel) = "en") }
  BIND(COALESCE(?def, ?itemLabel) AS ?gloss)
  FILTER(BOUND(?gloss))
} LIMIT ${limit}`;
}

export interface Row {
  lexeme?: { value: string };
  lemma?: { value: string };
  gloss?: { value: string };
  audio?: { value: string };
}

/** "…/Special:FilePath/LL-Q12107%20(bre)-ThonyVezbe-lard.wav" -> "LL-Q12107 (bre)-ThonyVezbe-lard.wav" */
export function commonsFile(url: string): string | null {
  const m = /\/Special:FilePath\/(.+)$/.exec(url);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1] as string).replace(/_/g, ' ');
  } catch {
    return null;
  }
}

/** Lingua Libre file names carry the speaker: "LL-Q12107 (bre)-ThonyVezbe-lard.wav" -> "ThonyVezbe". */
export function linguaLibreSpeaker(file: string): string | undefined {
  return /^LL-Q\d+ \([^)]+\)-(.+?)-/.exec(file)?.[1];
}

const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();

/** One word per lexeme (first gloss, first recording), no duplicate spellings, only safe audio. */
export function parseLexemes(rows: readonly Row[]): Word[] {
  const byLexeme = new Map<string, Word>();
  const spellings = new Set<string>();
  for (const r of rows) {
    const lexeme = r.lexeme?.value;
    const text = tidy(r.lemma?.value ?? '');
    const gloss = tidy(r.gloss?.value ?? '');
    const audio = r.audio?.value;
    if (!lexeme || !text || !gloss || !audio || !safeAudioUrl(audio)) continue;
    const id = lexeme.split('/').pop() as string;
    if (byLexeme.has(id) || spellings.has(text.toLowerCase())) continue;
    const file = commonsFile(audio);
    const url = audio.replace(/^http:/, 'https:');
    byLexeme.set(id, {
      id,
      text,
      gloss: gloss.length > 120 ? `${gloss.slice(0, 117)}…` : gloss,
      audio: { kind: 'url', url },
      speaker: file ? linguaLibreSpeaker(file) : undefined,
      source: file ? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, '_'))}` : undefined,
    });
    spellings.add(text.toLowerCase());
  }
  return [...byLexeme.values()].sort((a, b) => a.text.localeCompare(b.text));
}

export async function loadWikidataPack(lang: Language, signal?: AbortSignal): Promise<LanguagePack> {
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(lexemeQuery(lang.qid))}`;
  const res = await fetch(url, { headers: { Accept: 'application/sparql-results+json' }, signal });
  if (!res.ok) throw new Error(`Wikidata answered ${res.status}`);
  const data = (await res.json()) as { results: { bindings: Row[] } };
  return {
    format: PACK_FORMAT,
    id: `wikidata-${lang.id}`,
    name: lang.name,
    endonym: lang.endonym,
    status: lang.status,
    origin: 'wikidata',
    credit: 'Words and meanings from Wikidata lexemes (CC0). Recordings from Wikimedia Commons, many by Lingua Libre volunteers (see each file for its license).',
    words: parseLexemes(data.results.bindings),
    updated: new Date().toISOString(),
  };
}
