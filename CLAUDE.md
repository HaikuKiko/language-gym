# Language Gym: notes for Claude

Read AGENTS.md too (Expo rules). Current sprint: see `docs/sprint-speed-friending.md`.
Things agreed for later: `BACKLOG.md`.

## The owner

- An EFL teacher, new to coding. Uses an iPad, an Android phone and a Windows PC.
- Write plainly: short answers, direct clickable links, no jargon without a one-line explanation.
- Prototype stage: simple, "weak" security is fine (codes + 4-digit PINs, no email sign-in).

## How to work with them

- **You open AND merge the pull requests yourself**, then tell them. Develop on the branch the
  session gives you; merge into `main`.
- **Show a mock-up before any big UI change** (render an HTML mock-up to a PNG with Playwright and
  send it) and wait for "go".
- **"Don't interrupt"**: they queue new requests while you work. Finish the current task, then do
  the next one.
- **Tell them when a change is live** (see "Checking the live site").
- Run database (schema) changes yourself with the Supabase tool (see "Database").
- No model names in commits, PRs or code comments.
- **Limits and settings** (daily limits, word limits, how long things are kept, …) go in code as
  named constants (`UPPER_CASE`) in one block at the top of the file, never as secrets or numbers
  buried in the code.

## The app

- Expo SDK 58, Expo Router (`src/app`), react-native-web, TypeScript strict.
  Check: `npx tsc --noEmit` (lint does not run in the cloud container).
- After adding a route, refresh the typed routes by running
  `CI=1 npx expo start --web --port 8099` for ~40 s, then stop it.
- Live site: https://language-gym.gjballvn.workers.dev/ (Cloudflare Workers builds `main`
  in ~3–5 min; the instant-failing branch preview build is harmless).

### Parts of the app

- **Front door (promotion):** `/` (`index.tsx`) is the public **landing page** for the speaking product
  only (name in `src/constants/product.json` → `PRODUCT_NAME`, also the browser tab title via
  `app.config.js`; sentence and `LANDING_VIDEO_URL` in `src/constants/product.ts`): "Try it now" →
  `/host?mode=friending`, "Try the demo" → `/demo`. Never mention IELTS, class writing or Language Gym
  there. "Speed friending" is the internal name; visitors see `PRODUCT_NAME`.
- **Teacher dashboard:** `/dashboard` (`dashboard.tsx`, wrapped in `TeacherOnly`): all modes, class
  writing, marking, "Links to send students". Nothing public links to it; teacher pages go "Back" to it.
- **Students never see the dashboard:** the QR code opens `join/[code].tsx` (old `/?code=` links redirect
  there); student screens (`session/[code]`, `write`, `ielts`, `account`) never link to `/dashboard`
  ("Back" only if `router.canGoBack()`; leaving a session goes to its join page). A finished speed-
  friending session says "You can close this page" + "Teacher or group leader? Run this with your own
  group →" (the landing page).
- **Privacy & contact:** `/privacy` (plain English; `RETENTION_DAYS`), `/contact` ("Keep me posted":
  table `contact_messages`, insert by anyone, read by teachers; shown on the dashboard). Footer links
  (`FooterLinks`) on the landing, join and contact pages. Sessions + participants are readable only by
  the host and that session's students (restrictive RLS with `can_see_session`; joining uses the
  `session_by_code` RPC). Sessions (and names, by cascade) are deleted nightly after 30 days (pg_cron
  job `delete-old-sessions` → `delete_old_sessions(30)`; keep it equal to `RETENTION_DAYS`).
- **Core / speed friending (live sessions):** `host.tsx`, `session/[code].tsx`, `single.tsx`,
  `src/lib/live-session.ts`, `round-robin.ts`, `session.ts`, `src/hooks/use-questions.tsx`,
  components `round-settings-form`, `join-qr-code`, `grammar-card`, `live-timer`.
  Questions table: 1,488 rows (levels × themes, 15 each); defaults: Automatic, 2 minutes, round robin.
  Two modes (flag in `sessions.categories`): **Speed friending** (dashboard "🎉 Speed friending" →
  `/host?mode=friending`; questions per level A1–C2 × 8 fun themes × 10 in
  `src/data/fun-questions.ts` / table `friending_questions`; each student gets their own question,
  `questionForStudent`: (roster seat + round) through a seeded shuffle; no grammar) and
  **Conversation practice** ("Host a session" → `/host`; one question for everyone + weekly grammar).
  Each round: students find their partner and tap "We found each other!" (one tap per pair); the
  questions appear when every pair is found. Old table `fun_questions` is no longer used.
  **Custom question sets** (speed friending): tables `custom_question_sets` (name, description = one
  line on what it's for, active) + `custom_questions` (set_id, text, active); the same questions at
  every level. Shown as "★ name" chips under "Custom" on the setup screen (only when a set has
  questions); flag `custom:<set id>` in `sessions.categories`. The owner asks Claude for a set: write
  the questions, insert them with SQL, and tell the owner. Later: teachers add their own.
  **Take turns** (experiment, default on for speed friending; "Free conversation" switches it off; flag
  `take-turns`): each round is split equally within a group (`turnFor`); in turn k person k talks and the
  next person asks them their own question (only the asker sees it; the talker listens), with follow-up prompts: each question's own 3 (`follow_ups` text[] column on `friending_questions` and
  `custom_questions`; write 3 for every new question), else the general `FOLLOW_UPS`
  and "🔄 Swap!" for `SWAP_NOTICE_MS`. To roll back completely: revert the "Take turns" PR.
  **Solo demo** (`demo.tsx`, from "Try the demo first" on the setup screen; params level/week/custom/
  turns/minutes): a whole session kept only in memory (`SessionBackendProvider` in
  `src/lib/session-backend.tsx` swaps Supabase for local state; the host and student screens use
  `useSessionBackend()` for every change). Four pretend students join, find each other and tap; teacher screen +
  phones side by side (tabs when narrow). Never saved.
- **Word games** (27 Nov 2026, dashboard "🔥 Word games" → `/word-game?game=hot-seat|explain-it`):
  `src/lib/word-game.ts` (settings constants at the top, names in `WORD_GAMES`), `src/data/word-cards.ts`
  (our own cards, 60 per level: word + 4 banned words; never the board game's name or cards),
  `screens/word-game-host-screen.tsx`, `word-game-student-screen.tsx`, `components/word-card-view.tsx`.
  Same sessions/participants tables and join flow; flags `word-game:<kind>`, `group-size:N`, `groups:G`
  (fixed at start). **Hot Seat**: one guesser per group, the rest see the word. **Explain It**: only the
  explainer sees it. Groups go at their own pace: "Got it"/"Skip" (saved on the tapper's own row as
  `got_cards`/`skipped_cards`, card numbers within the group) gives a new word and the next person the turn.
  One game clock (`round_minutes`); most words guessed wins. Late joiners are added to a group by the host screen.
- **General English writing:** `write.tsx`, `src/lib/writing.ts` (also photo reading),
  `components/writing-feedback.tsx` (the feedback view). Four areas, as on the school's sheets:
  **Content, Organisation, Grammar, Vocabulary** (IELTS keeps its own four criteria).
- **Class writing** (teachers): `class-sets/` (writing marked from a scan), `classes/[id]` (a class:
  target level, students), `students/[id]` (a student's history); `src/lib/class-sets.ts`,
  `classes.ts` (classes, students, matching misread names), `class-scores.ts` (score out of 10 vs the
  class target: all four areas at target = 7, above climbs to 10, below falls gently; constants at the
  top). A PDF scan (pdf.js from cdnjs, web only) or photos, one page = one student, read in "sheet"
  mode and marked; area levels may be "+" levels (A2+). Tables `classes`, `class_students`,
  `class_sets`, `class_set_pages` (+ bucket `class-set-photos`): own rows only, and **teachers only**
  (restrictive RLS with `is_teacher()`); the screens are wrapped in `TeacherOnly`.
  "Delete this class set" (with an "Are you sure?" step) removes the set, its pages (cascade) and photos.
  A student's writing may run over several pages: all pages are read first, then a page without the
  printed sheet header (no name/class/date/grammar focus, `isFirstPage`) joins the student before it
  (`continues_page` = their first page's number; it has no feedback), then each student's whole text
  is marked once. Sets made before this are regrouped and re-marked when opened (`needsGrouping`).
  Marking waits for the teacher: after reading, each student shows "N guessed words to check" (orange)
  or "✓ All clear"; tapping a student shows `ReadingCheck` (text with guessed words in pink, editable;
  `edited_text`, `reading_checked`), then "Mark all N" (checking first is optional). "Check the reading"
  after marking, and a changed text is marked again.
  **Line by line** (sheets read from 25 Nov 2026, `sheet.line_by_line`): the transcript keeps the paper's
  lines (one per handwritten line, an empty line between paragraphs); it is sent for marking as running
  text (`joinLines`, same length) with the guessed words (`guessed_words`: never corrected; the app also
  drops a correction of a guessed word alone, `withoutGuessCorrections`). The feedback shows
  `LineMarkedWriting` (numbered lines, per page; guessed words pink; corrections crossed out + green) and
  "Corrections to copy onto the paper" with "Line N". Older sets keep the paragraph view.
  **IELTS class sets** (26 Nov 2026): `classes.course` is 'general' or 'ielts'; an IELTS class has
  `target_band` (its `target_level` is the placeholder 'B2'). `class_sets.course` follows the class; an
  IELTS set is marked with `requestTeacherIeltsFeedback` (question = sheet task or the set's task, with
  guessed words) and saves the IeltsFeedback in `feedback` + the overall band in `class_set_pages.band`
  (`isIeltsFeedback`). Lists use `pageResult`/`targetLabel` (`class-scores.ts`): score out of 10 or band.
  The page shows `IeltsFeedbackView` with the class's target band, line by line like General English.
  **Teacher marking lists every mistake** (`everyMistakeNote`, up to `MAX_TEACHER_CORRECTIONS` = 30,
  through the whole text): teacher IELTS marking always; General English class sets send `every_mistake`.
  Students keep the short list (GE 6 + 4 punctuation, IELTS 8). Class-set pages are read with
  `SHEET_READING_EFFORT` ("medium"); guesses must be real words; a copied-out title is left out.
  **"Read and mark again"** (student page, with an "Are you sure?" step; `rereadStudent`): reads the
  student's pages and marks again with `fresh: true`, which skips the saved result (`response_cache`).
  "Mark an IELTS essay" reads photos line by line too (`useWritingDraft` `lineByLine`, request
  `line_by_line`), sends guessed words, and shows the same line view.
  **TEMPORARY testing switch** `ONE_STUDENT_AT_A_TIME` (top of `class-sets.ts`, now true): a new set
  reads and marks only the first student; "Do the next student" does one more each tap (no "Mark all").
  Set it to false when the owner has finished testing.
- **Teacher logins:** `teacher.tsx`, `src/lib/teachers.ts`, `components/teacher-only.tsx`, edge function
  `teacher-account` (username + password; login email `username@teachers.language-gym.invalid`).
  The first teacher account is made by the owner (only while there are none); then teachers add
  teachers. Table `teachers`.
- **IELTS Writing Task 2:** `ielts.tsx`, `teacher-ielts.tsx` (teacher marking, no account),
  `calibration.tsx`, `src/lib/ielts.ts`, `calibration.ts`, `components/ielts-feedback.tsx`,
  `calibration-card.tsx`. "Share results": `share-calibration-card.tsx`, `src/lib/shared-essay.ts`,
  `calibrate/[code].tsx` (the AI's full feedback + everyone's marks so far; others add theirs).
- **Writing screens share** `useWritingDraft` + `WritingBox` + `writingProblem`: change those, not
  each screen.
- **Accounts:** `account.tsx`, `src/lib/account.ts` (student code + PIN, self-enrol on IELTS).
- **Sharing:** `share-report-button.tsx`, `src/lib/share-report.ts` (text),
  `report-html.ts` + `report-pdf.ts` (PDF that looks like the screen, print).

## Database (Supabase project `pzvjttzapbzoozpxndbd`)

- Tables: sessions, participants, questions, weeks, writing_submissions, tracks, students,
  enrolments, writing_prompts, response_cache, calibration_marks, shared_essays, fun_questions (old), friending_questions, custom_question_sets, custom_questions, contact_messages,
  classes, class_students, class_sets, class_set_pages, teachers (+ storage buckets `shared-essay-photos`, `class-set-photos`). Anonymous sign-in; RLS on.
- **Schema changes:** the owner prefers that you run them yourself with the Supabase tool's
  `apply_migration` (it works; earlier its approval prompt timed out). Also write the SQL to
  `supabase/updates/<date>-<name>.sql` and append it to `supabase/schema.sql`. Only if the tool
  fails, give the owner the SQL in a code block plus
  https://supabase.com/dashboard/project/pzvjttzapbzoozpxndbd/sql/new .
- Publishable key (safe in the app): `sb_publishable_kVWg8im2CG_jzSfWeIe6gA_VZehq7HU`.

## Edge functions

- `assess-writing` (index.ts, assess.ts, ielts.ts, deno.json): feedback, IELTS marking, photo
  reading. Deploy with the Supabase tool, pasting **all four files in full**,
  `import_map_path: "deno.json"`, `verify_jwt: true`. Check locally first:
  `deno check --min-dep-age 0 index.ts`.
  Limits and settings are constants in one block at the top of index.ts (not secrets):
  students 50 feedback + 50 photo readings a day; teachers 50 markings, 100 photo readings
  (notice every 5). Several pages = one reading.
  Cache: results are saved for `CACHE_DAYS` (7) in the `response_cache` table under a SHA-256
  fingerprint of the request (prompt, model, inputs, `CACHE_VERSION`). The same writing/photo
  again returns the saved result with `cached: true`: no Claude call, no check used.
- `student-account`: save with PIN, sign in, join a course.
- `teacher-account` (index.ts, deno.json): the first teacher, and teachers adding teachers.
- The Anthropic API key is a Supabase secret (`ANTHROPIC_API_KEY`), never in the app.

## Testing

- Build: `npx expo export --platform web --output-dir <scratch>/dist`, serve it with a small
  Python SPA server on port 8098, drive it with Playwright (chromium only). Fake the function
  replies with `page.route('**/functions/v1/assess-writing', …)` to avoid spending API calls.
- Restart the local server after rebuilding (deleting `dist` breaks it).

## Checking the live site

When telling the owner a change is live, link straight to the page it is on: teacher features via
https://language-gym.gjballvn.workers.dev/dashboard (class writing: `/class-sets`), not the landing page `/`.

Route code loads in separate files, so search the entry bundle **and** the chunk files it
references for a string that only the new code has. Poll every 30 s (up to 40 min) in the
background, then tell the owner it's live.
