/**
 * teacher-account: teacher logins (username + password, and Google).
 *
 * First:   POST { action: "first", username, name, password }
 *          Only while there are no teachers yet: turns the caller (usually the
 *          device's guest, so anything already made on it is kept) into the
 *          first teacher.
 * Add:     POST { action: "add", username, name, password?, gmail? }
 *          The caller must be a teacher: creates another teacher's account.
 *          With a Gmail address the password may be left out (they use Google).
 * Google:  POST { action: "google", gmail }
 *          A teacher sets (or changes) the Gmail address they sign in with.
 * Sign in: POST { action: "sign-in", username, password }
 *          For teachers whose login email is their Gmail: looks up the email
 *          from the username and returns the session.
 *
 * A teacher's login email is their Gmail, or else a made-up one built from the
 * username (username@teachers.language-gym.invalid, already confirmed, so no
 * email is ever sent). "Sign in with Google" with the same Gmail opens the same
 * account, because Supabase links identities with the same confirmed email.
 * Must match src/core/app/teachers.ts.
 */
import { createClient } from "@supabase/supabase-js";

// ===========================================================================
// Settings
// ===========================================================================

/** Shortest password allowed. */
const MIN_PASSWORD_LENGTH = 6;
/** The made-up email domain for teacher logins. */
const LOGIN_DOMAIN = "teachers.language-gym.invalid";

// ===========================================================================

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function fail(status: number, error: string, message: string): Response {
  return reply(status, { error, message });
}

export function loginEmail(username: string): string {
  return `${username}@${LOGIN_DOMAIN}`;
}

function cleanGmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// deno-lint-ignore no-explicit-any
type Admin = ReturnType<typeof createClient<any>>;

/**
 * Who already uses this email, if anyone: "none", "free" (an account that only
 * ever signed in with Google and is not a teacher, e.g. someone who tried
 * Google before being added), or "taken".
 */
async function emailOwner(admin: Admin, email: string): Promise<{ kind: "none" | "free" | "taken"; userId?: string }> {
  const { data: userId } = await admin.rpc("user_id_for_email", { p_email: email });
  if (!userId) return { kind: "none" };
  const { data: teacher } = await admin.from("teachers").select("user_id").eq("user_id", userId).maybeSingle();
  if (teacher) return { kind: "taken", userId: userId as string };
  const { data } = await admin.auth.admin.getUserById(userId as string);
  const providers = (data.user?.identities ?? []).map((i) => i.provider);
  const googleOnly = providers.length > 0 && providers.every((p) => p === "google");
  return { kind: googleOnly ? "free" : "taken", userId: userId as string };
}

const GMAIL_TAKEN = "That Gmail address is already used by another account.";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (request.method !== "POST") return fail(405, "method_not_allowed", "Use POST.");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail(400, "bad_request", "The request was not valid JSON.");
  }

  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  const password = typeof body.password === "string" ? body.password : "";
  const gmail = cleanGmail(body.gmail);

  // Signing in needs no caller: it is how a teacher gets a session.
  if (body.action === "sign-in") {
    const wrong = () => fail(401, "wrong_login", "The username or password is not right.");
    if (!username || !password) return wrong();
    const { data: teacher } = await admin.from("teachers").select("user_id").eq("username", username).maybeSingle();
    if (!teacher) return wrong();
    const { data: found } = await admin.auth.admin.getUserById(teacher.user_id);
    const email = found.user?.email;
    if (!email) return wrong();
    const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session) return wrong();
    return reply(200, { access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: request.headers.get("Authorization") ?? "" } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return fail(401, "not_signed_in", "Please sign in first.");
  const caller = userData.user;
  const { data: callerTeacher } = await admin.from("teachers").select("user_id").eq("user_id", caller.id).maybeSingle();

  if (body.action === "google") {
    if (!callerTeacher) return fail(403, "not_teacher", "Only teachers can do this.");
    if (!isEmail(gmail)) return fail(400, "bad_gmail", "Please type a whole Gmail address, e.g. name@gmail.com.");
    const owner = await emailOwner(admin, gmail);
    if (owner.userId === caller.id) return reply(200, { gmail });
    if (owner.kind === "taken") return fail(409, "gmail_taken", GMAIL_TAKEN);
    // Someone (this teacher) tried Google before it was linked: remove that empty account.
    if (owner.kind === "free") await admin.auth.admin.deleteUser(owner.userId!);
    const { error } = await admin.auth.admin.updateUserById(caller.id, { email: gmail, email_confirm: true });
    if (error) {
      console.error("Could not save the Gmail", error.message);
      return fail(500, "server_error", "Could not save the Gmail address. Please try again.");
    }
    await admin.from("teachers").update({ email: gmail }).eq("user_id", caller.id);
    return reply(200, { gmail });
  }

  if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
    return fail(400, "bad_username", "The username must be 3 to 30 letters or numbers (no spaces).");
  }
  if (!name) return fail(400, "bad_name", "Please type the teacher's name.");
  if (gmail && !isEmail(gmail)) return fail(400, "bad_gmail", "Please type a whole Gmail address, e.g. name@gmail.com.");
  const needsPassword = !(body.action === "add" && gmail);
  if ((needsPassword || password) && password.length < MIN_PASSWORD_LENGTH) {
    return fail(400, "bad_password", `The password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const { count } = await admin.from("teachers").select("user_id", { count: "exact", head: true });
  const { data: taken } = await admin.from("teachers").select("user_id").eq("username", username).maybeSingle();
  if (taken) return fail(409, "taken", "That username is already used. Try another one.");

  if (body.action === "first") {
    if ((count ?? 0) > 0) return fail(403, "not_first", "There are teachers already: ask one of them to add you.");
    // The caller becomes the teacher, keeping everything already made on this device.
    const { error } = await admin.auth.admin.updateUserById(caller.id, {
      email: loginEmail(username),
      password,
      email_confirm: true,
    });
    if (error) {
      console.error("Could not save the teacher login", error.message);
      return fail(500, "server_error", "Could not save the teacher account. Please try again.");
    }
    const { error: insertError } = await admin
      .from("teachers")
      .insert({ user_id: caller.id, username, display_name: name });
    if (insertError) {
      console.error("Could not add the teacher", insertError.message);
      return fail(500, "server_error", "Could not save the teacher account. Please try again.");
    }
    return reply(200, { username });
  }

  if (body.action === "add") {
    if (!callerTeacher) return fail(403, "not_teacher", "Only teachers can add teachers.");
    // No password typed (Google only): a long random one nobody knows.
    const loginPassword = password || crypto.randomUUID() + crypto.randomUUID();
    let userId: string;
    let made = false;
    const owner = gmail ? await emailOwner(admin, gmail) : { kind: "none" as const };
    if (owner.kind === "taken") return fail(409, "gmail_taken", GMAIL_TAKEN);
    if (owner.kind === "free") {
      // They already tried "Sign in with Google": make that account the teacher.
      userId = owner.userId!;
      const { error } = await admin.auth.admin.updateUserById(userId, { password: loginPassword });
      if (error) {
        console.error("Could not set the password", error.message);
        return fail(500, "server_error", "Could not create the teacher account. Please try again.");
      }
    } else {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: gmail || loginEmail(username),
        password: loginPassword,
        email_confirm: true,
      });
      if (error || !created.user) {
        console.error("Could not create the teacher", error?.message);
        return fail(500, "server_error", "Could not create the teacher account. Please try again.");
      }
      userId = created.user.id;
      made = true;
    }
    const { error: insertError } = await admin
      .from("teachers")
      .insert({ user_id: userId, username, display_name: name, email: gmail || null });
    if (insertError) {
      console.error("Could not add the teacher", insertError.message);
      if (made) await admin.auth.admin.deleteUser(userId);
      return fail(500, "server_error", "Could not create the teacher account. Please try again.");
    }
    return reply(200, { username });
  }

  return fail(400, "bad_request", "Unknown action.");
});
