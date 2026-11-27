/**
 * Saved student names (Live classroom kit): a teacher's students' names (e.g.
 * "Mai T.") are saved when they join, so next time a student types two letters
 * on the join page and taps their name. Saved by the database when a student
 * joins (see supabase/updates/2026-11-27-saved-names.sql).
 */
import { requireSupabase } from '@/core/app/supabase';

// ===========================================================================
// Settings
// ===========================================================================

/** A saved name is deleted after this many days without use (keep equal to the database job). */
export const SAVED_NAME_DAYS = 60;
/** Letters to type before saved names are shown. */
export const SAVED_NAME_MIN_LETTERS = 2;

// ===========================================================================

/** Saved names for this session's teacher that start with the letters typed ([] if none, or on any problem). */
export async function savedNamesFor(code: string, typed: string): Promise<string[]> {
  if (typed.trim().length < SAVED_NAME_MIN_LETTERS) return [];
  const { data, error } = await requireSupabase().rpc('saved_names_for_code', { p_code: code, p_prefix: typed });
  if (error || !Array.isArray(data)) return [];
  return data.map((row) => (typeof row === 'string' ? row : String(Object.values(row as object)[0] ?? '')));
}

/** True when the name has a family-name initial, e.g. "Mai T." or "Mai Tran". */
export function hasInitial(name: string): boolean {
  return /\S\s+\S/.test(name.trim());
}

/** Tidies a typed name: "mai t" → "Mai T." */
export function tidyName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .map((w, i) => {
      const cap = w.charAt(0).toUpperCase() + w.slice(1);
      return i > 0 && i === words.length - 1 && cap.length === 1 ? `${cap}.` : cap;
    })
    .join(' ');
}
