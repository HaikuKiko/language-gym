import { useEffect, useState } from 'react';

import type { Fix } from '@/core/place/geo';

/**
 * Place kit: where this phone is, while `on` is true. Location is only asked for
 * and watched while it is on, and it stops as soon as `on` turns false (the end
 * of a tour). The position stays on the phone: this hook never sends it anywhere.
 */

// ===========================================================================
// Settings
// ===========================================================================

/** A reading older than this is not used. */
const MAX_AGE_MS = 10_000;
/** Give up waiting for a first reading after this long (and say so). */
const FIRST_FIX_TIMEOUT_MS = 30_000;

// ===========================================================================

export type PositionStatus = 'off' | 'asking' | 'on' | 'blocked' | 'unavailable';

export type PositionState = {
  status: PositionStatus;
  fix: Fix | null;
  /** A plain message when location can't be used. */
  problem: string | null;
};

const MESSAGES = {
  blocked:
    'Location is switched off for this page. Allow location in your browser settings, or type the code on the sign at each stop.',
  unavailable: "Your phone can't find where it is right now. Try outside, away from tall buildings, or type the code on the sign.",
  unsupported: "This browser can't share location. Type the code on the sign at each stop instead.",
};

export function usePosition(on: boolean): PositionState {
  const [state, setState] = useState<PositionState>({ status: 'off', fix: null, problem: null });

  useEffect(() => {
    if (!on) {
      setState({ status: 'off', fix: null, problem: null });
      return;
    }
    const geo = globalThis.navigator?.geolocation;
    if (!geo) {
      setState({ status: 'unavailable', fix: null, problem: MESSAGES.unsupported });
      return;
    }
    setState((s) => ({ ...s, status: s.fix ? 'on' : 'asking', problem: null }));
    const id = geo.watchPosition(
      (p) =>
        setState({
          status: 'on',
          fix: { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy ?? 0 },
          problem: null,
        }),
      (error) =>
        setState((s) => ({
          status: error.code === error.PERMISSION_DENIED ? 'blocked' : s.fix ? 'on' : 'unavailable',
          fix: error.code === error.PERMISSION_DENIED ? null : s.fix,
          problem: error.code === error.PERMISSION_DENIED ? MESSAGES.blocked : s.fix ? null : MESSAGES.unavailable,
        })),
      { enableHighAccuracy: true, maximumAge: MAX_AGE_MS, timeout: FIRST_FIX_TIMEOUT_MS },
    );
    return () => geo.clearWatch(id);
  }, [on]);

  return state;
}
