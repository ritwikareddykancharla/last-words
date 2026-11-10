# Last Words 🪦📼

**A skeleton for endangered-language apps, and two apps built on it.**

About 40% of the world's languages are endangered. When the last speakers go, their words go with them. Last Words gives anyone building for a fading language the boring parts already done: a pack format, safe import and export, recordings, spaced repetition, quizzes and on-device storage. It ships with two very different apps on that foundation.

Kiroween 2026 entry, **Skeleton Crew** category.

| | 🪦 [Ghost Words](./ghost-words/) | 📼 [Echo Archive](./echo-archive/) |
| --- | --- | --- |
| For | Learners | Speakers and community archivists |
| Does | Teaches real recorded words. Every word you learn rises from its grave. | Records a language word by word, with consent and a license, and shares it as one file |
| Data | Live from Wikidata lexemes + Wikimedia Commons recordings (Breton, Irish, Welsh, Basque), or any pack recorded in Echo Archive | The speaker's own microphone, stored in the browser |
| Look | Moonlit graveyard | Attic of reel-to-reel tapes and typewriter labels |

Both apps share one pack format and one on-device store, so a word recorded in Echo Archive can be practiced in Ghost Words a moment later.

## Try it

- **Ghost Words:** pick Brezhoneg (Breton). Press **Hear it**, choose the meaning, and learn a word three times in a row to raise its tombstone.
- **Echo Archive:** create an archive (say, "Cornish"), type a word and its meaning, press **Record**, tick the consent box and save. Then press **Practice in Ghost Words**. **Export pack** writes one `.json` file with the recordings embedded; **Import a pack** reads one back after validating it.

## Run it locally

Requires Node.js 22.18 or newer.

```bash
npm install
npm run dev        # http://localhost:5178: landing page, /ghost-words/, /echo-archive/
npm test           # property-based tests for the skeleton
npm run build      # static site in dist/
```

Recording needs a secure page (`https://` or `localhost`).

## The skeleton

```
skeleton/src/
  pack.ts      LanguagePack format, validation of untrusted files, safe audio URLs
  lexemes.ts   Packs from Wikidata lexemes with a pronunciation recording (P443) and an English meaning
  srs.ts       Leitner spaced repetition (boxes: 1 min, 10 min, 1 day, 3 days, 7 days)
  quiz.ts      Multiple choice with distinct meanings and exactly one right answer
  audio.ts     Play any recording (with a Commons MP3 fallback for Safari), record with a level meter, waveform peaks
  store.ts     IndexedDB: packs, recordings, progress
  ui.tsx       PlayButton, Waveform
  base.css     Reset and accessibility helpers only; each app brings its own look
ghost-words/   App 1, uses lexemes, srs, quiz, audio, store, ui
echo-archive/  App 2, uses pack, audio, store, ui
```

To build a third app (a flashcard printer, a children's picture dictionary, a kiosk for a cultural center), add a folder with an `index.html`, import from `skeleton/src`, and add the page to `vite.config.ts`.

### Respecting communities

Language recordings belong to the people who speak them. Echo Archive asks for explicit consent per recording, records the speaker credit and a license (CC BY, CC BY-SA or "community only"), keeps everything on the device by default, and warns before exporting a pack that contains "community only" recordings. The Wikidata packs use only openly licensed recordings, mostly from [Lingua Libre](https://lingualibre.org/) volunteers, and credit each speaker.

## How it's tested

[fast-check](https://fast-check.dev/) property-based tests in `skeleton/src/skeleton.test.ts`:

- **Packs:** any valid pack survives export to JSON and import unchanged. Unsafe audio anywhere (`javascript:`, `data:text/html`, plain http outside Commons) makes import fail. Junk input returns reasons instead of throwing.
- **Spaced repetition:** boxes stay in range, right answers move up exactly one box, wrong answers go to box 1, due times match the box intervals. `pickNext` always serves the most overdue review first, then new words, and never repeats the last word when there's a choice.
- **Quiz:** options are always distinct (ignoring case, punctuation and leading articles) with exactly one right answer.
- **Wikidata parsing:** one word per lexeme and per spelling, never blank, only https audio. Lingua Libre speaker names are read from file names.
- **Waveforms:** n bars in [0, 1], loudest exactly 1, silence all 0.

End-to-end in headless Chromium with a fake microphone: created a "Cornish" archive, recorded and saved three words, practiced them in Ghost Words (correct answer accepted), then loaded 170 live Breton words from Wikidata and played a Lingua Libre recording.

**Not tested yet:** real speakers, Safari's Ogg fallback on an iPhone, and very large packs.

## License

Code: [MIT](./LICENSE). Wikidata lexemes are CC0; each Commons recording keeps its own license (shown with the word); recordings made in Echo Archive carry the license their speaker chose.
