#!/usr/bin/env node
/**
 * Fake students for demos and screen recordings: they join a live session
 * with made-up names and tap "We found each other!" every round, so one
 * teacher device plus one real phone is enough to show a whole session.
 * No real student data is used.
 *
 *   npm run fake-students -- 123456        (3 fake students)
 *   npm run fake-students -- 123456 5      (5 fake students)
 *
 * Start the session on the teacher device first, run this, then press
 * "Start session". Stop with Ctrl+C. Reads EXPO_PUBLIC_SUPABASE_URL and
 * EXPO_PUBLIC_SUPABASE_KEY from .env (or .env.production).
 */
import { createClient } from '@supabase/supabase-js';

// ===========================================================================
// Settings
// ===========================================================================

/** Made-up names, used in this order. */
const FAKE_NAMES = ['Alex', 'Bea', 'Carlos', 'Dee', 'Emre', 'Fatima', 'Gio', 'Hana', 'Ivo', 'Jun'];
/** Fake students used when no number is given. */
const DEFAULT_COUNT = 3;
/** How often each fake student looks at the session. */
const CHECK_EVERY_MS = 2000;
/** A fake student taps "We found each other!" between these times after a round starts. */
const TAP_MIN_MS = 2000;
const TAP_MAX_MS = 6000;

// ===========================================================================

const [code, countArg] = process.argv.slice(2);
const count = Math.min(FAKE_NAMES.length, Number(countArg) || DEFAULT_COUNT);
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!/^\d{6}$/.test(code ?? '')) {
  console.error('Usage: npm run fake-students -- <6-digit session code> [number of students]');
  process.exit(1);
}
if (!url || !key) {
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY (see .env.example).');
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fakeStudent(name) {
  // Each fake student is its own anonymous guest, like a real phone.
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: true } });
  const { data: auth, error: authError } = await client.auth.signInAnonymously();
  if (authError) throw new Error(`${name}: could not sign in (${authError.message}). Are anonymous sign-ins on?`);
  const userId = auth.user.id;

  const findSession = async () => {
    const { data, error } = await client.rpc('session_by_code', { p_code: code });
    if (error) throw new Error(`${name}: ${error.message}`);
    return data?.[0] ?? null;
  };

  const session = await findSession();
  if (!session) throw new Error(`No session with code ${code}.`);
  if (session.status !== 'lobby') console.warn(`${name}: the session has already started; joining for the next round.`);

  const { data: me, error: joinError } = await client
    .from('participants')
    .upsert({ session_id: session.id, user_id: userId, name }, { onConflict: 'session_id,user_id' })
    .select()
    .single();
  if (joinError) throw new Error(`${name}: could not join (${joinError.message}).`);
  console.log(`${name} joined.`);

  let tappedRound = -1;
  for (;;) {
    await sleep(CHECK_EVERY_MS);
    const current = await findSession().catch(() => null);
    if (!current) continue;
    if (current.status === 'finished') {
      console.log(`${name}: session finished.`);
      return;
    }
    const inRound = (current.roster ?? []).some((p) => p.id === me.id);
    if (current.status === 'playing' && current.stage === 'changeover' && inRound && tappedRound !== current.round) {
      tappedRound = current.round;
      const round = current.round;
      setTimeout(async () => {
        await client.from('participants').update({ found_round: round }).eq('id', me.id);
        console.log(`${name}: "We found each other!" (round ${round + 1})`);
      }, TAP_MIN_MS + Math.random() * (TAP_MAX_MS - TAP_MIN_MS));
    }
  }
}

console.log(`Adding ${count} fake students to session ${code}…`);
const results = await Promise.allSettled(FAKE_NAMES.slice(0, count).map(fakeStudent));
for (const r of results) if (r.status === 'rejected') console.error(r.reason.message);
