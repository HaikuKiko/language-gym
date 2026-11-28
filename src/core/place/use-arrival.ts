import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { isWithin, type Fix, type LatLng } from '@/core/place/geo';

/**
 * Place kit: "You're here!" When the phone comes within a place's radius, the
 * hook returns that place (once per place) and the phone buzzes and beeps, so
 * a group walking with the phone in a pocket notices. Works while the page is
 * open (a web page can't wake a locked phone).
 */

// ===========================================================================
// Settings
// ===========================================================================

/** Buzz pattern (milliseconds on, off, on). */
const BUZZ_PATTERN = [250, 120, 250];
/** The beep: pitch (Hz) and length (seconds) of each of its two notes. */
const BEEP_NOTES = [880, 1320];
const BEEP_SECONDS = 0.18;

// ===========================================================================

export type ArrivalPlace = { id: string; at: LatLng; radiusM: number };

export function useArrival(
  fix: Fix | null,
  places: ArrivalPlace[],
  /** Places that shouldn't alert (e.g. already done). */
  skip: (id: string) => boolean = () => false,
): { arrived: string | null; dismiss: () => void } {
  const [arrived, setArrived] = useState<string | null>(null);
  const alerted = useRef(new Set<string>());

  useEffect(() => {
    if (!fix) return;
    const here = places.find((p) => isWithin(fix, p.at, p.radiusM) && !alerted.current.has(p.id) && !skip(p.id));
    // Leaving a place lets it alert again next time.
    for (const id of alerted.current) {
      const p = places.find((x) => x.id === id);
      if (p && !isWithin(fix, p.at, p.radiusM * 2)) alerted.current.delete(id);
    }
    if (!here) return;
    alerted.current.add(here.id);
    setArrived(here.id);
    buzzAndBeep();
  }, [fix, places, skip]);

  return { arrived, dismiss: () => setArrived(null) };
}

/** Vibrates (Android phones; iPhones don't allow it) and plays a short two-note beep. */
export function buzzAndBeep() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    navigator.vibrate?.(BUZZ_PATTERN);
  } catch {}
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    BEEP_NOTES.forEach((hz, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = hz;
      const start = ctx.currentTime + i * (BEEP_SECONDS + 0.05);
      gain.gain.setValueAtTime(0.25, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + BEEP_SECONDS);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + BEEP_SECONDS);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch {}
}
