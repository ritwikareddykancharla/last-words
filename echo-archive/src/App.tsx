import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { blobPeaks, blobToDataUrl, dataUrlToBlob, startRecording, type Recording } from '../../skeleton/src/audio';
import { emptyPack, slug, validatePack, type LanguagePack, type Word } from '../../skeleton/src/pack';
import { deleteAudio, deletePack, getAudio, getPack, listPacks, putAudio, putPack } from '../../skeleton/src/store';
import { PlayButton, Waveform } from '../../skeleton/src/ui';

const LICENSES = [
  { id: 'CC BY 4.0', label: 'CC BY 4.0: anyone may reuse with credit' },
  { id: 'CC BY-SA 4.0', label: 'CC BY-SA 4.0: reuse with credit, share alike' },
  { id: 'Community only', label: 'Community only: not for sharing outside' },
] as const;
const COMMUNITY_ONLY = 'Community only';
const MAX_RECORD_MS = 10_000;
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

export function App() {
  const [packs, setPacks] = useState<LanguagePack[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setPacks((await listPacks()).filter((p) => p.origin === 'community').sort((a, b) => b.updated.localeCompare(a.updated)));
    } catch (err) {
      setError(`This browser can't store recordings: ${message(err)}`);
      setPacks([]);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="ea">
      <header className="ea-head">
        <div className="reel" aria-hidden="true">
          <span />
          <span />
        </div>
        <div>
          <a className="ea-brand" href="./" onClick={(e) => (e.preventDefault(), setOpenId(null))}>
            Echo Archive
          </a>
          <p>Record your language, word by word, in the voices of the people who speak it. Recordings stay on this device until you choose to share them.</p>
        </div>
      </header>
      {error && (
        <p className="ea-error" role="alert">
          {error}
        </p>
      )}
      {openId ? (
        <PackEditor key={openId} id={openId} onClose={() => (setOpenId(null), void refresh())} />
      ) : (
        <Shelf packs={packs} onOpen={setOpenId} onChanged={refresh} />
      )}
      <footer className="ea-foot">
        Echo Archive · an app built on the <a href="../">Last Words</a> skeleton · <a href="../ghost-words/">practice in Ghost Words</a>
      </footer>
    </div>
  );
}

function Shelf({ packs, onOpen, onChanged }: { packs: LanguagePack[] | null; onOpen: (id: string) => void; onChanged: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [endonym, setEndonym] = useState('');
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const p = emptyPack(name, endonym, new Date());
    await putPack(p);
    onOpen(p.id);
  }

  async function importFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const result = validatePack(JSON.parse(await file.text()));
      if (!result.ok) {
        setImportMsg({ ok: false, text: `That file isn't a valid pack: ${result.errors.slice(0, 4).join('; ')}${result.errors.length > 4 ? '…' : ''}` });
        return;
      }
      const pack = { ...result.pack, origin: 'community' as const };
      // Embedded audio moves into this browser's storage.
      const words: Word[] = [];
      for (const w of pack.words) {
        if (w.audio?.kind === 'data') {
          const key = `${pack.id}/${w.id}`;
          await putAudio(key, await dataUrlToBlob(w.audio.dataUrl));
          words.push({ ...w, audio: { kind: 'local', key } });
        } else if (w.audio?.kind === 'local') {
          words.push({ ...w, audio: undefined });
        } else words.push(w);
      }
      await putPack({ ...pack, words });
      setImportMsg({ ok: true, text: `Imported ${pack.name}: ${words.length} words.` });
      await onChanged();
    } catch (err) {
      setImportMsg({ ok: false, text: `Could not read that file: ${message(err)}` });
    }
  }

  return (
    <main className="shelf">
      <section className="card">
        <h1>Start a new archive</h1>
        <form className="new-pack" onSubmit={(e) => void create(e)}>
          <label>
            Language name in English
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cornish" required maxLength={80} />
          </label>
          <label>
            Its own name for itself (optional)
            <input value={endonym} onChange={(e) => setEndonym(e.target.value)} placeholder="e.g. Kernewek" maxLength={80} />
          </label>
          <button type="submit" className="btn rec">
            Create archive
          </button>
        </form>
      </section>

      <section className="card">
        <h2>On this device</h2>
        {packs === null ? (
          <p className="muted">Opening the shelf…</p>
        ) : packs.length === 0 ? (
          <p className="muted">No archives yet. Create one above, or import a pack someone shared with you.</p>
        ) : (
          <ul className="tapes">
            {packs.map((p) => (
              <li key={p.id}>
                <button type="button" className="tape" onClick={() => onOpen(p.id)}>
                  <span className="tape-label">{p.endonym ?? p.name}</span>
                  <span className="muted">
                    {p.name} · {p.words.length} {p.words.length === 1 ? 'word' : 'words'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <label className="btn ghost file">
          Import a pack (.json)
          <input type="file" accept="application/json,.json" onChange={(e) => void importFile(e)} />
        </label>
        {importMsg && (
          <p className={importMsg.ok ? 'ok' : 'ea-error'} role="status">
            {importMsg.text}
          </p>
        )}
      </section>
    </main>
  );
}

type Take = { blob: Blob; peaks: number[] | null; url: string };

function PackEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const [pack, setPack] = useState<LanguagePack | null>(null);
  const [text, setText] = useState('');
  const [gloss, setGloss] = useState('');
  const [speaker, setSpeaker] = useState(() => localStorage.getItem('echo.speaker') ?? '');
  const [license, setLicense] = useState<string>(LICENSES[0].id);
  const [consent, setConsent] = useState(false);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [level, setLevel] = useState(0);
  const [take, setTake] = useState<Take | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const textRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getPack(id).then((p) => setPack(p ?? null), (err: unknown) => setStatus(message(err)));
  }, [id]);

  useEffect(() => {
    if (!recording) return;
    let raf = 0;
    const tick = () => {
      setLevel(recording.level());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [recording]);

  useEffect(
    () => () => {
      if (take) URL.revokeObjectURL(take.url);
    },
    [take],
  );

  async function finish(rec: Recording) {
    const blob = await rec.stop();
    setRecording(null);
    setLevel(0);
    if (blob.size === 0) return setStatus('Nothing was recorded. Check the microphone and try again.');
    setTake({ blob, peaks: await blobPeaks(blob, 60), url: URL.createObjectURL(blob) });
    setStatus(null);
  }

  async function toggleRecord() {
    if (recording) return finish(recording);
    setStatus(null);
    try {
      const rec = await startRecording(MAX_RECORD_MS, () => void finish(rec));
      setTake(null);
      setRecording(rec);
    } catch (err) {
      const e = err as DOMException;
      setStatus(e?.name === 'NotAllowedError' ? 'Microphone blocked. Allow it from the address bar, then try again.' : message(err));
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!pack || !take || !text.trim() || !gloss.trim() || !consent) return;
    const wordId = newId();
    const key = `${pack.id}/${wordId}`;
    await putAudio(key, take.blob);
    const word: Word = { id: wordId, text: text.trim(), gloss: gloss.trim(), audio: { kind: 'local', key }, license };
    if (speaker.trim()) word.speaker = speaker.trim();
    const next = { ...pack, words: [word, ...pack.words], updated: new Date().toISOString() };
    await putPack(next);
    localStorage.setItem('echo.speaker', speaker.trim());
    setPack(next);
    setText('');
    setGloss('');
    setTake(null);
    setConsent(false);
    setStatus(`Saved “${word.text}”.`);
    textRef.current?.focus();
  }

  async function remove(w: Word) {
    if (!pack || !window.confirm(`Delete “${w.text}” and its recording from this device?`)) return;
    if (w.audio?.kind === 'local') await deleteAudio(w.audio.key).catch(() => undefined);
    const next = { ...pack, words: pack.words.filter((x) => x.id !== w.id), updated: new Date().toISOString() };
    await putPack(next);
    setPack(next);
  }

  async function removePack() {
    if (!pack || !window.confirm(`Delete the whole ${pack.name} archive (${pack.words.length} recordings) from this device? This can't be undone.`)) return;
    for (const w of pack.words) if (w.audio?.kind === 'local') await deleteAudio(w.audio.key).catch(() => undefined);
    await deletePack(pack.id);
    onClose();
  }

  async function exportPack() {
    if (!pack) return;
    setExporting(true);
    try {
      const words: Word[] = [];
      for (const w of pack.words) {
        if (w.audio?.kind === 'local') {
          const blob = await getAudio(w.audio.key);
          words.push(blob ? { ...w, audio: { kind: 'data', dataUrl: await blobToDataUrl(blob) } } : { ...w, audio: undefined });
        } else words.push(w);
      }
      const file = new Blob([JSON.stringify({ ...pack, words }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file);
      a.download = `${slug(pack.name)}.lastwords.json`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (err) {
      setStatus(`Export failed: ${message(err)}`);
    } finally {
      setExporting(false);
    }
  }

  if (!pack) return <main className="card">{status ?? 'Opening the archive…'}</main>;
  const restricted = pack.words.filter((w) => w.license === COMMUNITY_ONLY).length;
  const canSave = Boolean(take && text.trim() && gloss.trim() && consent && !recording);

  return (
    <main className="editor">
      <div className="editor-head">
        <button type="button" className="btn ghost" onClick={onClose}>
          ← Shelf
        </button>
        <h1>
          {pack.endonym ?? pack.name} {pack.endonym && <span>{pack.name}</span>}
        </h1>
        <div className="row">
          <a className="btn ghost" href={`../ghost-words/#pack=${encodeURIComponent(pack.id)}`}>
            Practice in Ghost Words
          </a>
          <button type="button" className="btn ghost" onClick={() => void exportPack()} disabled={exporting || pack.words.length === 0}>
            {exporting ? 'Packing…' : 'Export pack'}
          </button>
        </div>
      </div>
      {restricted > 0 && (
        <p className="warn">
          {restricted} {restricted === 1 ? 'recording is' : 'recordings are'} marked “community only”. If you export this pack, share the file only inside your community.
        </p>
      )}

      <div className="editor-grid">
        <form className="card recorder" onSubmit={(e) => void save(e)}>
          <h2>Record a word</h2>
          <label>
            The word
            <input ref={textRef} value={text} onChange={(e) => setText(e.target.value)} required maxLength={200} lang="und" autoComplete="off" />
          </label>
          <label>
            What it means, in English
            <input value={gloss} onChange={(e) => setGloss(e.target.value)} required maxLength={300} autoComplete="off" />
          </label>
          <label>
            Speaker (shown as credit)
            <input value={speaker} onChange={(e) => setSpeaker(e.target.value)} maxLength={120} placeholder="Name or initials" />
          </label>

          <div className="deck">
            <button type="button" className={`rec-button${recording ? ' on' : ''}`} onClick={() => void toggleRecord()} aria-pressed={Boolean(recording)}>
              <span className="dot" aria-hidden="true" />
              {recording ? 'Stop' : take ? 'Record again' : 'Record'}
            </button>
            <div className="meter" aria-hidden="true">
              <span style={{ width: `${Math.round(level * 100)}%` }} />
            </div>
          </div>
          {take && (
            <div className="take">
              <Waveform peaks={take.peaks} />
              <audio src={take.url} controls preload="auto" />
            </div>
          )}
          <p className="muted small">Up to {MAX_RECORD_MS / 1000} seconds. Say the word once or twice, clearly, in a quiet room.</p>

          <label>
            License
            <select value={license} onChange={(e) => setLicense(e.target.value)}>
              {LICENSES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label className="consent">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>The speaker agrees to this recording being saved and used under the license above.</span>
          </label>
          <button type="submit" className="btn rec" disabled={!canSave}>
            Save to the archive
          </button>
          <p className="status" role="status">
            {status}
          </p>
        </form>

        <section className="card">
          <h2>
            {pack.words.length} {pack.words.length === 1 ? 'word' : 'words'} archived
          </h2>
          {pack.words.length === 0 ? (
            <p className="muted">Your first recording will appear here.</p>
          ) : (
            <ul className="entries">
              {pack.words.map((w) => (
                <li key={w.id}>
                  <PlayButton audio={w.audio} label={`Play ${w.text}`} />
                  <div>
                    <strong>{w.text}</strong> <span className="muted">“{w.gloss}”</span>
                    <p className="muted small">
                      {w.speaker ? `${w.speaker} · ` : ''}
                      {w.license ?? 'no license'}
                    </p>
                  </div>
                  <button type="button" className="icon" onClick={() => void remove(w)} aria-label={`Delete ${w.text}`}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="link danger" onClick={() => void removePack()}>
            Delete this archive
          </button>
        </section>
      </div>
    </main>
  );
}
