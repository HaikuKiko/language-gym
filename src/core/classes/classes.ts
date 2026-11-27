/**
 * Classes kit: the teacher's classes (e.g. 2A, 3A), so every activity can say
 * which class it is for and each class gets its own leaderboard. A live
 * session keeps its class as a flag (`class:<id>`); quiz weeks and saved
 * scores have a class_id column. Table classes (teachers only, own rows).
 */
import { useEffect, useState } from 'react';

import { requireSupabase } from '@/core/app/supabase';

// ===========================================================================
// Settings
// ===========================================================================

/** The session flag that holds the class: `class:<class id>`. */
export const CLASS_FLAG = 'class:';
/** Where this browser remembers the last class chosen (a convenience only). */
const LAST_CLASS_KEY = 'core:last-class';

// ===========================================================================

export type ClassInfo = {
  id: string;
  name: string;
  course: 'general' | 'ielts';
  target_level: string;
  target_band: number | null;
};

/** The flags to add to a new session for this class (none without one). */
export function classFlags(classId: string | null | undefined): string[] {
  return classId ? [CLASS_FLAG + classId] : [];
}

/** The class a session is for, from its flags; null when none was chosen. */
export function sessionClassId(session: { categories?: string[] | null }): string | null {
  const flag = session.categories?.find((c) => c.startsWith(CLASS_FLAG));
  return flag ? flag.slice(CLASS_FLAG.length) : null;
}

/** The signed-in teacher's classes, by name; an empty list for anyone else. */
export async function fetchClassList(): Promise<ClassInfo[]> {
  const { data, error } = await requireSupabase()
    .from('classes')
    .select('id, name, course, target_level, target_band')
    .order('name');
  if (error) return [];
  return (data ?? []) as ClassInfo[];
}

/** The teacher's classes (null while loading). */
export function useClasses(): ClassInfo[] | null {
  const [classes, setClasses] = useState<ClassInfo[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchClassList()
      .then((list) => !cancelled && setClasses(list))
      .catch(() => !cancelled && setClasses([]));
    return () => {
      cancelled = true;
    };
  }, []);
  return classes;
}

export function lastClassId(): string | null {
  try {
    return globalThis.localStorage?.getItem(LAST_CLASS_KEY) ?? null;
  } catch {
    return null;
  }
}

export function rememberClassId(id: string | null): void {
  try {
    if (id) globalThis.localStorage?.setItem(LAST_CLASS_KEY, id);
    else globalThis.localStorage?.removeItem(LAST_CLASS_KEY);
  } catch {
    // Storage blocked: the choice just isn't remembered.
  }
}

/**
 * The class chosen on a setup screen: starts with the last one this browser
 * used (when it is still one of the teacher's classes) and remembers changes.
 */
export function useChosenClass(classes: ClassInfo[] | null): [string | null, (id: string | null) => void] {
  const [chosen, setChosen] = useState<string | null>(() => lastClassId());
  const valid = classes === null || chosen === null || classes.some((c) => c.id === chosen) ? chosen : null;
  return [
    valid,
    (id) => {
      setChosen(id);
      rememberClassId(id);
    },
  ];
}

/** The name of a class, or null. */
export function className(classes: readonly ClassInfo[] | null, id: string | null): string | null {
  return (id && classes?.find((c) => c.id === id)?.name) || null;
}
