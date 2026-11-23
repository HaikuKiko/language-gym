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

- **Core / speed friending (live sessions):** `host.tsx`, `session/[code].tsx`, `single.tsx`,
  `src/lib/live-session.ts`, `round-robin.ts`, `session.ts`, `src/hooks/use-questions.tsx`,
  components `round-settings-form`, `join-qr-code`, `grammar-card`, `live-timer`.
  Questions table: 1,488 rows (levels × themes, 15 each); defaults: Automatic, 2 minutes, round robin.
- **General English writing:** `write.tsx`, `src/lib/writing.ts` (also photo reading).
- **IELTS Writing Task 2:** `ielts.tsx`, `teacher-ielts.tsx` (teacher marking, no account),
  `calibration.tsx`, `src/lib/ielts.ts`, `calibration.ts`, `components/ielts-feedback.tsx`,
  `calibration-card.tsx`. Sharing an essay for calibration: `share-calibration-card.tsx`,
  `src/lib/shared-essay.ts`, `calibrate/[code].tsx` (other teachers mark blind, then compare).
- **Writing screens share** `useWritingDraft` + `WritingBox` + `writingProblem`: change those, not
  each screen.
- **Accounts:** `account.tsx`, `src/lib/account.ts` (student code + PIN, self-enrol on IELTS).
- **Sharing:** `share-report-button.tsx`, `src/lib/share-report.ts` (text),
  `report-html.ts` + `report-pdf.ts` (PDF that looks like the screen, print).

## Database (Supabase project `pzvjttzapbzoozpxndbd`)

- Tables: sessions, participants, questions, weeks, writing_submissions, tracks, students,
  enrolments, writing_prompts, response_cache, calibration_marks, shared_essays
  (+ storage bucket `shared-essay-photos`). Anonymous sign-in; RLS on.
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
- The Anthropic API key is a Supabase secret (`ANTHROPIC_API_KEY`), never in the app.

## Testing

- Build: `npx expo export --platform web --output-dir <scratch>/dist`, serve it with a small
  Python SPA server on port 8098, drive it with Playwright (chromium only). Fake the function
  replies with `page.route('**/functions/v1/assess-writing', …)` to avoid spending API calls.
- Restart the local server after rebuilding (deleting `dist` breaks it).

## Checking the live site

Route code loads in separate files, so search the entry bundle **and** the chunk files it
references for a string that only the new code has. Poll every 30 s (up to 40 min) in the
background, then tell the owner it's live.
