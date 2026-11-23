# Backlog

Things agreed for later. Newest first.

(Done: calibration table created 23 Nov; one question per round for the whole class; round robin button; bigger partner and question on phones; full grammar on the teacher's screen.)

## IELTS writing

- **Share a marked essay with another teacher (asked 23 Nov).** After "Mark an
  IELTS essay", a "Share for calibration" button makes a link. Another teacher
  opens it, sees the question, the essay and the photo of the page (not the
  AI's bands, so they are not influenced), puts in their own bands, and only
  then sees the AI's. Their marks go into `calibration_marks` like the owner's.
  Needs: a table for shared essays (a short random code in the link, the
  question, essay, AI bands), a place to keep the photo (Supabase Storage),
  and a new screen. Results are already cached, so opening the link costs
  nothing.

- **One question for the whole class.** Every student should be on the same
  Task 2 question. Today several questions can be ticked as `assigned` and
  students pick between them; change it so only one is active at a time
  (ticking a new one unticks the old one), and remove the choice from the
  student screen.
- **Teacher screen with the question and the grammar.** The teacher sees the
  class's current question together with the grammar to discuss, so they can
  talk it through with the students. (To decide: is the grammar a point the
  teacher picks for each question, or the common mistakes from the class's
  essays, or both?)
- **Calibration check.** Mark a set of essays yourself and compare with the
  app (`supabase/calibration/`, needs an Anthropic API key on the PC).

## Accounts

- **Email sign-in.** Switch `EMAIL_SIGN_IN` back on in `src/lib/account.ts`
  once an email sender (SMTP) is set up in Supabase.
- **PIN reset** for students who forget their PIN.
- **Teacher enrolment.** Students join IELTS themselves for now; the teacher
  may want to control this later.
- Remove the test accounts with "(Claude)" in the name.

## Listening

- **YouTube Shorts listening test.** Fetch the subtitles from a PC (YouTube
  blocks cloud servers), then rewrite the questions from what is actually said.
