/**
 * Fair random picking (Content kit): the same seed gives the same order on
 * every phone, so a whole class agrees without talking to each other.
 */

/**
 * Shuffles a copy of the list. Pass a seed to get the same order every time,
 * which lets every phone in a session agree on the order.
 */
export function shuffle<T>(items: readonly T[], seed?: number): T[] {
  const random = seed === undefined ? Math.random : seededRandom(seed);
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Each person gets their own item: the list is shuffled once (by `seed`), and
 * a person's item moves one step along it each round, starting from their
 * seat. So neighbours have different items, and nobody gets the same one
 * twice until the list runs out. Null for an empty list.
 */
export function pickForSeat<T>(items: readonly T[], seed: number, seat: number, round: number): T | null {
  if (items.length === 0) return null;
  const ordered = shuffle(items, seed);
  return ordered[(Math.max(0, seat) + round) % ordered.length];
}

/** Small deterministic random number generator (mulberry32). */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
