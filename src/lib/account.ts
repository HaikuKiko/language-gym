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
import { ensureSignedIn, requireSupabase } from '@/lib/supabase';

export type Student = { id: string; displayName: string; studentCode: string };
export type Enrolment = { trackId: string; trackName: string; target: string | null };

export type Account = {
  userId: string;
  /** True for a guest: their work stays on this device only. */
  isGuest: boolean;
  email: string | null;
  /** Null for guests, and for saved accounts that have not given a name yet. */
  student: Student | null;
  enrolments: Enrolment[];
};

export const CODE_LENGTH = 6;

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

  return { userId: user.id, isGuest, email: user.email ?? null, student, enrolments };
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

/** Signs out of the saved account; the device becomes a new guest. */
export async function signOut(): Promise<void> {
  const client = requireSupabase();
  await client.auth.signOut();
  await ensureSignedIn();
}
