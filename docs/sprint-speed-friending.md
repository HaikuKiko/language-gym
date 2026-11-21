# Sprint: speed friending as its own iPhone app

Goal for this sprint: focus on **speed friending** (the live round-robin conversation sessions),
use the feedback from real sessions, and turn it into a **standalone iPhone app**, kept separate
from IELTS and General English writing.

## Start of the sprint

1. Ask the owner for the **feedback from the speed-friending sessions** and list it as changes.
2. Confirm the recommendations below. (Already decided: keep the user data.)
3. Show a mock-up before building screens.

## Ideas from the owner

- A core (sessions, rounds, timer, QR join, pairing) separate from the content (question sets,
  IELTS, General English).
- An iPhone app with a set of questions, plus **Claude generating new questions**.
- **Keep the user data** (sessions, players, generated questions). The owner said this on
  21 Nov: throwing data away or charging extra for keeping it is only an idea for the future,
  not for now.
- A **dev and a production** database, so testing never touches real data.

## Recommendations (to confirm)

1. **Same GitHub repo, separate app folder.** The owner prefers not to create a new repo.
   - Add the new app as `apps/speed-friending/` (its own Expo app and `app.json`, iOS first).
   - Leave the current web app where it is. Do **not** do a big refactor of IELTS / General
     English now: the new folder gives the separation, and the sprint stays focused.
   - Copy the session/round-robin logic it needs. Move code into a shared `packages/core` only
     when both apps really need the same code and it starts to drift.
2. **Separate database for the new app.**
   - A new Supabase project just for speed friending, so its data never mixes with IELTS students.
   - Dev vs production: either two projects (dev + prod) or one project used as dev until launch.
     Check the owner's Supabase plan for how many projects it allows before deciding.
   - Keep the data: sessions, players and the questions Claude generates are saved, not
     deleted. Ask the owner what players need (a display name only, or an account) before
     designing the tables.
3. **Claude only through a server function.** The API key must never be inside the iPhone app.
   Use a Supabase edge function like `assess-writing` (key in Supabase secrets), with a limit per
   session or device so one user can't run up the bill.
4. **Getting it onto an iPhone.** Build in the cloud with EAS (no Mac needed) and test with
   TestFlight. Publishing needs an Apple Developer Program membership. Check Expo's current docs
   (see AGENTS.md) before giving steps.

## Open questions for the owner

- Who uses the iPhone app: the teacher hosting a class, or anyone (friends, events)?
- Do players join on their own phones (as now with the QR code), or pass one phone around?
- What should generated questions be about (topic, level, age), and who chooses?
- Keep the web version of speed friending inside Language Gym as it is, or replace it later
  with the new app?
