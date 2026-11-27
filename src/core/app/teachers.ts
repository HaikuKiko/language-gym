/**
 * Teacher logins: a username and password (no email is sent). The first
 * teacher account is made from the owner's device, keeping what was already
 * made there; after that teachers add teachers. Class writing is for signed-in
 * teachers only. See supabase/functions/teacher-account.
 */
import { callFunction } from '@/core/app/functions';
import { ensureSignedIn, requireSupabase } from '@/core/app/supabase';

// ===========================================================================
// Settings
// ===========================================================================

/** Shortest password allowed (must match the teacher-account function). */
export const MIN_PASSWORD_LENGTH = 6;
/** The made-up email domain for teacher logins (must match the function). */
const LOGIN_DOMAIN = 'teachers.language-gym.invalid';

// ===========================================================================

export type Teacher = { userId: string; username: string; displayName: string };

function loginEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${LOGIN_DOMAIN}`;
}

/** The signed-in teacher, or null when this device is not signed in as a teacher. */
export async function currentTeacher(): Promise<Teacher | null> {
  const client = requireSupabase();
  const userId = await ensureSignedIn();
  const { data } = await client.from('teachers').select('user_id, username, display_name').eq('user_id', userId).maybeSingle();
  return data ? { userId: data.user_id, username: data.username, displayName: data.display_name } : null;
}

/** How many teachers there are (0 means the first teacher account can be made). */
export async function teacherCount(): Promise<number> {
  const client = requireSupabase();
  await ensureSignedIn();
  const { data } = await client.rpc('teacher_count');
  return typeof data === 'number' ? data : 0;
}

export async function listTeachers(): Promise<Teacher[]> {
  const { data } = await requireSupabase().from('teachers').select('user_id, username, display_name').order('display_name');
  return (data ?? []).map((t) => ({ userId: t.user_id, username: t.username, displayName: t.display_name }));
}

export async function signInTeacher(username: string, password: string): Promise<void> {
  const { error } = await requireSupabase().auth.signInWithPassword({ email: loginEmail(username), password });
  if (error) throw new Error('The username or password is not right.');
}

export async function signOutTeacher(): Promise<void> {
  await requireSupabase().auth.signOut();
}

async function call(body: Record<string, unknown>): Promise<void> {
  await callFunction('teacher-account', body, 'The teacher account could not be saved. Please try again.');
}

/** Makes this device's user the first teacher, then signs in with the new login. */
export async function createFirstTeacher(username: string, name: string, password: string): Promise<void> {
  await call({ action: 'first', username: username.trim().toLowerCase(), name, password });
  await signInTeacher(username, password);
}

/** A teacher adds another teacher's account. */
export async function addTeacher(username: string, name: string, password: string): Promise<void> {
  await call({ action: 'add', username: username.trim().toLowerCase(), name, password });
}
