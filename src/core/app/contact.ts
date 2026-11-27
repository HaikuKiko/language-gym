/** The contact box ("Keep me posted"): messages only teachers can read. */
import { ensureSignedIn, requireSupabase } from '@/core/app/supabase';

export type ContactMessage = { id: number; email: string; message: string; created_at: string };

// ===========================================================================
// Settings
// ===========================================================================

/** How many of the latest messages the dashboard shows. */
const MESSAGES_SHOWN = 20;

// ===========================================================================

export async function sendContactMessage(email: string, message: string): Promise<void> {
  const client = requireSupabase();
  await ensureSignedIn();
  const { error } = await client.from('contact_messages').insert({ email: email.trim(), message: message.trim() });
  if (error) throw new Error('Your message could not be sent. Please try again.');
}

/** The latest messages (teachers only). */
export async function loadContactMessages(): Promise<ContactMessage[]> {
  const { data } = await requireSupabase()
    .from('contact_messages')
    .select('id, email, message, created_at')
    .order('created_at', { ascending: false })
    .limit(MESSAGES_SHOWN);
  return (data ?? []) as ContactMessage[];
}
