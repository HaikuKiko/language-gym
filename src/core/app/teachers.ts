/**
 * Teacher logins: "Sign in with Google" (the teacher's Gmail), or a username
 * and password (no email is sent). The first teacher account is made from the
 * owner's device, keeping what was already made there; after that teachers add
 * teachers. Class writing is for signed-in teachers only. See
 * supabase/functions/teacher-account.
 */
import { callFunction } from '@/core/app/functions';
import { ensureSignedIn, requireSupabase, signInWithProvider } from '@/core/app/supabase';

// ===========================================================================
// Settings
// ===========================================================================

/** Shortest password allowed (must match the teacher-account function). */
export const MIN_PASSWORD_LENGTH = 6;
/** The made-up email domain for teacher logins (must match the function). */
const LOGIN_DOMAIN = 'teachers.language-gym.invalid';

// ===========================================================================

export type Teacher = {
  userId: string;
  username: string;
  displayName: string;
  /** The Gmail address they sign in with Google with, if any. */
  gmail: string | null;
};

type TeacherRow = { user_id: string; username: string; display_name: string; email?: string | null };

function toTeacher(t: TeacherRow): Teacher {
  return { userId: t.user_id, username: t.username, displayName: t.display_name, gmail: t.email ?? null };
}

function loginEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${LOGIN_DOMAIN}`;
}

/** The signed-in teacher, or null when this device is not signed in as a teacher. */
export async function currentTeacher(): Promise<Teacher | null> {
  const client = requireSupabase();
  const userId = await ensureSignedIn();
  const { data } = await client.from('teachers').select('*').eq('user_id', userId).maybeSingle();
  return data ? toTeacher(data as TeacherRow) : null;
}

/** How many teachers there are (0 means the first teacher account can be made). */
export async function teacherCount(): Promise<number> {
  const client = requireSupabase();
  await ensureSignedIn();
  const { data } = await client.rpc('teacher_count');
  return typeof data === 'number' ? data : 0;
}

export async function listTeachers(): Promise<Teacher[]> {
  const { data } = await requireSupabase().from('teachers').select('*').order('display_name');
  return ((data ?? []) as TeacherRow[]).map(toTeacher);
}

export async function signInTeacher(username: string, password: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.signInWithPassword({ email: loginEmail(username), password });
  if (!error) return;
  // Teachers with a Gmail sign in with that email: the function looks it up.
  await ensureSignedIn(); // the function needs a signed-in caller (a guest is fine)
  const { data, error: callError } = await client.functions.invoke('teacher-account', {
    body: { action: 'sign-in', username: username.trim().toLowerCase(), password },
  });
  if (callError || !data?.access_token) throw new Error('The username or password is not right.');
  const { error: sessionError } = await client.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  if (sessionError) throw new Error('The username or password is not right.');
}

/** Opens Google's sign-in; it comes back to this page signed in (web only). */
export async function signInTeacherWithGoogle(): Promise<void> {
  await signInWithProvider('google');
}

/** The email of whoever is signed in on this device (null for a guest). */
export async function signedInEmail(): Promise<string | null> {
  const { data } = await requireSupabase().auth.getSession();
  return data.session?.user.email ?? null;
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

/** A teacher adds another teacher's account (with a Gmail the password may be empty). */
export async function addTeacher(username: string, name: string, password: string, gmail = ''): Promise<void> {
  await call({ action: 'add', username: username.trim().toLowerCase(), name, password, gmail: gmail.trim().toLowerCase() });
}

/** The signed-in teacher sets the Gmail address they use for "Sign in with Google". */
export async function setMyGmail(gmail: string): Promise<void> {
  await call({ action: 'google', gmail: gmail.trim().toLowerCase() });
}
