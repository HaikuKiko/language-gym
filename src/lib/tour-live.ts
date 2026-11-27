/**
 * GPS tours, live: a tour is a live session (Live classroom kit) with the flag
 * `tour:<tour id>` and `under-18` or `adults`. Each student's phone is one group.
 * Work is saved as session events (kind `tour_work`), the newest per task wins;
 * photos and recordings go to the private `tour-media` bucket.
 */
import { safetyRules, type SafetyRules } from '@/core/classes/safety-rules';
import { fetchEvents, logEvent } from '@/core/live/events';
import { flagValue, hasFlag, type LiveSession } from '@/core/live/session';
import { base64ToBytes, extensionFor, mediaLinks, uploadMedia } from '@/core/media/storage';
import { TOURS } from '@/data/tour-routes';
import type { TaskFiles, TaskWork, Tour, TourWork } from '@/lib/tours';

// ===========================================================================
// Settings
// ===========================================================================

/** How often the teacher's screen re-reads the groups' work. */
export const TOUR_WORK_REFRESH_MS = 20_000;
/** How long a tour session's clock is set to (it isn't shown; tours end when the teacher ends them). */
export const TOUR_MINUTES = 180;

// ===========================================================================

const TOUR_FLAG = 'tour:';
const UNDER_18 = 'under-18';
const ADULTS = 'adults';
const BUCKET = 'tour-media';
const WORK = 'tour_work';

export function tourFlags(tourId: string, under18: boolean): string[] {
  return [`${TOUR_FLAG}${tourId}`, under18 ? UNDER_18 : ADULTS];
}

/** The tour a session runs, or null when it isn't a tour. */
export function tourOf(session: LiveSession): Tour | null {
  const id = flagValue(session, TOUR_FLAG);
  return id ? (TOURS.find((t) => t.id === id) ?? null) : null;
}

/** Under-18 is the default: only an explicit "adults" flag relaxes the rules. */
export function tourRules(session: LiveSession): SafetyRules {
  return safetyRules(hasFlag(session, ADULTS) ? 'adults' : 'under-18');
}

type WorkData = { stop: string; task: string; text?: string; photo?: string; audio?: string };

/** Saves one task's work: uploads the photo or recording, then logs it. */
export async function saveTourWork(args: {
  session: LiveSession;
  participantId: string;
  stopId: string;
  taskId: string;
  work: TaskWork;
  files?: TaskFiles;
}): Promise<void> {
  const { session, participantId, stopId, taskId, work, files } = args;
  const folder = `${session.id}/${participantId}`;
  const stamp = `${stopId}-${taskId}-${Date.now()}`;
  const data: WorkData = { stop: stopId, task: taskId };
  if (work.text) data.text = work.text;
  if (files?.photo) {
    data.photo = await uploadMedia(BUCKET, `${folder}/${stamp}.jpg`, base64ToBytes(files.photo.base64), 'image/jpeg');
  }
  if (files?.audio) {
    const type = files.audio.contentType;
    data.audio = await uploadMedia(BUCKET, `${folder}/${stamp}.${extensionFor(type)}`, files.audio.blob, type.split(';')[0]);
  }
  if (!data.text && !data.photo && !data.audio) return;
  await logEvent(session.id, participantId, WORK, data);
}

export type GroupWork = { work: TourWork; visitOrder: string[] };

/** Every group's work (participant id → work), with working links to photos and recordings. */
export async function fetchTourWork(sessionId: string, onlyParticipant?: string): Promise<Record<string, GroupWork>> {
  const events = (await fetchEvents(sessionId)).filter(
    (e) => e.kind === WORK && e.participant_id && (!onlyParticipant || e.participant_id === onlyParticipant),
  );
  const paths = events.flatMap((e) => {
    const d = e.data as WorkData;
    return [d.photo, d.audio].filter((p): p is string => Boolean(p));
  });
  const links = paths.length > 0 ? await mediaLinks(BUCKET, paths) : {};

  const out: Record<string, GroupWork> = {};
  for (const e of events) {
    const d = e.data as WorkData;
    const group = (out[e.participant_id as string] ??= { work: {}, visitOrder: [] });
    const stop = (group.work[d.stop] ??= {});
    // Events come oldest first, so later saves replace earlier ones, field by field.
    const prev = stop[d.task] ?? {};
    stop[d.task] = {
      text: d.text ?? prev.text,
      photoUri: (d.photo && links[d.photo]) || prev.photoUri,
      audioUri: (d.audio && links[d.audio]) || prev.audioUri,
    };
    if (!group.visitOrder.includes(d.stop)) group.visitOrder.push(d.stop);
  }
  return out;
}
