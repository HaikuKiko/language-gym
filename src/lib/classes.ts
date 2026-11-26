/**
 * The teacher's classes (3A, 3B …), each with a target level, and the
 * students in each class. Class sets belong to a class and their pages to a
 * student, so each student's writing can be followed over time. Tables
 * classes and class_students (supabase/updates/2026-11-24-classes.sql).
 */
import { IELTS_PLACEHOLDER_LEVEL, type TargetLevel } from '@/lib/class-scores';
import { studentKey, type Area, type ClassSet, type ClassSetPage, type Course } from '@/lib/class-sets';
import { ensureSignedIn, requireSupabase } from '@/lib/supabase';
import type { AreaLevel } from '@/lib/writing';

// ===========================================================================
// Settings
// ===========================================================================

/** A name read from a sheet matches a student when it is this close (letters changed, per 10 letters). */
const MATCH_EDITS_PER_10_LETTERS = 2.5;
/** Most students suggested when a name needs checking. */
const MAX_SUGGESTIONS = 6;

// ===========================================================================

export type SchoolClass = {
  id: string;
  created_at: string;
  name: string;
  /** General English (target level) or IELTS Writing Task 2 (target band). */
  course: Course;
  target_level: TargetLevel;
  /** IELTS classes: the band the class aims for, e.g. 6.5. */
  target_band: number | null;
};

export type ClassStudent = {
  id: string;
  class_id: string;
  created_at: string;
  name: string;
  student_key: string;
};

/** One piece of writing in a student's history. */
export type HistoryEntry = {
  page: ClassSetPage;
  set: Pick<ClassSet, 'id' | 'title' | 'created_at'>;
};

export async function loadClasses(): Promise<(SchoolClass & { studentCount: number })[]> {
  const client = requireSupabase();
  await ensureSignedIn();
  const [{ data: classes, error }, { data: students }] = await Promise.all([
    client.from('classes').select('*').order('name'),
    client.from('class_students').select('class_id'),
  ]);
  if (error) throw new Error('Your classes could not be loaded. Please try again.');
  return (classes ?? []).map((c) => ({
    ...(c as SchoolClass),
    studentCount: (students ?? []).filter((s) => s.class_id === c.id).length,
  }));
}

export async function createClass(
  name: string,
  target: { course: 'general'; level: TargetLevel } | { course: 'ielts'; band: number },
): Promise<SchoolClass> {
  const client = requireSupabase();
  await ensureSignedIn();
  const { data, error } = await client
    .from('classes')
    .insert(
      target.course === 'ielts'
        ? { name: name.trim(), course: 'ielts', target_level: IELTS_PLACEHOLDER_LEVEL, target_band: target.band }
        : { name: name.trim(), course: 'general', target_level: target.level },
    )
    .select('*')
    .single();
  if (error) {
    throw new Error(error.code === '23505' ? `You already have a class called ${name.trim()}.` : 'The class could not be saved.');
  }
  return data as SchoolClass;
}

export async function updateClass(
  id: string,
  changes: Partial<Pick<SchoolClass, 'name' | 'target_level' | 'target_band'>>,
) {
  const { error } = await requireSupabase().from('classes').update(changes).eq('id', id);
  if (error) throw new Error('The class could not be saved.');
}

export async function loadClass(
  id: string,
): Promise<{ schoolClass: SchoolClass; students: ClassStudent[]; sets: ClassSet[]; pages: ClassSetPage[] } | null> {
  const client = requireSupabase();
  await ensureSignedIn();
  const [{ data: schoolClass, error }, { data: students }, { data: sets }] = await Promise.all([
    client.from('classes').select('*').eq('id', id).maybeSingle(),
    client.from('class_students').select('*').eq('class_id', id).order('name'),
    client.from('class_sets').select('*').eq('class_id', id).order('created_at', { ascending: false }),
  ]);
  if (error) throw new Error('The class could not be loaded. Please try again.');
  if (!schoolClass) return null;
  const setIds = (sets ?? []).map((s) => s.id);
  const { data: pages } = setIds.length
    ? await client.from('class_set_pages').select('*').in('set_id', setIds)
    : { data: [] };
  return {
    schoolClass: schoolClass as SchoolClass,
    students: (students ?? []) as ClassStudent[],
    sets: (sets ?? []) as ClassSet[],
    // A student's later pages have no feedback of their own.
    pages: ((pages ?? []) as ClassSetPage[]).filter((p) => p.continues_page == null),
  };
}

export async function loadStudents(classId: string): Promise<ClassStudent[]> {
  const { data } = await requireSupabase().from('class_students').select('*').eq('class_id', classId).order('name');
  return (data ?? []) as ClassStudent[];
}

/** Adds students to a class (names already there are skipped). */
export async function addStudents(classId: string, names: string[]): Promise<ClassStudent[]> {
  const client = requireSupabase();
  await ensureSignedIn();
  const existing = new Set((await loadStudents(classId)).map((s) => s.student_key));
  const rows = [
    ...new Map(
      names
        .map((n) => n.trim().replace(/\s+/g, ' '))
        .filter(Boolean)
        .map((name) => [studentKey(name), { class_id: classId, name, student_key: studentKey(name) }] as const),
    ).values(),
  ].filter((r) => !existing.has(r.student_key));
  if (rows.length === 0) return [];
  const { data, error } = await client.from('class_students').insert(rows).select('*');
  if (error) throw new Error('The students could not be saved.');
  return (data ?? []) as ClassStudent[];
}

export async function renameStudent(student: ClassStudent, name: string): Promise<ClassStudent> {
  const clean = name.trim().replace(/\s+/g, ' ');
  const { error } = await requireSupabase()
    .from('class_students')
    .update({ name: clean, student_key: studentKey(clean) })
    .eq('id', student.id);
  if (error) {
    throw new Error(error.code === '23505' ? `There is already a ${clean} in this class.` : 'The name could not be saved.');
  }
  // Pages show the student's name too.
  await requireSupabase()
    .from('class_set_pages')
    .update({ student_name: clean, student_key: studentKey(clean) })
    .eq('student_id', student.id);
  return { ...student, name: clean, student_key: studentKey(clean) };
}

/** Links a page to a student. */
export async function assignPage(page: ClassSetPage, student: ClassStudent): Promise<ClassSetPage> {
  const changes = { student_id: student.id, student_name: student.name, student_key: student.student_key };
  const { error } = await requireSupabase()
    .from('class_set_pages')
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq('id', page.id);
  if (error) throw new Error('The page could not be saved.');
  return { ...page, ...changes };
}

/** Every piece of a student's writing, newest first. */
export async function loadStudentHistory(
  studentId: string,
): Promise<{ student: ClassStudent; schoolClass: SchoolClass | null; history: HistoryEntry[] } | null> {
  const client = requireSupabase();
  await ensureSignedIn();
  const { data: student } = await client.from('class_students').select('*').eq('id', studentId).maybeSingle();
  if (!student) return null;
  const [{ data: schoolClass }, { data: pages }] = await Promise.all([
    client.from('classes').select('*').eq('id', student.class_id).maybeSingle(),
    client.from('class_set_pages').select('*, class_sets(id, title, created_at)').eq('student_id', studentId),
  ]);
  const history = (pages ?? [])
    .map((row) => {
      const { class_sets: set, ...page } = row as ClassSetPage & { class_sets: HistoryEntry['set'] };
      return { page: page as ClassSetPage, set };
    })
    .sort((a, b) => b.set.created_at.localeCompare(a.set.created_at));
  return { student: student as ClassStudent, schoolClass: (schoolClass as SchoolClass) ?? null, history };
}

// ---------------------------------------------------------------------------
// Matching a name read from a sheet to the class list
// ---------------------------------------------------------------------------

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

/** How far a written name is from a student's name (lower is closer). */
function nameDistance(written: string, student: ClassStudent): number {
  const w = studentKey(written);
  const s = student.student_key;
  const full = editDistance(w, s);
  // "Sofia" written for "Sofia Rossi", or the other way round: compare first names.
  const [wFirst] = w.split(' ');
  const [sFirst] = s.split(' ');
  const first = w.includes(' ') && s.includes(' ') ? full : editDistance(wFirst, sFirst) + 0.5;
  return Math.min(full, first);
}

/**
 * The student a name read from a sheet belongs to, when one student is a
 * clear match (allowing for misread letters), else null.
 */
export function matchStudent(written: string, students: ClassStudent[]): ClassStudent | null {
  if (!written.trim() || students.length === 0) return null;
  const ranked = students
    .map((s) => ({ s, d: nameDistance(written, s) }))
    .sort((a, b) => a.d - b.d);
  const best = ranked[0];
  const allowed = (Math.max(studentKey(written).length, 4) * MATCH_EDITS_PER_10_LETTERS) / 10;
  if (best.d > allowed) return null;
  // Two students equally close (e.g. two Sofias): let the teacher choose.
  if (ranked[1] && ranked[1].d === best.d) return null;
  return best.s;
}

/** Students to suggest for a name, closest first. */
export function suggestStudents(written: string, students: ClassStudent[]): ClassStudent[] {
  if (!written.trim()) return students.slice(0, MAX_SUGGESTIONS);
  return students
    .map((s) => ({ s, d: nameDistance(written, s) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, MAX_SUGGESTIONS)
    .map((x) => x.s);
}

export type { Area, AreaLevel };
