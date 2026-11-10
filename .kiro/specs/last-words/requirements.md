# Requirements: Last Words

## Introduction
Last Words is a reusable skeleton for endangered-language apps and two apps built on it: Ghost Words (learning) and Echo Archive (recording).

## Requirement 1: The skeleton
**User story:** As a developer, I want the shared parts of a language app done, so that I can build a new app quickly.

### Acceptance criteria
1. The skeleton SHALL define one `LanguagePack` format used by every app.
2. WHEN a pack file is imported THEN the skeleton SHALL validate it and SHALL reject it with reasons if any field is missing, too long, duplicated, or has unsafe audio.
3. A valid pack exported to JSON and imported again SHALL be unchanged.
4. The skeleton SHALL store packs, recordings and progress on the device, shared by every app on the same site.
5. The skeleton SHALL play recordings from a URL, from on-device storage or embedded in a pack, and SHALL record from the microphone with a level meter and a 10-second limit.
6. The skeleton SHALL provide spaced repetition and multiple-choice questions.

## Requirement 2: Ghost Words
**User story:** As a learner, I want to learn real words from an endangered language by listening to native speakers.

### Acceptance criteria
1. The app SHALL offer Breton, Irish, Welsh and Basque from Wikidata, with each language's own name and UNESCO status, plus any packs recorded on this device.
2. WHEN a Wikidata language is opened THEN the app SHALL load lexemes that have a recording and an English meaning, and SHALL cache them for 7 days.
3. Each question SHALL show the word, play its recording (automatically after the first interaction), and offer up to 4 distinct meanings with exactly one right answer.
4. WHEN the user answers THEN the app SHALL mark right and wrong, update spaced repetition, and save progress.
5. The graveyard SHALL show every word as a tombstone; a word answered right 3 times in a row SHALL "rise" and show its meaning.
6. Every recording SHALL show its speaker, license where known, and a link to its source.

## Requirement 3: Echo Archive
**User story:** As a speaker or archivist, I want to record my language with consent and share it on my terms.

### Acceptance criteria
1. The user SHALL be able to create an archive with an English name and the language's own name.
2. To save a word, the user SHALL provide the word, its meaning and a recording, choose a license, and confirm the speaker's consent. Save SHALL be disabled until all are present.
3. The app SHALL list archived words with playback, speaker and license, and allow deleting a word or a whole archive after confirmation.
4. WHEN the user exports THEN the app SHALL download one JSON pack with recordings embedded.
5. IF the archive contains "community only" recordings THEN the app SHALL warn before export.
6. WHEN the user imports a pack THEN the app SHALL validate it and store its recordings on the device.
7. The app SHALL link straight to practicing the archive in Ghost Words.
8. IF the microphone is blocked or the page isn't secure THEN the app SHALL explain why.
