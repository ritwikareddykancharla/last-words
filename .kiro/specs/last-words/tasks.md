# Implementation Plan: Last Words

- [x] 1. Scaffold (Vite multi-page, React, TypeScript strict, Vitest, fast-check), MIT license, steering docs

- [x] 2. Skeleton
  - [x] 2.1 Pack format and `validatePack`, properties P1–P4
    - _Requirements: 1.1–1.3_
  - [x] 2.2 IndexedDB store for packs, recordings, progress
    - _Requirements: 1.4_
  - [x] 2.3 Audio: playback for every AudioRef, Commons MP3 fallback, recording, peaks; property P10
    - _Requirements: 1.5_
  - [x] 2.4 Spaced repetition and quiz, properties P5–P8
    - _Requirements: 1.6_
  - [x] 2.5 Wikidata lexeme packs, property P9
    - _Requirements: 2.2_

- [x] 3. Ghost Words: language picker, graveyard, listen-and-choose practice, rising tombstones, credits
  - _Requirements: 2.1–2.6_

- [x] 4. Echo Archive: create, record with consent and license, list, delete, export, import, link to Ghost Words
  - _Requirements: 3.1–3.8_

- [x] 5. Landing page explaining the skeleton and linking both apps

- [x] 6. Headless browser run: record 3 words → practice them in Ghost Words; live Breton (170 words) with playback

- [ ] 7. Real-world testing
  - [ ] 7.1 Safari on iPhone: Ogg recordings via the MP3 fallback; MediaRecorder format
  - [ ] 7.2 A real speaker records 20 words; time it and collect feedback on the consent flow
  - [ ] 7.3 Pack with 1,000+ words: import/export speed and memory

- [ ] 8. Deploy to GitHub Pages and add the live URL to the README

- [ ] 9. Stretch
  - [ ] 9.1 Third app on the skeleton: printable flashcards
  - [ ] 9.2 Picture support (Wikidata P18 on the sense's item)
  - [ ] 9.3 More languages from Wikidata, ranked by number of recorded lexemes
  - [ ] 9.4 Offline support with a service worker
