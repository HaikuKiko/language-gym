import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

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
          // Off, because join links carry ?code=… (a join code, not a sign-in
          // code). Google sign-in comes back with #access_token=…, which
          // finishProviderSignIn reads instead.
          detectSessionInUrl: false,
          flowType: 'implicit',
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
  await finishProviderSignIn();

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

/** Sign-in providers set up in Supabase (Authentication → Sign In / Providers). */
export type SignInProvider = 'google';

/**
 * Opens the provider's sign-in page (web only). It comes back to the same page
 * with the session in the address (#access_token=…), which ensureSignedIn picks up.
 */
export async function signInWithProvider(provider: SignInProvider): Promise<void> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    throw new Error('Signing in with Google works in the web browser.');
  }
  const redirectTo = window.location.href.split('#')[0];
  const { error } = await requireSupabase().auth.signInWithOAuth({
    provider,
    options: { redirectTo, queryParams: { prompt: 'select_account' } },
  });
  if (error) throw new Error(friendlySignInError(error.message));
}

/** The message from the last provider sign-in that went wrong (read once). */
let providerSignInError: string | null = null;
export function takeProviderSignInError(): string | null {
  const message = providerSignInError;
  providerSignInError = null;
  return message;
}

function friendlySignInError(message: string): string {
  if (/provider is not enabled|unsupported provider/i.test(message)) {
    return 'Google sign-in is not switched on yet (Supabase → Authentication → Providers → Google).';
  }
  return message;
}

/**
 * The sign-in result in the address after coming back from Google, taken out
 * as soon as the app loads (before the router copies the address), so the
 * tokens never stay in the address bar or browser history.
 */
let returnedHash = takeSignInHash();

function takeSignInHash(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash.includes('access_token=') && !hash.includes('error=')) return null;
  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  return hash;
}

let finishing: Promise<void> | null = null;

/** After coming back from Google: saves the session from the address. */
function finishProviderSignIn(): Promise<void> {
  const hash = returnedHash;
  if (!hash) return finishing ?? Promise.resolve();
  returnedHash = null;
  finishing = (async () => {
    const params = new URLSearchParams(hash.slice(1));
    const error = params.get('error_description') ?? params.get('error');
    if (error) {
      providerSignInError = friendlySignInError(error);
      return;
    }
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (!access_token || !refresh_token) return;
    const { error: sessionError } = await requireSupabase().auth.setSession({ access_token, refresh_token });
    if (sessionError) providerSignInError = friendlySignInError(sessionError.message);
  })().finally(() => {
    finishing = null;
  });
  return finishing;
}
