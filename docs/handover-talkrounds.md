# Handover: TalkRounds (speed friending), 26 Nov 2026

Repo: `HaikuKiko/language-gym` (private). Live: https://language-gym.gjballvn.workers.dev/ (Cloudflare
builds `main` in 3–5 min). Read `CLAUDE.md` first: it has the working rules (open AND merge PRs
yourself, mock-up before big UI changes, run schema changes with the Supabase tool, constants at the top
of files, tell the owner when a change is live, plain short answers) and a map of every part of the app.

## What TalkRounds is

Speed-friending speaking practice. A teacher starts a session (`/host?mode=friending`), students scan a
QR code (`/join/<code>`) and type a name, pairs find each other and tap "We found each other!", then
each student gets their own prompt at the class's CEFR level; partners rotate every round (round robin,
one group of three when the number is odd). "Speed friending" is the internal name; the public name
("TalkRounds", not final) lives only in `src/constants/product.json`.

## Built and live

- Landing page at `/` (product only: no IELTS, class writing or Language Gym). Teacher dashboard moved to
  `/dashboard` behind the teacher sign-in.
- Setup: level A1–C2, 8 fun themes (480 prompts in `src/data/fun-questions.ts` and table
  `friending_questions`), **Custom** sets (★ Christmas & celebrations, ★ New Year), round length,
  Automatic/Manual, round robin, **Talking: Take turns (default) / Free conversation**.
- **Take turns** (experiment): each round split in halves; the asker's phone shows the question and
  follow-up prompts, the talker's phone says "Listen to …'s question" (owner chose: only the asker sees
  it); "🔄 Swap!" at half time. Roll back with "Free conversation", or revert the Take turns PR.
- Teacher can't accidentally join as a student (same login): blocked with a message.
- **Solo demo** `/demo`: 4 pretend students (Ana, Ben, Chen, Dara), in memory only (never saved).
  Side by side on wide screens (phones scroll on iPad landscape), tabs when narrow.
- End of session (students): "You can close this page" + "Teacher or group leader? Run this with your
  own group →" (landing page).
- Privacy: sessions/names readable only by the host and that session's students (restrictive RLS +
  `session_by_code` RPC); sessions deleted nightly after 30 days (pg_cron); `/privacy` page;
  `/contact` ("Keep me posted") → table `contact_messages`, shown on the dashboard.
- Ready for a custom domain: nothing depends on the workers.dev address; the QR code uses the address
  the teacher is on, so both addresses can run side by side.
- Portfolio: new `README.md`, `npm run fake-students -- <code> [n]` (made-up students join a real
  session and tap each round), `docs/portfolio-media.md` (16 screenshots + 60–90 s recording script).

## Waiting for the owner

1. **Portfolio repo:** recommended publishing a **fresh copy** (one commit, GitHub noreply author)
   rather than this repo, because one old commit message (and probably a PR description) names three
   real students, and two personal email addresses are commit authors. No secrets were ever committed;
   no keys need rotating (the publishable Supabase key is public by design). Asked: prepare the fresh
   copy? Leave out CLAUDE.md / BACKLOG.md / docs/sprint-speed-friending.md?
2. Remove the unused Expo template images and `scripts/reset-project.js`? (Ask before deleting.)
3. Product name and domain (then change `product.json`; remember new domains get blocked by school
   firewalls for a few weeks, so keep workers.dev working).
4. The landing video: send the link, set `LANDING_VIDEO_URL` in `src/constants/product.ts` (.mp4 or a
   YouTube/Vimeo embed link).
5. Feedback from class on Take turns, the questions and the custom sets.

## Ideas agreed for later

- Teachers create their own custom question sets in the app (now: owner asks Claude, Claude writes the
  questions and inserts them with SQL; same questions at every level).
- Other languages (Spanish first, then French, Italian), with the question language separate from the
  screen language.
- Optional privacy follow-ups: clean up old anonymous guest IDs (they hold nothing personal); session
  codes are 6 digits, so someone who guesses a live code can find that session.
- Host accounts (hosting is anonymous on purpose: it is the main selling point).
- Native iOS/Android apps only for hosts; students stay in the browser.

## Separate thread

Class writing (scans, line-by-line marking, IELTS class sets) is worked on in its own thread. Note in
`CLAUDE.md`: the TEMPORARY switch `ONE_STUDENT_AT_A_TIME` in `src/lib/class-sets.ts` is on for testing.
