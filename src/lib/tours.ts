/**
 * GPS tours: a teacher's route of stops; groups walk it and the tasks at a stop
 * only open when they are there. Uses the Place kit (distances), the Classes kit
 * (safety rules) and the Media kit (slideshow).
 */
import { countWords } from '@/core/app/text';
import type { PreparedPhoto } from '@/core/media/photo';
import type { Slide } from '@/core/media/slideshow';
import type { Recording } from '@/core/media/use-audio-recorder';
import type { SafetyRules } from '@/core/classes/safety-rules';
import { distanceM, isWithin, nearest, type Fix, type LatLng } from '@/core/place/geo';
import type { Level } from '@/core/content/levels';

export type TaskKind = 'photo' | 'write' | 'audio' | 'video' | 'talk';

/** What each kind of task is called, and whether it works yet (video comes in a later step). */
export const TASK_KINDS: Record<TaskKind, { icon: string; label: string; ready: boolean }> = {
  photo: { icon: '📷', label: 'Photo', ready: true },
  write: { icon: '✍️', label: 'Writing', ready: true },
  audio: { icon: '🎧', label: 'Sound recording', ready: true },
  video: { icon: '🎥', label: 'Video', ready: false },
  talk: { icon: '🎤', label: 'Talk to a person', ready: true },
};

/** What students read out before recording a person (they tap "They said yes" first). */
export const CONSENT_SCRIPT =
  'Hi! We are students doing an English project. Can we ask you two questions and record your voice? No names. It is deleted after 30 days.';

export type TourTask = {
  id: string;
  kind: TaskKind;
  prompt: string;
  /** Writing: about how many words. */
  wordTarget?: number;
};

export type TourStop = {
  id: string;
  name: string;
  /** A part of the route, e.g. "North Laine", shown as a heading in the list. */
  area: string;
  at: LatLng;
  radiusM: number;
  clue: string;
  /** A word on a sign at the stop: typing it opens the stop when GPS is poor. */
  backupCode?: string;
  tasks: TourTask[];
};

export type Tour = {
  id: string;
  title: string;
  /** One line for the teacher: where and what. */
  description: string;
  level: Level;
  /** Where everyone meets at the start. */
  meetingPoint: LatLng & { name: string };
  /** Groups choose their own stops; this is how many to aim for. */
  aim: number;
  stops: TourStop[];
};

/** A group's work on one task. */
export type TaskWork = { text?: string; photoUri?: string; audioUri?: string };

/** The photo or recording behind a task's work, for uploading (live tours). */
export type TaskFiles = { photo?: PreparedPhoto; audio?: Recording };

/** Longest sound recording, in seconds. */
export const AUDIO_MAX_SECONDS = 60;
/** All of a group's work: stop id → task id → work. */
export type TourWork = Record<string, Record<string, TaskWork>>;

export function isTaskDone(task: TourTask, work: TaskWork | undefined): boolean {
  if (!work) return false;
  if (task.kind === 'photo') return Boolean(work.photoUri);
  if (task.kind === 'write') return countWords(work.text ?? '') > 0;
  if (task.kind === 'audio' || task.kind === 'talk') return Boolean(work.audioUri);
  return false;
}

/** A stop counts as visited when at least one of its tasks is done. */
export function isStopVisited(stop: TourStop, work: TourWork): boolean {
  return stop.tasks.some((t) => isTaskDone(t, work[stop.id]?.[t.id]));
}


export type StopAccess =
  /** Not there yet. */
  | { state: 'far'; distance: number | null }
  /** At the stop, but (under 18) no supervising adult is close enough. */
  | { state: 'need-adult'; distance: number; adultDistance: number | null }
  | { state: 'open'; distance: number | null };

/**
 * Can this group open this stop now? It opens at the stop (or with the code on
 * the sign) and, for under-18 groups, only when a supervising adult is near.
 */
export function stopAccess(args: {
  stop: TourStop;
  fix: Fix | null;
  adults: LatLng[];
  rules: SafetyRules;
  codeTyped?: string;
}): StopAccess {
  const { stop, fix, adults, rules, codeTyped } = args;
  const distance = fix ? distanceM(fix, stop.at) : null;
  const byCode =
    Boolean(stop.backupCode) && codeTyped?.trim().toLowerCase() === stop.backupCode?.trim().toLowerCase();
  const here = byCode || (fix ? isWithin(fix, stop.at, stop.radiusM) : false);
  if (!here) return { state: 'far', distance };
  if (rules.needsAdultNearby) {
    // With the code (no GPS), the stop itself stands in for where the group is.
    const adult = nearest(fix ?? stop.at, adults);
    if (!adult || adult.distance > rules.maxFromAdultM) {
      return { state: 'need-adult', distance: distance ?? 0, adultDistance: adult?.distance ?? null };
    }
  }
  return { state: 'open', distance };
}

/** How far the group is from the nearest supervising adult (null without a place). */
export function distanceFromAdults(at: LatLng | null, adults: LatLng[]): number | null {
  if (!at) return null;
  return nearest(at, adults)?.distance ?? null;
}

/** The group's slideshow: one slide per visited stop, in the order given. */
export function tourSlides(tour: Tour, work: TourWork, order: string[]): Slide[] {
  const slides: Slide[] = [];
  for (const stopId of order) {
    const stop = tour.stops.find((s) => s.id === stopId);
    if (!stop || !isStopVisited(stop, work)) continue;
    const stopWork = work[stop.id] ?? {};
    const photo = stop.tasks.find((t) => t.kind === 'photo' && stopWork[t.id]?.photoUri);
    const texts = stop.tasks
      .filter((t) => t.kind === 'write')
      .map((t) => stopWork[t.id]?.text?.trim())
      .filter((t): t is string => Boolean(t));
    slides.push({
      id: stop.id,
      kicker: `${stop.area} · stop ${tour.stops.indexOf(stop) + 1}`,
      title: stop.name,
      imageUri: photo ? stopWork[photo.id]?.photoUri : undefined,
      texts,
      sounds: stop.tasks
        .filter((t) => (t.kind === 'audio' || t.kind === 'talk') && stopWork[t.id]?.audioUri)
        .map((t) => ({ label: t.kind === 'talk' ? '🎤 Our interview' : '🎧 What it sounds like', uri: stopWork[t.id]?.audioUri as string })),
    });
  }
  return slides;
}
