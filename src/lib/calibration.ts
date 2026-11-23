/**
 * Ongoing IELTS calibration: teachers add the bands they would give to an
 * essay the AI has marked, and the Calibration screen shows how far apart
 * the AI and the teachers are. Rows live in the calibration_marks table.
 */
import { formatBand, type IeltsFeedback } from '@/lib/ielts';
import { ensureSignedIn, requireSupabase } from '@/lib/supabase';

export const CODES = ['tr', 'cc', 'lr', 'gra'] as const;
export type Code = (typeof CODES)[number];
export type Bands = Record<Code, number>;

export const CODE_NAMES: Record<Code, string> = {
  tr: 'Task Response',
  cc: 'Coherence & Cohesion',
  lr: 'Lexical Resource',
  gra: 'Grammar',
};

/** The model that marks essays (kept with each row, to compare after a change). */
const MARKING_MODEL = 'claude-haiku-5-5';

/** The same rule as the marking: the average, rounded up to the next half band. */
export function overallFrom(bands: Bands): number {
  const average = (bands.tr + bands.cc + bands.lr + bands.gra) / 4;
  return Math.ceil(average * 2) / 2;
}

export function aiBands(f: IeltsFeedback): Bands {
  const get = (code: Code) => f.criteria.find((c) => c.code === code)?.band ?? 0;
  return { tr: get('tr'), cc: get('cc'), lr: get('lr'), gra: get('gra') };
}

export type CalibrationRow = {
  id: number;
  created_at: string;
  question: string;
  essay: string;
  word_count: number;
  ai: Bands;
  aiOverall: number;
  teacher: Bands;
  teacherOverall: number;
};

/** What the AI gave an essay, to save next to a teacher's bands. */
export type AiMarking = { ai: Bands; aiOverall: number; wordCount: number };

export function aiMarking(f: IeltsFeedback): AiMarking {
  return { ai: aiBands(f), aiOverall: f.overall_band, wordCount: f.word_count };
}

export async function saveCalibration(input: {
  question: string;
  essay: string;
  marking: AiMarking;
  teacher: Bands;
  /** The shared essay this is for (/calibrate/<code>), if any. */
  sharedCode?: string;
}): Promise<number> {
  const client = requireSupabase();
  await ensureSignedIn();
  const { ai, aiOverall, wordCount } = input.marking;
  const { data, error } = await client
    .from('calibration_marks')
    .insert({
      question: input.question.trim(),
      essay: input.essay.trim(),
      word_count: wordCount,
      model: MARKING_MODEL,
      ai_tr: ai.tr,
      ai_cc: ai.cc,
      ai_lr: ai.lr,
      ai_gra: ai.gra,
      ai_overall: aiOverall,
      teacher_tr: input.teacher.tr,
      teacher_cc: input.teacher.cc,
      teacher_lr: input.teacher.lr,
      teacher_gra: input.teacher.gra,
      teacher_overall: overallFrom(input.teacher),
      ...(input.sharedCode ? { shared_code: input.sharedCode } : {}),
    })
    .select('id')
    .single();
  if (error) {
    console.error('Calibration save failed', error.message);
    throw new Error(
      error.code === '42P01' || /calibration_marks/.test(error.message)
        ? 'Calibration is not set up yet (the database table is missing).'
        : 'Your marks could not be saved. Please try again.',
    );
  }
  return data.id as number;
}

/** This device's earlier marks for a shared essay, if it was marked here before. */
export async function findMySharedMarks(sharedCode: string): Promise<{ id: number; teacher: Bands } | null> {
  const client = requireSupabase();
  const userId = await ensureSignedIn();
  const { data } = await client
    .from('calibration_marks')
    .select('id, teacher_tr, teacher_cc, teacher_lr, teacher_gra')
    .eq('shared_code', sharedCode)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, teacher: { tr: data.teacher_tr, cc: data.teacher_cc, lr: data.teacher_lr, gra: data.teacher_gra } };
}

export async function deleteCalibration(id: number): Promise<void> {
  const client = requireSupabase();
  await client.from('calibration_marks').delete().eq('id', id);
}

export async function loadCalibration(): Promise<CalibrationRow[]> {
  const client = requireSupabase();
  await ensureSignedIn();
  const { data, error } = await client
    .from('calibration_marks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) {
    console.error('Calibration load failed', error.message);
    throw new Error('The calibration could not be loaded. Please try again.');
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    created_at: r.created_at,
    question: r.question ?? '',
    essay: r.essay,
    word_count: r.word_count,
    ai: { tr: r.ai_tr, cc: r.ai_cc, lr: r.ai_lr, gra: r.ai_gra },
    aiOverall: Number(r.ai_overall),
    teacher: { tr: r.teacher_tr, cc: r.teacher_cc, lr: r.teacher_lr, gra: r.teacher_gra },
    teacherOverall: Number(r.teacher_overall),
  }));
}

export type CalibrationStats = {
  count: number;
  /** Share of essays where the overall bands are the same or 0.5 apart. */
  overallWithinHalf: number;
  overallExact: number;
  /** Average of AI minus teacher: above 0 means the AI marks higher. */
  overallBias: number;
  criteria: { code: Code; bias: number; exact: number; withinOne: number }[];
};

export function calibrationStats(rows: CalibrationRow[]): CalibrationStats | null {
  if (rows.length === 0) return null;
  const n = rows.length;
  const share = (test: (r: CalibrationRow) => boolean) => rows.filter(test).length / n;
  const mean = (value: (r: CalibrationRow) => number) => rows.reduce((s, r) => s + value(r), 0) / n;
  return {
    count: n,
    overallWithinHalf: share((r) => Math.abs(r.aiOverall - r.teacherOverall) <= 0.5),
    overallExact: share((r) => r.aiOverall === r.teacherOverall),
    overallBias: mean((r) => r.aiOverall - r.teacherOverall),
    criteria: CODES.map((code) => ({
      code,
      bias: mean((r) => r.ai[code] - r.teacher[code]),
      exact: share((r) => r.ai[code] === r.teacher[code]),
      withinOne: share((r) => Math.abs(r.ai[code] - r.teacher[code]) <= 1),
    })),
  };
}

/** How far apart the AI and the teacher are on one essay (sum over criteria). */
export function rowGap(r: CalibrationRow): number {
  return CODES.reduce((s, c) => s + Math.abs(r.ai[c] - r.teacher[c]), 0);
}

/** "AI +0.4 higher", "AI −0.3 lower", "Same". */
export function biasLabel(bias: number): string {
  const rounded = Math.round(bias * 10) / 10;
  if (rounded === 0) return 'Same on average';
  return rounded > 0 ? `AI +${rounded.toFixed(1)} higher` : `AI −${Math.abs(rounded).toFixed(1)} lower`;
}

export function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

export { formatBand };
