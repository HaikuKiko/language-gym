/**
 * GPS tours, live: a tour is a live session (Live classroom kit) with the flag
 * `tour:<tour id>`. Each student's phone is one group. Everyone counts as an adult
 * unless the teacher marks their group under 18 (flag `u18:<participant id>`).
 * Work is saved as session events (kind `tour_work`), the newest per task wins;
 * photos and recordings go to the private `tour-media` bucket.
 */
import { safetyRules, type SafetyRules } from '@/core/classes/safety-rules';
import { fetchEvents, logEvent } from '@/core/live/events';
import { requireSupabase } from '@/core/app/supabase';
import { MEDIA_RETENTION_DAYS } from '@/core/classes/safety-rules';
import { fetchParticipants, flagValue, hasFlag, type LiveSession } from '@/core/live/session';
import type { SlideDeck } from '@/core/media/slide-presenter';
import { base64ToBytes, extensionFor, mediaLinks, uploadMedia } from '@/core/media/storage';
import { TOURS } from '@/data/tour-routes';
import { tourSlides, type TaskFiles, type TaskWork, type Tour, type TourWork } from '@/lib/tours';

// ===========================================================================
// Settings
// ===========================================================================

/** How often the teacher's screen re-reads the groups' work. */
export const TOUR_WORK_REFRESH_MS = 20_000;
/** How long a tour session's clock is set to (it isn't shown; tours end when the teacher ends them). */
export const TOUR_MINUTES = 180;

// ===========================================================================

const TOUR_FLAG = 'tour:';
/** Old tours (before 28 Nov 2026) marked the whole tour under 18. */
const OLD_WHOLE_TOUR_UNDER_18 = 'under-18';
const UNDER_18 = 'u18:';
const BUCKET = 'tour-media';
const WORK = 'tour_work';

export function tourFlags(tourId: string): string[] {
  return [`${TOUR_FLAG}${tourId}`];
}

/** The tour a session runs, or null when it isn't a tour. */
export function tourOf(session: LiveSession): Tour | null {
  const id = flagValue(session, TOUR_FLAG);
  return id ? (TOURS.find((t) => t.id === id) ?? null) : null;
}

/** True when the teacher has marked this group (phone) under 18. */
export function isUnder18(session: LiveSession, participantId: string): boolean {
  return hasFlag(session, OLD_WHOLE_TOUR_UNDER_18) || hasFlag(session, `${UNDER_18}${participantId}`);
}

/** True when any group in the tour is under 18 (so the teacher must share their place). */
export function anyUnder18(session: LiveSession): boolean {
  return (session.categories ?? []).some((c) => c === OLD_WHOLE_TOUR_UNDER_18 || c.startsWith(UNDER_18));
}

/** The session's flags with this group marked (or unmarked) under 18. Save them as `categories`. */
export function withUnder18(session: LiveSession, participantId: string, under18: boolean): string[] {
  const flag = `${UNDER_18}${participantId}`;
  const rest = (session.categories ?? []).filter((c) => c !== flag);
  return under18 ? [...rest, flag] : rest;
}

/** A group's rules: adults unless the teacher marked it under 18. */
export function tourRules(session: LiveSession, participantId: string): SafetyRules {
  return safetyRules(isUnder18(session, participantId) ? 'under-18' : 'adults');
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

export type PastTour = { session: LiveSession; tour: Tour; createdAt: string };

/** This teacher's tours from the last MEDIA_RETENTION_DAYS days, newest first (for the classroom screen). */
export async function fetchMyTours(): Promise<PastTour[]> {
  const client = requireSupabase();
  const { data: auth } = await client.auth.getSession();
  const userId = auth.session?.user.id;
  if (!userId) return [];
  const since = new Date(Date.now() - MEDIA_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await client
    .from('sessions')
    .select('*')
    .eq('host_id', userId)
    .neq('status', 'lobby')
    .gte('created_at', since)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as (LiveSession & { created_at: string })[]).flatMap((session) => {
    const tour = tourOf(session);
    return tour ? [{ session, tour, createdAt: session.created_at }] : [];
  });
}

/** One slideshow per group, ready for the classroom screen. */
export async function fetchTourDecks(session: LiveSession, tour: Tour): Promise<SlideDeck[]> {
  const [participants, work] = await Promise.all([fetchParticipants(session.id), fetchTourWork(session.id)]);
  return participants.map((p) => {
    const w = work[p.id] ?? { work: {}, visitOrder: [] };
    return { id: p.id, label: p.name, slides: tourSlides(tour, w.work, w.visitOrder) };
  });
}
