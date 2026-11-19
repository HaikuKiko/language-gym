/**
 * student-account: turns a guest into a saved student without email (the
 * prototype's "student code + PIN" sign-in).
 *
 * POST { name, pin }   (pin is 4 digits; the caller must be a guest)
 *   -> 200 { student_code, login_email }
 *
 * It creates the student record (which gives the student code), then gives
 * the same user a made-up login email built from that code and a password
 * built from the code and PIN, already confirmed, so no email is ever sent.
 * The app then signs in with the code and PIN. The user id stays the same,
 * so nothing done as a guest is lost.
 *
 * This is deliberately weak (a 4-digit PIN) for the prototype. The email
 * code sign-in in the app (src/lib/account.ts) replaces it later.
 */
import { createClient } from "@supabase/supabase-js";

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

/** Must match loginEmail() and pinPassword() in src/lib/account.ts. */
export function loginEmail(studentCode: string): string {
  return `${studentCode.toLowerCase()}@students.language-gym.invalid`;
}
export function pinPassword(studentCode: string, pin: string): string {
  return `lg-${studentCode.toUpperCase()}-${pin}`;
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
  const user = userData.user;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail(400, "bad_request", "The request was not valid JSON.");
  }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  const pin = typeof body.pin === "string" ? body.pin.trim() : "";
  if (!name) return fail(400, "bad_request", "Please type your name.");
  if (!/^\d{4}$/.test(pin)) return fail(400, "bad_request", "Your PIN must be 4 numbers.");

  if (!user.is_anonymous) {
    return fail(400, "already_saved", "This account is already saved.");
  }

  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // The student record gives the student code. A guest may have one left
  // over from a try that failed half-way; reuse it.
  let { data: student } = await admin
    .from("students")
    .select("student_code")
    .eq("id", user.id)
    .maybeSingle();
  if (student) {
    await admin.from("students").update({ display_name: name }).eq("id", user.id);
  } else {
    const { data: created, error: insertError } = await admin
      .from("students")
      .insert({ id: user.id, display_name: name })
      .select("student_code")
      .single();
    if (insertError || !created) {
      console.error("Could not create student", insertError?.message);
      return fail(500, "server_error", "Could not save your account. Please try again.");
    }
    student = created;
  }

  const code = student.student_code as string;
  const email = loginEmail(code);
  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    email,
    password: pinPassword(code, pin),
    email_confirm: true,
  });
  if (updateError) {
    console.error("Could not save login", updateError.message);
    return fail(500, "server_error", "Could not save your account. Please try again.");
  }

  return reply(200, { student_code: code, login_email: email });
});
