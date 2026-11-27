/**
 * Calling one of our edge functions (App basics): signs in first, and turns
 * the function's own error message ({ message }) into a readable error.
 */
import { FunctionsHttpError } from '@supabase/supabase-js';

import { ensureSignedIn, requireSupabase } from '@/core/app/supabase';

/** Calls edge function `name` with `body`; `fallback` is the message when the function gives none. */
export async function callFunction<T = Record<string, unknown>>(
  name: string,
  body: Record<string, unknown>,
  fallback: string,
): Promise<T> {
  const client = requireSupabase();
  await ensureSignedIn();
  const { data, error } = await client.functions.invoke(name, { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const details = await (error.context as Response).json().catch(() => null);
      if (details && typeof details.message === 'string') throw new Error(details.message);
    }
    throw new Error(fallback);
  }
  return data as T;
}
