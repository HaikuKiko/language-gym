import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * Like useState, but on the web the value is also kept in this browser tab
 * (sessionStorage), so an accidental refresh doesn't lose the writing or the
 * feedback. It is cleared when the tab is closed and never leaves the device.
 * In the phone apps there is no refresh, so it is plain useState there.
 */
export function useSavedState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const storageKey = `language-gym:saved:${key}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = globalThis.sessionStorage?.getItem(storageKey);
      return raw === null || raw === undefined ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      const storage = globalThis.sessionStorage;
      if (!storage) return;
      if (value === null || value === undefined || value === initial) storage.removeItem(storageKey);
      else storage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // Storage full or blocked: the screen still works, it just isn't kept.
    }
    // `initial` is only the starting value, so it is not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, value]);

  return [value, setValue];
}
