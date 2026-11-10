# Tech

## Stack
- React 19, TypeScript (strict, `noUncheckedIndexedAccess`), Vite 8 multi-page build: `index.html` (landing), `ghost-words/index.html`, `echo-archive/index.html`.
- Browser APIs: IndexedDB, MediaRecorder, Web Audio, HTMLAudioElement.
- Vitest + fast-check.

## Commands
- `npm test`: run all tests once. Never use watch mode from the agent.
- `npm run typecheck`, `npm run build`.
- `npm run dev` serves on port 5178. Ask the user to run it.

## Skeleton rules
- Shared code lives in `skeleton/src/` and must not import from either app.
- Apps import only from `skeleton/src/` and their own folder; never from each other.
- `skeleton/src/base.css` holds resets and accessibility helpers only. App looks live in each app's `styles.css`.
- Any data crossing a trust boundary (imported files) goes through `validatePack`. Audio must pass `safeAudioUrl` or be a `data:audio/…;base64` URL.
- Changing `LanguagePack` means bumping `PACK_FORMAT` and keeping the export/import round-trip property passing.

## Data rules
- Wikidata packs: lexemes with P443 pronunciation audio and an English gloss (sense definition, else the label of the sense's P5137 item). Cache in IndexedDB for 7 days.
- Credit every recording's speaker and license where it's played.
- Echo Archive must never save a recording without the consent checkbox ticked, and must warn before exporting "community only" recordings.

## Testing rules
- Pure skeleton modules have fast-check properties in `skeleton/src/skeleton.test.ts`.
- Tests stay offline and deterministic.
