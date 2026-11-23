/**
 * teacher-account: teacher logins, without email.
 *
 * First:  POST { action: "first", username, name, password }
 *         Only while there are no teachers yet: turns the caller (usually the
 *         device's guest, so anything already made on it is kept) into the
 *         first teacher.
 * Add:    POST { action: "add", username, name, password }
 *         The caller must be a teacher: creates another teacher's account.
 *
 * A teacher signs in with a made-up login email built from the username
 * (username@teachers.language-gym.invalid, already confirmed, so no email is
 * ever sent) and their password. Must match src/lib/teachers.ts.
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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (request.method !== "POST") return fail(405, "method_not_allowed", "Use POST.");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: request.headers.get("Authorization") ?? "" } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return fail(401, "not_signed_in", "Please sign in first.");
  const caller = userData.user;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail(400, "bad_request", "The request was not valid JSON.");
  }

  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
    return fail(400, "bad_username", "The username must be 3 to 30 letters or numbers (no spaces).");
  }
  if (!name) return fail(400, "bad_name", "Please type the teacher's name.");
  if (password.length < MIN_PASSWORD_LENGTH) {
    return fail(400, "bad_password", `The password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
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
    const { data: isTeacher } = await admin.from("teachers").select("user_id").eq("user_id", caller.id).maybeSingle();
    if (!isTeacher) return fail(403, "not_teacher", "Only teachers can add teachers.");
    const { data: created, error } = await admin.auth.admin.createUser({
      email: loginEmail(username),
      password,
      email_confirm: true,
    });
    if (error || !created.user) {
      console.error("Could not create the teacher", error?.message);
      return fail(500, "server_error", "Could not create the teacher account. Please try again.");
    }
    const { error: insertError } = await admin
      .from("teachers")
      .insert({ user_id: created.user.id, username, display_name: name });
    if (insertError) {
      console.error("Could not add the teacher", insertError.message);
      await admin.auth.admin.deleteUser(created.user.id);
      return fail(500, "server_error", "Could not create the teacher account. Please try again.");
    }
    return reply(200, { username });
  }

  return fail(400, "bad_request", "Unknown action.");
});
