/**
 * Custom sets (Content kit): a named list of items (questions for now) with a
 * one-line purpose, the same at every level. Tables custom_question_sets and
 * custom_questions; made by the owner with Claude for now, later by teachers.
 */
import { supabase } from '@/core/app/supabase';

export type CustomSet = {
  id: string;
  name: string;
  description: string;
  questions: string[];
  /** Each question's follow-ups, in the same order as questions (may be empty). */
  followUps?: string[][];
};

/** A list of strings from a text[] column (anything else: empty). */
export function textList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim() !== '') : [];
}

/** The active custom sets with their questions, in a fixed order (so every phone agrees). Empty sets are left out. */
export async function loadCustomSets(): Promise<CustomSet[]> {
  if (!supabase) return [];
  const [{ data: sets }, { data: questions }] = await Promise.all([
    supabase.from('custom_question_sets').select('id, name, description').eq('active', true).order('created_at'),
    supabase.from('custom_questions').select('set_id, text, follow_ups').eq('active', true).order('id').limit(5000),
  ]);
  return (sets ?? [])
    .map((s) => {
      const own = (questions ?? []).filter((q) => q.set_id === s.id);
      return {
        id: String(s.id),
        name: String(s.name),
        description: String(s.description ?? ''),
        questions: own.map((q) => String(q.text)),
        followUps: own.map((q) => textList(q.follow_ups)),
      };
    })
    .filter((s) => s.questions.length > 0);
}
