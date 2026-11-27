#!/usr/bin/env node
/**
 * Load test: many pretend phones join one live session and play through it,
 * doing what the real app does (same sign-in, same live updates, same
 * re-reading every 5 seconds). It prints how long things took and any errors.
 *
 *   npm run load-test -- 50          (50 phones)
 *   npm run load-test -- 100 burst   (100 phones, all scanning the QR at once)
 *
 * It makes a throwaway session (level "B1", name "LT-…" pretend students) and
 * at the end prints the SQL that deletes it and the pretend guest logins.
 * Guest logins are saved in LOGINS_FILE so a second run reuses them instead
 * of signing in again (Supabase limits new guest sign-ins per internet
 * address). Reads EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY.
 *
 *   node scripts/load-test.mjs --make-logins 30   (only sign in 30 guests)
 *
 * Clean up afterwards: supabase/load-test-cleanup.sql.
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

// ===========================================================================
// Settings
// ===========================================================================

/** Pretend phones when no number is given. */
const DEFAULT_PHONES = 50;
/** Students scan the QR code over this long (0 with "burst"). */
const JOIN_SPREAD_MS = 30_000;
/** Speed-friending rounds to play. */
const ROUNDS = 3;
/** After a round starts, a student taps "We found each other!" between these times. */
const TAP_MIN_MS = 2_000;
const TAP_MAX_MS = 10_000;
/** How long the talking lasts in the test (the real app uses whole minutes). */
const TALK_MS = 8_000;
/** Word-game part: each student taps "Got it" this many times, spread over WORD_GAME_MS. */
const WORD_GAME_TAPS = 3;
const WORD_GAME_MS = 30_000;
/** Same as REFRESH_INTERVAL_MS in src/hooks/use-live-session.ts. */
const REFRESH_INTERVAL_MS = 5_000;
/** Same as LIVE_STUDENT_UPDATES_UP_TO, BIG_GROUP_REFRESH_MS and STUDENT_LIVE_DELAY_MS there. */
const LIVE_STUDENT_UPDATES_UP_TO = 20;
const BIG_GROUP_REFRESH_MS = 2_000;
const STUDENT_LIVE_DELAY_MS = 5_000;
/** Same as SIGN_IN_RETRY_FOR_MS in src/lib/supabase.ts. */
const SIGN_IN_RETRY_FOR_MS = 90_000;
/** Saved guest logins, so reruns don't sign in again. */
const LOGINS_FILE = process.env.LOGINS_FILE ?? 'load-test-logins.json';

// ===========================================================================

const phones = Number(process.argv[2]) || DEFAULT_PHONES;
const burst = process.argv.includes('burst');
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;
if (!url || !key) {
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY.');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s]`, ...a);

// --- Measurements ----------------------------------------------------------
const rest = { count: 0, errors: 0, statuses: {}, ms: [] };
const realtime = { statuses: {}, systemErrors: [] };
const errors = [];

function countingFetch(input, init) {
  const start = Date.now();
  rest.count++;
  return fetch(input, init).then(
    (res) => {
      rest.ms.push(Date.now() - start);
      if (!res.ok) {
        rest.errors++;
        rest.statuses[res.status] = (rest.statuses[res.status] ?? 0) + 1;
      }
      return res;
    },
    (err) => {
      rest.errors++;
      rest.statuses.network = (rest.statuses.network ?? 0) + 1;
      throw err;
    },
  );
}

function pct(list, p) {
  if (!list.length) return '-';
  const s = [...list].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}
const summary = (list) => `median ${pct(list, 50)} ms, 95% within ${pct(list, 95)} ms, slowest ${pct(list, 100)} ms`;

function newClient() {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: countingFetch },
    realtime: { params: { eventsPerSecond: 10 } },
  });
}

// --- Guest logins ----------------------------------------------------------
const saved = existsSync(LOGINS_FILE) ? JSON.parse(readFileSync(LOGINS_FILE, 'utf8')) : [];
const signIn = { ok: 0, reused: 0, limited: 0, failed: 0, waited: 0 };

async function login(index) {
  const client = newClient();
  const old = saved[index];
  if (old) {
    const { data, error } = await client.auth.setSession(old);
    if (!error && data.session) {
      saved[index] = { access_token: data.session.access_token, refresh_token: data.session.refresh_token, user_id: data.user.id };
      signIn.reused++;
      return { client, userId: data.user.id };
    }
  }
  // Marked, so the clean-up SQL can find (only) these pretend guests.
  // Like the app (ensureSignedIn): on "too many sign-ins", wait and try again.
  const giveUpAt = Date.now() + SIGN_IN_RETRY_FOR_MS;
  let gap = 2_000;
  let { data, error } = await client.auth.signInAnonymously({ options: { data: { load_test: true } } });
  while (error?.status === 429 && Date.now() + gap < giveUpAt) {
    signIn.waited++;
    await sleep(gap + Math.random() * 1000);
    gap = Math.min(gap * 2, 15_000);
    ({ data, error } = await client.auth.signInAnonymously({ options: { data: { load_test: true } } }));
  }
  if (error) {
    if (error.status === 429) signIn.limited++;
    else signIn.failed++;
    errors.push(`sign-in ${index}: ${error.status} ${error.message}`);
    return null;
  }
  signIn.ok++;
  saved[index] = { access_token: data.session.access_token, refresh_token: data.session.refresh_token, user_id: data.user.id };
  return { client, userId: data.user.id };
}

// --- One pretend phone -----------------------------------------------------
/** sessionVersion -> host write time; filled in by the host. */
const hostWrites = new Map();
const sessionLatency = []; // host change -> student sees it (live update)
const sessionMissed = { live: 0, pollOnly: 0 };
const tapLatency = []; // student tap -> host sees it (live update)
const joinMs = [];

function connectLive(name, client, sessionId, onSession, onParticipants) {
  let channel = client.channel(`${onSession ? "session" : "session-students"}-${sessionId}`);
  if (onSession)
    channel = channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` }, (p) =>
      onSession(p.new),
    );
  if (onParticipants)
    channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `session_id=eq.${sessionId}` }, (p) =>
      onParticipants(p),
    );
  channel = channel.subscribe((status, err) => {
      realtime.statuses[status] = (realtime.statuses[status] ?? 0) + 1;
      if (err) realtime.systemErrors.push(`${name}: ${err.message ?? err}`);
    });
  return channel;
}

async function student(index, code, login) {
  const { client, userId } = login;
  const name = `LT-${String(index + 1).padStart(3, '0')}`;
  const start = Date.now();
  // Same steps as joinSession + useLiveSession.
  const { data: rows, error: findError } = await client.rpc('session_by_code', { p_code: code });
  if (findError || !rows?.[0]) throw new Error(`${name}: could not find session (${findError?.message})`);
  const session = rows[0];
  const { data: me, error: joinError } = await client
    .from('participants')
    .upsert({ session_id: session.id, user_id: userId, name }, { onConflict: 'session_id,user_id' })
    .select()
    .single();
  if (joinError) throw new Error(`${name}: could not join (${joinError.message})`);
  await client.from('participants').select().eq('session_id', session.id).order('joined_at').order('id');
  joinMs.push(Date.now() - start);

  let current = session;
  const seenLive = new Set();
  const seenAny = new Set();
  let tappedRound = -1;
  let wordTaps = 0;
  let done = false;

  const version = (s) => `${s.status}/${s.round}/${s.stage}/${s.categories.length}`;
  const react = (s, live) => {
    const v = version(s);
    if (live && !seenLive.has(v)) {
      seenLive.add(v);
      const wrote = hostWrites.get(v);
      if (wrote) sessionLatency.push(Date.now() - wrote);
    }
    if (seenAny.has(v)) return;
    seenAny.add(v);
    current = s;
    if (s.status === 'finished') done = true;
    // Speed friending: tap "We found each other!" once per round.
    if (s.status === 'playing' && s.stage === 'changeover' && tappedRound !== s.round && !s.categories.includes('word-game:hot-seat')) {
      tappedRound = s.round;
      const round = s.round;
      setTimeout(async () => {
        const { error } = await client.from('participants').update({ found_round: round }).eq('id', me.id);
        if (error) errors.push(`${name} tap: ${error.message}`);
        else tapTimes.set(`${me.id}/${round}`, Date.now());
      }, TAP_MIN_MS + Math.random() * (TAP_MAX_MS - TAP_MIN_MS));
    }
    // Word game: a few "Got it" taps, saved on the student's own row.
    if (s.categories.includes('word-game:hot-seat') && s.status === 'playing' && wordTaps === 0) {
      for (let i = 0; i < WORD_GAME_TAPS; i++) {
        setTimeout(async () => {
          wordTaps++;
          const cards = Array.from({ length: wordTaps }, (_, k) => index * 10 + k);
          const { error } = await client.from('participants').update({ got_cards: cards }).eq('id', me.id);
          if (error) errors.push(`${name} got-it: ${error.message}`);
          // Like finishCard in word-game.ts: every word is also logged.
          const { error: logError } = await client
            .from('session_events')
            .insert({ session_id: session.id, participant_id: me.id, kind: 'card_done', data: { load_test: true } });
          if (logError) errors.push(`${name} event: ${logError.message}`);
        }, Math.random() * WORD_GAME_MS);
      }
      wordTaps = 0.5; // started
    }
  };

  // Like the app (use-live-session.ts): a student change makes the phone
  // re-read the list; in a big group the phone stops listening for those and
  // re-reads every BIG_GROUP_REFRESH_MS instead.
  let bigGroup = false;
  let studentChannel = null;
  const reloadParticipants = async () => {
    const { data } = await client.from('participants').select().eq('session_id', session.id).order('joined_at').order('id');
    if (!bigGroup && (data?.length ?? 0) > LIVE_STUDENT_UPDATES_UP_TO) {
      bigGroup = true;
      if (studentChannel) client.removeChannel(studentChannel);
      studentChannel = null;
    }
  };
  const channel = connectLive(name, client, session.id, (s) => react(s, true), null);
  // Like the app: wait STUDENT_LIVE_DELAY_MS, then listen only if the group is small.
  const listenLater = setTimeout(async () => {
    await reloadParticipants();
    if (!bigGroup && !done) studentChannel = connectLive(name, client, session.id, null, reloadParticipants);
  }, STUDENT_LIVE_DELAY_MS);
  await reloadParticipants();
  let lastStudents = Date.now();
  let lastSession = Date.now();
  const poll = setInterval(async () => {
    const now = Date.now();
    if (now - lastStudents >= (bigGroup ? BIG_GROUP_REFRESH_MS : REFRESH_INTERVAL_MS)) {
      lastStudents = now;
      reloadParticipants();
    }
    if (now - lastSession < REFRESH_INTERVAL_MS) return;
    lastSession = now;
    const { data } = await client.rpc('session_by_code', { p_code: code });
    if (data?.[0]) react(data[0], false);
  }, 500);

  while (!done) await sleep(500);
  for (const v of hostWrites.keys()) {
    if (seenLive.has(v)) sessionMissed.live++;
    else if (seenAny.has(v)) sessionMissed.pollOnly++;
  }
  clearInterval(poll);
  clearTimeout(listenLater);
  await client.removeChannel(channel);
  if (studentChannel) await client.removeChannel(studentChannel);
}
const tapTimes = new Map();

// --- Only making guest logins (e.g. from several machines) ------------------
async function makeLogins(count, file) {
  const start = saved.length;
  for (let i = 0; i < count; i++) await login(start + i);
  writeFileSync(file, JSON.stringify(saved.filter(Boolean), null, 1));
  log(`Guest sign-ins: ${signIn.ok} new, ${signIn.limited} refused by the rate limit, ${signIn.failed} other failures.`);
  if (errors.length) console.log(errors.slice(0, 5));
  process.exit(0);
}

// --- The host --------------------------------------------------------------
async function main() {
  if (process.argv[2] === '--make-logins') return makeLogins(Number(process.argv[3]) || 30, LOGINS_FILE);
  log(`Load test: ${phones} phones${burst ? ', all joining at once' : `, joining over ${JOIN_SPREAD_MS / 1000} s`}.`);

  const hostLogin = await login(0);
  if (!hostLogin) throw new Error('The host could not sign in: ' + errors.join('; '));
  const host = hostLogin.client;

  log('Signing in pretend phones…');
  const logins = [];
  for (let i = 1; i <= phones; i++) logins.push(await login(i));
  writeFileSync(LOGINS_FILE, JSON.stringify(saved, null, 1));
  const ready = logins.filter(Boolean);
  log(`Guest sign-ins: ${signIn.ok} new, ${signIn.reused} reused, ${signIn.limited} refused by the rate limit, ${signIn.failed} other failures (${signIn.waited} waits).`);
  if (ready.length === 0) throw new Error('No phones could sign in.');

  const code = String(100000 + Math.floor(Math.random() * 900000));
  const { data: session, error } = await host
    .from('sessions')
    .insert({
      code,
      level: 'B1',
      categories: ['speed-friending', 'take-turns', 'load-test'],
      round_minutes: 1,
      round_count: ROUNDS,
      auto_advance: true,
      seed: 1,
    })
    .select()
    .single();
  if (error) throw new Error('Could not create the session: ' + error.message);
  log(`Session ${code} (${session.id}) created.`);

  // The host screen: live updates + re-reading participants every 5 s.
  let participants = [];
  const reload = async () => {
    const { data } = await host.from('participants').select().eq('session_id', session.id).order('joined_at').order('id');
    if (data) participants = data;
  };
  const hostChannel = connectLive('host', host, session.id, () => {}, (p) => {
    const row = p.new;
    const tapped = row?.found_round != null ? tapTimes.get(`${row.id}/${row.found_round}`) : undefined;
    if (tapped && !tapLatency.seen?.has(`${row.id}/${row.found_round}`)) {
      tapLatency.seen = tapLatency.seen ?? new Set();
      tapLatency.seen.add(`${row.id}/${row.found_round}`);
      tapLatency.push(Date.now() - tapped);
    }
    reload();
  });
  const hostPoll = setInterval(reload, REFRESH_INTERVAL_MS);
  await sleep(1500);

  // Students scan the QR code.
  const students = ready.map(
    (l, i) =>
      new Promise((resolve) => {
        setTimeout(() => {
          student(i, code, l).then(resolve, (e) => {
            errors.push(e.message);
            resolve();
          });
        }, burst ? 0 : Math.random() * JOIN_SPREAD_MS);
      }),
  );

  const until = async (check, label, maxMs = 120_000) => {
    const start = Date.now();
    while (!check()) {
      if (Date.now() - start > maxMs) {
        log(`Gave up waiting: ${label}`);
        return false;
      }
      await sleep(250);
    }
    return true;
  };

  let s = session;
  const save = async (changes) => {
    const next = { ...s, ...changes };
    hostWrites.set(`${next.status}/${next.round}/${next.stage}/${next.categories.length}`, Date.now());
    const { data, error: e } = await host.from('sessions').update(changes).eq('id', s.id).select().single();
    if (e) errors.push('host save: ' + e.message);
    else s = data;
  };

  const joinStart = Date.now();
  await until(() => participants.length >= ready.length, 'everyone to join', JOIN_SPREAD_MS + 60_000);
  log(`Host sees ${participants.length} of ${ready.length} students (${((Date.now() - joinStart) / 1000).toFixed(1)} s).`);

  for (let round = 0; round < ROUNDS; round++) {
    await reload();
    await save({
      status: 'playing',
      round,
      stage: 'changeover',
      roster: participants.map((p) => ({ id: p.id, name: p.name })),
      found_ids: [],
      ends_at: null,
      remaining_ms: null,
    });
    log(`Round ${round + 1}: finding partners…`);
    const roundStart = Date.now();
    await until(() => participants.filter((p) => p.found_round === round).length >= participants.length, `round ${round + 1} taps`);
    log(`Round ${round + 1}: host saw every tap after ${((Date.now() - roundStart) / 1000).toFixed(1)} s. Talking…`);
    await save({ stage: 'discussion', ends_at: new Date(Date.now() + TALK_MS).toISOString() });
    await sleep(TALK_MS);
  }

  // A word game in the same session (Hot Seat: "Got it" taps on own rows).
  log('Word game: everyone taps "Got it" a few times…');
  await save({ categories: [...s.categories, 'word-game:hot-seat'], round: 0, stage: 'discussion', ends_at: new Date(Date.now() + WORD_GAME_MS).toISOString() });
  await sleep(WORD_GAME_MS + 6_000);
  await reload();
  const wordTapsSaved = participants.reduce((n, p) => n + (p.got_cards?.length ?? 0), 0);
  log(`Word game: ${wordTapsSaved} of ${ready.length * WORD_GAME_TAPS} "Got it" taps saved.`);

  await save({ status: 'finished', ends_at: null, remaining_ms: 0 });
  await Promise.race([Promise.all(students), sleep(30_000)]);
  clearInterval(hostPoll);
  await host.removeChannel(hostChannel);

  // --- Report ---
  const changes = hostWrites.size;
  console.log('\n================ RESULTS ================');
  console.log(`Phones: ${ready.length} signed in of ${phones} wanted; joined: ${joinMs.length}.`);
  console.log(`Joining (find + join + first list): ${summary(joinMs)}`);
  console.log(`Live updates: ${JSON.stringify(realtime.statuses)}`);
  if (realtime.systemErrors.length) console.log(`Live update errors (${realtime.systemErrors.length}):`, realtime.systemErrors.slice(0, 5));
  console.log(`Host changes (${changes}) reaching students live: ${summary(sessionLatency)}`);
  console.log(`  ${sessionMissed.live} arrived live, ${sessionMissed.pollOnly} only via the 5-second re-read.`);
  console.log(`Student taps reaching the host live: ${summary(tapLatency)} (${tapLatency.length} seen live)`);
  console.log(`Database requests: ${rest.count}, errors ${rest.errors} ${JSON.stringify(rest.statuses)}; ${summary(rest.ms)}`);
  console.log(`Test length: ${((Date.now() - t0) / 1000).toFixed(0)} s, about ${(rest.count / ((Date.now() - t0) / 1000)).toFixed(0)} requests/s.`);
  if (errors.length) console.log(`Errors (${errors.length}):`, errors.slice(0, 10));
  console.log(`\nSession ${session.id}. Clean up with supabase/load-test-cleanup.sql.`);
  writeFileSync(LOGINS_FILE, JSON.stringify(saved, null, 1));
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
