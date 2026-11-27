/**
 * Saved accounts. Everyone starts as a guest (an anonymous Supabase user on
 * this device). Saving the account adds an email to that same user, checked
 * with a 6-digit code, so nothing done as a guest is lost. A saved student
 * can then sign in on any device with a new code, and gets a student record
 * with a short code the teacher uses to enrol them on IELTS or B2 First.
 *
 * Supabase setup this needs (dashboard): Authentication -> Sign In / Providers
 * -> "Allow manual linking" on; and the "Change email address" and "Magic
 * link" email templates must include {{ .Token }} (the 6-digit code).
 */
import { FunctionsHttpError } from '@supabase/supabase-js';

import { ensureSignedIn, requireSupabase } from '@/core/app/supabase';

export type Student = { id: string; displayName: string; studentCode: string };
export type Enrolment = { trackId: string; trackName: string; target: string | null };
/** A course other than General English, open to join or coming soon. */
export type Course = { id: string; name: string; active: boolean };

export type Account = {
  userId: string;
  /** True for a guest: their work stays on this device only. */
  isGuest: boolean;
  email: string | null;
  /** Null for guests, and for saved accounts that have not given a name yet. */
  student: Student | null;
  enrolments: Enrolment[];
  /** IELTS, B2 First and any later courses (General English is open to all). */
  courses: Course[];
};

export const CODE_LENGTH = 6;

/**
 * Off while the app is a prototype: email codes need an email sender (SMTP)
 * set up in Supabase. Until then students save their account with a name
 * and a 4-digit PIN, and sign in with their student code and PIN. Turn this
 * on (and do the Supabase setup above) to use email codes again.
 */
export const EMAIL_SIGN_IN = false;

export const PIN_LENGTH = 4;
export const STUDENT_CODE_LENGTH = 6;

/** Must match the student-account edge function. */
const PIN_LOGIN_DOMAIN = '@students.language-gym.invalid';
function loginEmail(studentCode: string): string {
  return `${studentCode.trim().toLowerCase()}${PIN_LOGIN_DOMAIN}`;
}
function pinPassword(studentCode: string, pin: string): string {
  return `lg-${studentCode.trim().toUpperCase()}-${pin.trim()}`;
}

/** True for accounts saved with a code and PIN rather than a real email. */
export function usesPin(email: string | null): boolean {
  return !!email && email.endsWith(PIN_LOGIN_DOMAIN);
}

/** Saves a guest account with a name and PIN; returns the new student code. */
export async function saveWithPin(name: string, pin: string): Promise<string> {
  const client = requireSupabase();
  await ensureSignedIn();
  const { data, error } = await client.functions.invoke('student-account', {
    body: { name: name.trim(), pin: pin.trim() },
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const details = await (error.context as Response).json().catch(() => null);
      if (details && typeof details.message === 'string') throw new Error(details.message);
    }
    throw new Error('Could not save your account. Please try again.');
  }
  const code = data.student_code as string;
  await signInWithPin(code, pin);
  return code;
}

export async function signInWithPin(studentCode: string, pin: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.signInWithPassword({
    email: loginEmail(studentCode),
    password: pinPassword(studentCode, pin),
  });
  if (error) {
    const m = error.message.toLowerCase();
    throw new Error(
      m.includes('invalid') || m.includes('credentials')
        ? 'That student code or PIN is wrong. Check them and try again.'
        : m.includes('rate') || m.includes('too many')
          ? 'Too many tries. Please wait a few minutes.'
          : error.message,
    );
  }
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Explains Supabase auth errors in words a student can act on. */
function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('already') && (m.includes('registered') || m.includes('exists') || m.includes('been'))) {
    return 'This email already has an account. Use "Sign in with my email" instead.';
  }
  if (m.includes('expired') || m.includes('invalid') || m.includes('token')) {
    return 'That code is wrong or has expired. Check the email, or send a new code.';
  }
  if (m.includes('rate') || m.includes('security purposes') || m.includes('too many')) {
    return 'Please wait a minute before asking for another code.';
  }
  if (m.includes('signups not allowed') || m.includes('user not found')) {
    return 'There is no saved account with this email. Save your account first.';
  }
  return message;
}

export async function loadAccount(): Promise<Account> {
  const client = requireSupabase();
  await ensureSignedIn();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error('Could not load your account. Please try again.');
  const user = data.user;
  const isGuest = user.is_anonymous === true || !user.email;

  let student: Student | null = null;
  let enrolments: Enrolment[] = [];
  const { data: trackRows } = await client
    .from('tracks')
    .select('id, name, active')
    .order('active', { ascending: false })
    .order('id');
  const courses: Course[] = (trackRows ?? [])
    .filter((t) => t.id !== 'general')
    .map((t) => ({ id: t.id, name: t.name, active: t.active }));
  if (!isGuest) {
    const [studentResult, enrolmentResult] = await Promise.all([
      client.from('students').select('id, display_name, student_code').eq('id', user.id).maybeSingle(),
      client.from('enrolments').select('track_id, target, tracks(name)').eq('user_id', user.id),
    ]);
    if (studentResult.data) {
      student = {
        id: studentResult.data.id,
        displayName: studentResult.data.display_name,
        studentCode: studentResult.data.student_code,
      };
    }
    enrolments = (enrolmentResult.data ?? []).map((row) => {
      const track = row.tracks as unknown as { name: string } | { name: string }[] | null;
      const name = Array.isArray(track) ? track[0]?.name : track?.name;
      return { trackId: row.track_id, trackName: name ?? row.track_id, target: row.target };
    });
  }

  return { userId: user.id, isGuest, email: user.email ?? null, student, enrolments, courses };
}

/** Step 1 of saving a guest account: emails a code to confirm the address. */
export async function startSaving(email: string): Promise<void> {
  const client = requireSupabase();
  await ensureSignedIn();
  const { error } = await client.auth.updateUser({ email: email.trim().toLowerCase() });
  if (error) throw new Error(friendly(error.message));
}

/** Step 2: checks the code, then creates the student record with their name. */
export async function finishSaving(email: string, code: string, name: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: 'email_change',
  });
  if (error) throw new Error(friendly(error.message));
  // A fresh token, so the database sees the account is no longer a guest.
  await client.auth.refreshSession();
  await saveName(name);
}

/** Signing in on another device: emails a code (no new accounts made here). */
export async function startSignIn(email: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: false },
  });
  if (error) throw new Error(friendly(error.message));
}

export async function finishSignIn(email: string, code: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: 'email',
  });
  if (error) throw new Error(friendly(error.message));
}

/** Creates the student record, or renames it if there is one already. */
export async function saveName(name: string): Promise<void> {
  const client = requireSupabase();
  const displayName = name.trim().slice(0, 80);
  if (!displayName) throw new Error('Please type your name.');
  const { data } = await client.auth.getUser();
  if (!data.user) throw new Error('Please sign in first.');

  const { data: existing } = await client
    .from('students')
    .select('id')
    .eq('id', data.user.id)
    .maybeSingle();
  const { error } = existing
    ? await client.from('students').update({ display_name: displayName }).eq('id', data.user.id)
    : await client.from('students').insert({ display_name: displayName });
  if (error) throw new Error('Could not save your name. Please try again.');
}

/** A saved student joins a course themselves (prototype: no teacher needed). */
export async function joinCourse(trackId: string, target: string | null): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.functions.invoke('student-account', {
    body: { action: 'join', track: trackId, target },
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const details = await (error.context as Response).json().catch(() => null);
      if (details && typeof details.message === 'string') throw new Error(details.message);
    }
    throw new Error('Could not join the course. Please try again.');
  }
}

/** Signs out of the saved account; the device becomes a new guest. */
export async function signOut(): Promise<void> {
  const client = requireSupabase();
  await client.auth.signOut();
  await ensureSignedIn();
}
