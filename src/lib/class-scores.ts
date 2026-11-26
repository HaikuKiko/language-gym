/**
 * The weekly score out of 10 for a piece of class writing, worked out from
 * the AI's level in each of the four areas compared with the class's target
 * level. Meeting the target in every area gives 7; above it climbs quickly to
 * 10; below it falls gently, so 5.5 means "doesn't meet the standard" and
 * under 5 is very rare.
 */
import type { Area, ClassSetPage } from '@/lib/class-sets';
import type { SchoolClass } from '@/lib/classes';

// ===========================================================================
// Settings: change the scoring here
// ===========================================================================

/** The bands an IELTS class can aim for, lowest first. */
export const IELTS_TARGET_BANDS = [4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8] as const;
/** IELTS classes don't use a CEFR target; this is stored in its place. */
export const IELTS_PLACEHOLDER_LEVEL = 'B2';

/** The levels a class can aim for, lowest first. */
export const TARGET_LEVELS = ['A1', 'A1+', 'A2', 'A2+', 'B1', 'B1+', 'B2', 'B2+', 'C1', 'C2'] as const;

/** Each level as a number: one whole level = 1, a "+" = half a level. */
const LEVEL_STEPS: Record<string, number> = {
  'Pre-A1': 0,
  A1: 1,
  'A1+': 1.5,
  A2: 2,
  'A2+': 2.5,
  B1: 3,
  'B1+': 3.5,
  B2: 4,
  'B2+': 4.5,
  C1: 5,
  C2: 6,
};

/** The score for work exactly at the target level in every area. */
const SCORE_AT_TARGET = 7;
/** Points gained per level above the target (half a level above = +1). */
const POINTS_PER_LEVEL_ABOVE = 2;
/** Points lost per level below the target (half a level below = −0.5). */
const POINTS_PER_LEVEL_BELOW = 1;
/** Below this score, points fall at half the speed, so lower scores stay rare. */
const SOFT_FLOOR = 5;
/** Scores are rounded to this (0.5 = half points). */
const ROUND_TO = 0.5;
const MIN_SCORE = 1;
const MAX_SCORE = 10;

// ===========================================================================

export type TargetLevel = (typeof TARGET_LEVELS)[number];

/** A level as a number (see LEVEL_STEPS), or null if unknown. */
export function levelStep(level: string | null | undefined): number | null {
  return level && level in LEVEL_STEPS ? LEVEL_STEPS[level] : null;
}

/** The plain CEFR level the feedback is written for, e.g. "A2+" → "A2". */
export function feedbackLevel(target: TargetLevel): 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' {
  return target.replace('+', '') as 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
}

/**
 * The score out of 10 from the four areas' levels and the class's target.
 * Null when the areas are missing.
 */
export function scoreFor(
  areaLevels: Partial<Record<Area, string>> | null | undefined,
  target: TargetLevel,
): number | null {
  const steps = Object.values(areaLevels ?? {})
    .map(levelStep)
    .filter((s): s is number => s !== null);
  const targetStep = levelStep(target);
  if (steps.length === 0 || targetStep === null) return null;

  const gap = steps.reduce((a, b) => a + b, 0) / steps.length - targetStep;
  let score =
    gap >= 0 ? SCORE_AT_TARGET + gap * POINTS_PER_LEVEL_ABOVE : SCORE_AT_TARGET + gap * POINTS_PER_LEVEL_BELOW;
  if (score < SOFT_FLOOR) score = SOFT_FLOOR - (SOFT_FLOOR - score) / 2;

  const rounded = Math.round(score / ROUND_TO) * ROUND_TO;
  return Math.min(MAX_SCORE, Math.max(MIN_SCORE, rounded));
}

/** "7", "6.5". */
export function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

/** "6.0", "6.5" (as IELTS shows bands). */
export function formatBandValue(band: number): string {
  return band.toFixed(1);
}

/** The class's target in words: "Target A2+" or "Target band 6.5". */
export function targetLabel(schoolClass: Pick<SchoolClass, 'course' | 'target_level' | 'target_band'>): string {
  if (schoolClass.course === 'ielts') {
    return schoolClass.target_band != null ? `Target band ${formatBandValue(schoolClass.target_band)}` : 'IELTS';
  }
  return `Target ${schoolClass.target_level}`;
}

/**
 * A marked piece of writing's result for lists: General English, the score
 * out of 10 and the level; IELTS, the overall band and how it compares with
 * the target. Null while not marked.
 */
export function pageResult(
  page: Pick<ClassSetPage, 'area_levels' | 'cefr_level' | 'band'>,
  schoolClass: Pick<SchoolClass, 'course' | 'target_level' | 'target_band'> | null,
): { big: string; small: string } | null {
  if (page.band != null) {
    const target = schoolClass?.course === 'ielts' ? schoolClass.target_band : null;
    return {
      big: formatBandValue(page.band),
      small: target == null ? 'band' : page.band >= target ? 'on target' : `target ${formatBandValue(target)}`,
    };
  }
  if (!page.cefr_level) return null;
  const score = schoolClass ? scoreFor(page.area_levels, schoolClass.target_level) : null;
  return score === null ? { big: page.cefr_level, small: 'level' } : { big: formatScore(score), small: page.cefr_level };
}
