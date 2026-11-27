/**
 * Place kit: maths for places on a map. No screens and no database here, so any
 * activity (tours, a treasure hunt, a "meet at the café" task) can use it.
 */

// ===========================================================================
// Settings
// ===========================================================================

/** How close a phone must be to a stop for it to open, when a stop doesn't say. */
export const DEFAULT_RADIUS_M = 40;
/**
 * Phones' GPS is often 10–30 m out. Up to this much of the phone's own
 * "accuracy" is added to a stop's radius, so a group standing at the stop isn't
 * kept out by a wobbly reading, but a very poor reading can't open it from far away.
 */
export const MAX_ACCURACY_BONUS_M = 25;
/** "Getting warmer" bar: at this distance or more the bar is fully cold. */
export const COLD_FROM_M = 800;

// ===========================================================================

export type LatLng = { lat: number; lng: number };

/** A place a phone may be, with how sure the phone is (metres; 0 = exact, as in the demo). */
export type Fix = LatLng & { accuracy: number };

const EARTH_RADIUS_M = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Distance along the ground between two places, in metres. */
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** True when the phone is close enough to a place (its radius plus some of the GPS wobble). */
export function isWithin(fix: Fix, place: LatLng, radiusM = DEFAULT_RADIUS_M): boolean {
  return distanceM(fix, place) <= radiusM + Math.min(Math.max(fix.accuracy, 0), MAX_ACCURACY_BONUS_M);
}

/** 0 (cold, far away) to 1 (hot, there), for a "getting warmer" bar. */
export function warmth(distance: number, radiusM = DEFAULT_RADIUS_M): number {
  if (distance <= radiusM) return 1;
  return Math.max(0, 1 - (distance - radiusM) / (COLD_FROM_M - radiusM));
}

/** "Getting warmer" words for a distance. */
export function warmthWords(distance: number, radiusM = DEFAULT_RADIUS_M): string {
  const w = warmth(distance, radiusM);
  if (w >= 1) return "You're here! 🎉";
  if (w > 0.85) return 'Very hot! 🔥🔥';
  if (w > 0.6) return 'Getting warmer! 🔥';
  if (w > 0.3) return 'Warm';
  return 'Cold ❄️';
}

/** Distance for people: "35 m", "1.2 km". */
export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres / 5) * 5} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

/** The nearest of some places, with its distance (null when there are none). */
export function nearest<T extends LatLng>(from: LatLng, places: T[]): { place: T; distance: number } | null {
  let best: { place: T; distance: number } | null = null;
  for (const place of places) {
    const distance = distanceM(from, place);
    if (!best || distance < best.distance) best = { place, distance };
  }
  return best;
}

/** The middle of some places (for centring a map). */
export function centreOf(places: LatLng[]): LatLng {
  if (places.length === 0) return { lat: 0, lng: 0 };
  const sum = places.reduce((s, p) => ({ lat: s.lat + p.lat, lng: s.lng + p.lng }), { lat: 0, lng: 0 });
  return { lat: sum.lat / places.length, lng: sum.lng / places.length };
}

/** A place a given distance (metres) and direction (degrees, 0 = north) from another; for demos. */
export function moveBy(from: LatLng, metres: number, bearingDeg: number): LatLng {
  const d = metres / EARTH_RADIUS_M;
  const b = rad(bearingDeg);
  const lat1 = rad(from.lat);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b));
  const lng2 =
    rad(from.lng) + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}

/** A step of at most `metres` from one place towards another (lands on it when close). */
export function stepTowards(from: LatLng, to: LatLng, metres: number): LatLng {
  const d = distanceM(from, to);
  if (d <= metres) return to;
  const t = metres / d;
  return { lat: from.lat + (to.lat - from.lat) * t, lng: from.lng + (to.lng - from.lng) * t };
}
