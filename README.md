# TalkRounds

**Speed-friending speaking practice for language classes: students pair up on their own phones, partners
rotate every round, and each student gets conversation prompts at their CEFR level.**

The teacher runs a session from a phone, tablet or laptop; students join by scanning a QR code in the
browser (no app, no account) and their pairings, prompts and timer update live.

> The repository is called `language-gym` because it also holds a teacher's writing tools (see
> [Also in this repo](#also-in-this-repo)). TalkRounds is the part presented here. "TalkRounds" is a
> working name, kept in one setting (`src/constants/product.json`).

## What it does

1. **The teacher starts a session** and chooses the level (A1–C2), a theme, the round length and
   whether students take turns. A join code and QR code appear.
2. **Students scan the code** and type their name. The teacher sees them arrive.
3. **Each round**, every phone shows only the partner's name ("Find Dara"). When a pair meets, one of
   them taps **"We found each other!"**. The teacher's screen shows which pairs are still looking.
4. **When every pair has checked in**, the questions and the timer appear. With *Take turns*, one
   student asks (their phone shows the question and follow-up prompts like "Why?" and "What happened
   next?") while the other talks; at half time the phones say **Swap!**
5. **When time is up**, partners rotate (round robin: everyone talks to everyone once; with an odd
   number, one group of three) until the session ends.

## Stack

- **React Native + Expo (SDK 58), Expo Router**, TypeScript (strict), running on the web through
  react-native-web.
- **Supabase**: Postgres with row-level security, anonymous sign-in, **Realtime** (live updates to
  every phone), RPC functions, pg_cron, Edge Functions (Deno).
- **Cloudflare Workers** for hosting the static web build.

## Features

- Live sessions on phones with a 6-digit join code and QR code; no student accounts.
- Round-robin pairing that handles odd class sizes (one group of three per round).
- "Find your partner" check-in: the next round starts by itself when every pair has tapped; the
  teacher can mark a pair as found or start anyway.
- **Take turns** mode: one student asks, one talks, then they swap, with follow-up prompts.
- Every student gets their own question each round (seeded shuffle, so all phones agree without
  extra network traffic). 480 built-in prompts: 6 levels (A1–C2) × 8 themes × 10.
- Custom question sets (for example a Christmas set), the same at every level.
- **Solo demo** (`/demo`): a full session with four pretend students, run entirely in memory, so
  nothing is saved. Useful for trying it without a class.
- Automatic or manual timer, pause and reset.
- A one-screen mode for classes without phones.
- Privacy: session data is readable only by the host and the students in that session (row-level
  security), and sessions (with the names in them) are deleted automatically after 30 days. Plain
  English privacy page at `/privacy`.

## Run it locally

You need Node 22 and a free [Supabase](https://supabase.com) project.

```bash
npm install
cp .env.example .env    # then fill in the two values (see below)
npx expo start --web
```

Set up the Supabase project once:

1. Create a project at supabase.com.
2. **SQL Editor**: paste in all of `supabase/schema.sql` and run it.
3. **Authentication → Sign In / Providers**: turn on **Allow anonymous sign-ins**.
4. Copy the project URL and the **publishable** key (Project Settings → API Keys) into `.env`.

`.env.example`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=your-publishable-key
# Optional: the public address used in the join link and QR code
# EXPO_PUBLIC_APP_URL=https://your-site.example.com
```

Both values are public by design: they ship inside the web app, and the database rules protect the
data. Never put a `service_role`/secret key in the app. (The writing tools also need an Anthropic API
key, stored only as a Supabase Edge Function secret, never in this repo. TalkRounds doesn't use it.)

Without a Supabase project, the solo demo (`/demo`) and the one-screen mode still work.

### Fake students for demos and recordings

```bash
npm run fake-students -- 123456      # 3 made-up students join session 123456
npm run fake-students -- 123456 5    # 5 of them
```

Start a session on the teacher device, run the command, then press **Start session**. The fake
students (Alex, Bea, Carlos…) join and tap "We found each other!" every round, so one teacher device
plus one real phone is enough to show a whole session. No real student data is used.

## Publishing the web version (Cloudflare)

The site is published on Cloudflare Workers, which rebuilds it on every push to `main` (settings in
`wrangler.jsonc`). One-time setup: **Workers & Pages → Create → Import a repository**, keep the default
deploy command (`npx wrangler deploy`). The Supabase URL and publishable key for the published site are
in `.env.production` (public by design). To publish from your own computer: `npm run deploy`.

## Where things are

- `src/app/index.tsx`: landing page · `host.tsx`: session setup · `join/[code].tsx`: joining ·
  `session/[code].tsx`: the live session · `demo.tsx`: solo demo.
- `src/screens/live-host-screen.tsx`, `live-student-screen.tsx`: what the teacher and students see.
- `src/lib/live-session.ts`: session state and steps · `round-robin.ts`: pairing ·
  `session-backend.tsx`: Supabase vs the in-memory demo.
- `src/data/fun-questions.ts`: the built-in prompts.
- `supabase/schema.sql`: tables, row-level security and functions (`supabase/updates/` holds each
  change on its own).

## Status and roadmap

**Status: working prototype.** It is being tried out in real classes and runs as a web app.

Built: everything listed under Features.

Not built yet:

- Native iOS/Android builds (it is an Expo project, but only the web version is published).
- Host accounts: hosting is anonymous on purpose, so a teacher can't yet see past sessions on
  another device.
- Teachers creating their own custom question sets in the app (sets are added in the database for
  now).
- Other languages: prompts and screens are English only (Spanish, French and Italian are planned,
  with the question language separate from the screen language).
- A final product name and domain.
- Automated tests for the session flow: it is tested by hand and with scripted browser runs.
  The repo's unit tests cover only the writing tools' scoring.

## Also in this repo

The same codebase holds Language Gym, a teacher's writing tools: AI feedback on students' writing
(including photos of handwriting), IELTS Writing Task 2 marking, and marking a whole class's scanned
work. These are separate screens behind a teacher sign-in and aren't part of TalkRounds.
