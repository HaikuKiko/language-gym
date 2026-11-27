import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

/**
 * Guest sign-ins are limited per internet address, so when a whole hall of
 * phones on the school wifi joins at once, some may be asked to wait. Those
 * phones try again by themselves for up to this long before showing an error.
 */
const SIGN_IN_RETRY_FOR_MS = 90_000;
/** First wait before trying again; it doubles each time, up to SIGN_IN_RETRY_MAX_GAP_MS. */
const SIGN_IN_RETRY_FIRST_GAP_MS = 2_000;
const SIGN_IN_RETRY_MAX_GAP_MS = 15_000;

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

/** Null until the Supabase URL and key have been added to the `.env` file. */
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: AsyncStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null;

export const NOT_CONFIGURED_MESSAGE =
  'Phone sessions are not set up yet: add your Supabase URL and key to the .env file, then restart the app.';

export function requireSupabase() {
  if (!supabase) throw new Error(NOT_CONFIGURED_MESSAGE);
  return supabase;
}

/**
 * Makes sure this device has a guest identity and returns its user ID. The
 * identity is remembered on the device, so reopening the app keeps you in
 * your session.
 */
export async function ensureSignedIn(): Promise<string> {
  const client = requireSupabase();

  const { data: existing } = await client.auth.getSession();
  if (existing.session) return existing.session.user.id;

  const giveUpAt = Date.now() + SIGN_IN_RETRY_FOR_MS;
  let gap = SIGN_IN_RETRY_FIRST_GAP_MS;
  let { data, error } = await client.auth.signInAnonymously();
  // "Too many sign-ins from this address": wait a little (plus a random bit,
  // so the phones don't all try again at the same moment) and try again.
  while (error?.status === 429 && Date.now() + gap < giveUpAt) {
    await new Promise((resolve) => setTimeout(resolve, gap + Math.random() * 1000));
    gap = Math.min(gap * 2, SIGN_IN_RETRY_MAX_GAP_MS);
    ({ data, error } = await client.auth.signInAnonymously());
  }
  if (error?.status === 429) throw new Error('Lots of people are joining at once. Please wait a minute and try again.');
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Could not sign in as a guest.');
  return data.user.id;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
