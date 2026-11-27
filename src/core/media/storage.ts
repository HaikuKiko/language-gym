/**
 * Media kit: putting photos and recordings in a private Supabase storage bucket
 * and getting short-lived links to show or play them. Links are cached so a
 * screen that refreshes often doesn't ask for new ones each time.
 */
import { requireSupabase } from '@/core/app/supabase';

// ===========================================================================
// Settings
// ===========================================================================

/** How long a link to a private file works. */
const LINK_SECONDS = 60 * 60;
/** Ask for a new link this long before the old one stops working. */
const LINK_RENEW_BEFORE_MS = 5 * 60 * 1000;

// ===========================================================================

const links = new Map<string, { url: string; until: number }>();

/** Turns base64 (e.g. a prepared photo) into bytes for uploading. */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Uploads a file; gives back its path in the bucket. */
export async function uploadMedia(
  bucket: string,
  path: string,
  data: Blob | Uint8Array,
  contentType: string,
): Promise<string> {
  // Raw bytes, so the file keeps its own type (a Blob would be sent as a form).
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(await data.arrayBuffer());
  const { error } = await requireSupabase().storage.from(bucket).upload(path, bytes, { contentType, upsert: false });
  if (error) throw new Error(`Could not save the file: ${error.message}`);
  return path;
}

/** Working links for some files (path → link); files that can't be opened are left out. */
export async function mediaLinks(bucket: string, paths: string[]): Promise<Record<string, string>> {
  const now = Date.now();
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const p of new Set(paths)) {
    const cached = links.get(`${bucket}/${p}`);
    if (cached && cached.until - LINK_RENEW_BEFORE_MS > now) out[p] = cached.url;
    else missing.push(p);
  }
  if (missing.length > 0) {
    const { data, error } = await requireSupabase().storage.from(bucket).createSignedUrls(missing, LINK_SECONDS);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      if (!row.path || !row.signedUrl) continue;
      links.set(`${bucket}/${row.path}`, { url: row.signedUrl, until: now + LINK_SECONDS * 1000 });
      out[row.path] = row.signedUrl;
    }
  }
  return out;
}

/** The file ending for a recording's type ("audio/webm;codecs=opus" → "webm"). */
export function extensionFor(contentType: string): string {
  const sub = contentType.split(';')[0].split('/')[1] ?? 'bin';
  return sub === 'mpeg' ? 'mp3' : sub === 'x-m4a' ? 'm4a' : sub;
}
