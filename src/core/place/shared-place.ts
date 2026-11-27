/**
 * Place kit: sharing a phone's NEWEST place with the others in a live session
 * (outdoor activities). One value per phone, overwritten each time, so no trail
 * of where anyone went is kept; the host clears everyone's at the end.
 */
import { useEffect, useRef } from 'react';

import { requireSupabase } from '@/core/app/supabase';
import { LOCATION_SHARE_SECONDS } from '@/core/classes/safety-rules';
import { distanceM, type Fix, type LatLng } from '@/core/place/geo';

// ===========================================================================
// Settings
// ===========================================================================

/** A shared place older than this is not trusted (the phone went to sleep or lost signal). */
export const PLACE_STALE_MS = 3 * 60 * 1000;
/** Between the regular shares, send early if the phone moved at least this far. */
const SEND_EARLY_AFTER_M = 40;

// ===========================================================================

export type SharedPlace = { lat: number; lng: number; accuracy: number; at: string };

/** The place, if it is recent enough to use. */
export function freshPlace(place: SharedPlace | null | undefined, now = Date.now()): LatLng | null {
  if (!place) return null;
  return now - Date.parse(place.at) <= PLACE_STALE_MS ? { lat: place.lat, lng: place.lng } : null;
}

const stamp = (fix: Fix): SharedPlace => ({
  lat: Math.round(fix.lat * 1e6) / 1e6,
  lng: Math.round(fix.lng * 1e6) / 1e6,
  accuracy: Math.round(fix.accuracy),
  at: new Date().toISOString(),
});

/** A student's phone shares its place (their own participants row). */
export async function shareStudentPlace(participantId: string, fix: Fix | null): Promise<void> {
  const { error } = await requireSupabase()
    .from('participants')
    .update({ live_place: fix ? stamp(fix) : null })
    .eq('id', participantId);
  if (error) throw new Error(error.message);
}

/** The host's phone shares its place (the session row). */
export async function shareHostPlace(sessionId: string, fix: Fix | null): Promise<void> {
  const { error } = await requireSupabase()
    .from('sessions')
    .update({ host_place: fix ? stamp(fix) : null })
    .eq('id', sessionId);
  if (error) throw new Error(error.message);
}

/** The host clears every place in the session (at the end). */
export async function clearSessionPlaces(sessionId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('clear_tour_places', { p_session_id: sessionId });
  if (error) throw new Error(error.message);
}

/**
 * While `on`, sends this phone's place every LOCATION_SHARE_SECONDS (sooner after
 * a bigger move), using `send`. Failures are ignored: the next one tries again.
 */
export function useSharePlace(fix: Fix | null, on: boolean, send: (fix: Fix) => Promise<void>) {
  const latest = useRef(fix);
  latest.current = fix;
  const sent = useRef<{ at: number; place: LatLng } | null>(null);
  const sendRef = useRef(send);
  sendRef.current = send;

  useEffect(() => {
    if (!on) {
      sent.current = null;
      return;
    }
    const tick = () => {
      const now = latest.current;
      if (!now) return;
      const last = sent.current;
      const due = !last || Date.now() - last.at >= LOCATION_SHARE_SECONDS * 1000;
      const moved = last ? distanceM(last.place, now) >= SEND_EARLY_AFTER_M : true;
      if (!due && !moved) return;
      sent.current = { at: Date.now(), place: { lat: now.lat, lng: now.lng } };
      sendRef.current(now).catch(() => {
        sent.current = null;
      });
    };
    tick();
    const timer = setInterval(tick, 5000);
    return () => clearInterval(timer);
  }, [on]);
}
