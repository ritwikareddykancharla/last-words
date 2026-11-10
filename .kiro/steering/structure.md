# Structure

```
index.html                Landing page (skeleton + both apps)
skeleton/src/             The template shared by every app
  pack.ts, lexemes.ts, srs.ts, quiz.ts, audio.ts, store.ts, ui.tsx, base.css
  skeleton.test.ts
ghost-words/              App 1: learner
  index.html
  src/main.tsx, App.tsx, styles.css
echo-archive/             App 2: archivist
  index.html
  src/main.tsx, App.tsx, styles.css
.kiro/
  steering/               product.md, tech.md, structure.md
  specs/last-words/       requirements.md, design.md, tasks.md
  hooks/
```

## Conventions
- Components: PascalCase, named exports. Skeleton modules: camelCase.
- IndexedDB keys: packs by `pack.id`; recordings by `${pack.id}/${word.id}`; progress by `pack.id`.
- Pack ids: `wikidata-<iso639-3>` or `community-<slug>-<base36 time>`.
