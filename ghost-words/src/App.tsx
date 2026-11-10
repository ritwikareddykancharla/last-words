import { useCallback, useEffect, useMemo, useState } from 'react';
import { LANGUAGES, loadWikidataPack, type Language } from '../../skeleton/src/lexemes';
import type { LanguagePack } from '../../skeleton/src/pack';
import { buildChoice, mulberry32, type Choice } from '../../skeleton/src/quiz';
import { isLearned, learnedCount, pickNext, review, type Card } from '../../skeleton/src/srs';
import { getPack, getProgress, listPacks, putPack, putProgress } from '../../skeleton/src/store';
import { PlayButton } from '../../skeleton/src/ui';

const CACHE_DAYS = 7;
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

function packFromHash(): string | null {
  const m = /^#pack=(.+)$/.exec(window.location.hash);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1] as string);
  } catch {
    return null;
  }
}

export function App() {
  const [packId, setPackId] = useState<string | null>(packFromHash);
  const [community, setCommunity] = useState<LanguagePack[]>([]);

  useEffect(() => {
    const onHash = () => setPackId(packFromHash());
    window.addEventListener('hashchange', onHash);
    listPacks().then(
      (ps) => setCommunity(ps.filter((p) => p.origin === 'community' && p.words.length > 0)),
      () => setCommunity([]),
    );
    return () => window.removeEventListener('hashchange', onHash);
  }, [packId]);

  const open = (id: string | null) => {
    window.location.hash = id ? `pack=${encodeURIComponent(id)}` : '';
  };

  return (
    <div className="gw">
      <div className="moon" aria-hidden="true" />
      <header className="gw-head">
        <a href="#" className="gw-brand" onClick={() => open(null)}>
          <span aria-hidden="true">🪦</span> Ghost Words
        </a>
        <p>Words from languages that are fading, spoken by the people who still speak them. Learn one and it rises from the grave.</p>
      </header>
      {packId ? <Graveyard key={packId} packId={packId} onBack={() => open(null)} /> : <Home community={community} onOpen={open} />}
      <footer className="gw-foot">
        Ghost Words · an app built on the <a href="../">Last Words</a> skeleton · <a href="../echo-archive/">record your own language</a>
      </footer>
    </div>
  );
}

function Home({ community, onOpen }: { community: LanguagePack[]; onOpen: (id: string) => void }) {
  return (
    <main className="gw-home">
      <h1>Choose a language to bring back</h1>
      <ul className="langs">
        {LANGUAGES.map((l) => (
          <li key={l.id}>
            <button type="button" className="lang" onClick={() => onOpen(`wikidata-${l.id}`)}>
              <span className="endonym">{l.endonym}</span>
              <span className="name">{l.name}</span>
              <span className="status">{l.status}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="hint">Words, meanings and recordings come live from Wikidata lexemes and Wikimedia Commons, many recorded by Lingua Libre volunteers.</p>
      {community.length > 0 && (
        <>
          <h2>Recorded in Echo Archive on this device</h2>
          <ul className="langs">
            {community.map((p) => (
              <li key={p.id}>
                <button type="button" className="lang community" onClick={() => onOpen(p.id)}>
                  <span className="endonym">{p.endonym ?? p.name}</span>
                  <span className="name">{p.name}</span>
                  <span className="status">
                    {p.words.length} {p.words.length === 1 ? 'word' : 'words'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

type Load = { state: 'loading'; note: string } | { state: 'ready'; pack: LanguagePack } | { state: 'error'; message: string };

function Graveyard({ packId, onBack }: { packId: string; onBack: () => void }) {
  const [load, setLoad] = useState<Load>({ state: 'loading', note: 'Opening the graveyard…' });
  const [cards, setCards] = useState<Record<string, Card>>({});
  const [current, setCurrent] = useState<string | null>(null);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [risen, setRisen] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const lang: Language | undefined = LANGUAGES.find((l) => `wikidata-${l.id}` === packId);
        let pack = await getPack(packId).catch(() => undefined);
        const stale = !pack || Date.now() - Date.parse(pack.updated) > CACHE_DAYS * 86_400_000;
        if (lang && stale) {
          if (live) setLoad({ state: 'loading', note: `Summoning ${lang.name} words from Wikidata…` });
          const fresh = await loadWikidataPack(lang);
          await putPack(fresh).catch(() => undefined);
          pack = fresh;
        }
        if (!pack) throw new Error('This language pack is not on this device.');
        const progress = await getProgress(packId).catch(() => ({}));
        if (!live) return;
        setCards(progress);
        setLoad({ state: 'ready', pack });
      } catch (err) {
        if (live) setLoad({ state: 'error', message: message(err) });
      }
    })();
    return () => {
      live = false;
    };
  }, [packId, attempt]);

  const words = useMemo(() => (load.state === 'ready' ? load.pack.words.filter((w) => w.audio) : []), [load]);
  const byId = useMemo(() => new Map(words.map((w) => [w.id, w])), [words]);
  const ids = useMemo(() => words.map((w) => w.id), [words]);

  const next = useCallback(
    (avoid?: string) => {
      const id = pickNext(ids, cards, Date.now(), avoid);
      const w = id ? byId.get(id) : undefined;
      setCurrent(id);
      setPicked(null);
      setChoice(w ? buildChoice(words, w, mulberry32(Date.now() >>> 0)) : null);
    },
    [ids, cards, byId, words],
  );

  useEffect(() => {
    if (load.state === 'ready' && current === null) next();
  }, [load.state, current, next]);

  function answer(i: number) {
    if (picked !== null || !choice || !current) return;
    setPicked(i);
    const ok = i === choice.answer;
    const before = cards[current];
    const updated = { ...cards, [current]: review(before ?? { box: 0, due: 0, seen: 0, correct: 0 }, ok, Date.now()) };
    setCards(updated);
    if (!isLearned(before) && isLearned(updated[current])) setRisen(current);
    void putProgress(packId, updated).catch(() => undefined);
  }

  if (load.state === 'loading')
    return (
      <main className="gw-main center" role="status">
        <div className="candle" aria-hidden="true" />
        <p>{load.note}</p>
      </main>
    );
  if (load.state === 'error')
    return (
      <main className="gw-main center" role="alert">
        <p>The spirits would not answer: {load.message}</p>
        <div className="row">
          <button type="button" className="btn" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
          <button type="button" className="btn ghost" onClick={onBack}>
            Back
          </button>
        </div>
      </main>
    );

  const { pack } = load;
  const word = current ? byId.get(current) : undefined;
  const learned = learnedCount(ids, cards);

  return (
    <main className="gw-main">
      <div className="pack-head">
        <button type="button" className="btn ghost" onClick={onBack}>
          ← Languages
        </button>
        <div>
          <h1>
            {pack.endonym ?? pack.name} <span>{pack.name}</span>
          </h1>
          {pack.status && <p className="status-line">UNESCO: {pack.status}</p>}
        </div>
        <p className="progress" aria-live="polite">
          <strong>{learned}</strong> of {words.length} words risen
        </p>
      </div>

      {words.length === 0 ? (
        <p className="hint">This pack has no recorded words yet.</p>
      ) : (
        <div className="split">
          <section className="practice" aria-labelledby="q">
            {word && choice && (
              <>
                <p className="kicker">Listen, then choose what it means</p>
                <h2 id="q" className="word" lang={pack.id.replace(/^wikidata-/, '')}>
                  {word.text}
                </h2>
                <PlayButton audio={word.audio} label="Hear it" className="big" autoPlayKey={`${word.id}:${cards[word.id]?.seen ?? 0}`} />
                <div className="options" role="group" aria-label="Meanings">
                  {choice.options.map((o, i) => {
                    const verdict = picked === null ? '' : i === choice.answer ? 'right' : i === picked ? 'wrong' : 'dim';
                    return (
                      <button key={`${o}-${i}`} type="button" className={`option ${verdict}`} onClick={() => answer(i)} disabled={picked !== null}>
                        {o}
                      </button>
                    );
                  })}
                </div>
                {choice.options.length < 2 && <p className="hint">Only one meaning in this pack so far. Record more words in Echo Archive.</p>}
                <div className="feedback" aria-live="polite">
                  {picked !== null && (
                    <>
                      <p className={picked === choice.answer ? 'good' : 'bad'}>
                        {risen === word.id ? `“${word.text}” rises from the grave! 👻` : picked === choice.answer ? 'Yes. The ghost stirs.' : `It means “${choice.options[choice.answer]}”.`}
                      </p>
                      <button
                        type="button"
                        className="btn"
                        autoFocus
                        onClick={() => {
                          setRisen(null);
                          next(word.id);
                        }}
                      >
                        Next word
                      </button>
                    </>
                  )}
                </div>
                <p className="credit">
                  {word.speaker ? `Spoken by ${word.speaker}` : 'Recorded voice'}
                  {word.license ? ` · ${word.license}` : ''}
                  {word.source && (
                    <>
                      {' · '}
                      <a href={word.source} target="_blank" rel="noopener noreferrer">
                        source
                      </a>
                    </>
                  )}
                </p>
              </>
            )}
          </section>

          <section className="yard" aria-label="The graveyard of words">
            <ul>
              {words.map((w) => {
                const c = cards[w.id];
                const up = isLearned(c);
                return (
                  <li key={w.id} className={`stone${up ? ' risen' : ''}${c && !up ? ' stirring' : ''}${w.id === current ? ' here' : ''}`} title={up ? `${w.text}: ${w.gloss}` : w.text}>
                    {up && (
                      <span className="spirit" aria-hidden="true">
                        👻
                      </span>
                    )}
                    <span className="epitaph">{w.text}</span>
                    {up && <span className="meaning">{w.gloss}</span>}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}
      {pack.credit && <p className="credit wide">{pack.credit}</p>}
    </main>
  );
}
