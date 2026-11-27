import { shuffle } from '@/core/content/shuffle';

export type Participant = {
  /** Stable guest ID, e.g. "G-01". */
  id: string;
  name: string;
};

/** Two people normally; three when there is an odd number of participants. */
export type Group = Participant[];

/**
 * How many rounds can be played before anyone meets the same partner twice.
 */
export function uniqueRoundCount(participantCount: number): number {
  if (participantCount < 2) return 0;
  return participantCount % 2 === 0 ? participantCount - 1 : participantCount;
}

/**
 * Pairs everyone up for the given round (0-based) using the "circle method":
 * the first seat stays fixed and everyone else rotates one seat per round, so
 * each person meets a new partner every round until the cycle repeats.
 *
 * With an odd number of participants nobody sits out: the person without a
 * partner joins one of the pairs, making a group of three.
 */
export function groupsForRound(participants: Participant[], round: number): Group[] {
  if (participants.length < 2) return [];

  const seats: (Participant | null)[] = [...participants];
  if (seats.length % 2 === 1) seats.push(null);

  const count = seats.length;
  const [fixed, ...rest] = seats;
  const shift = round % (count - 1);
  const order = [fixed, ...rest.slice(shift), ...rest.slice(0, shift)];

  const groups: Group[] = [];
  let unpaired: Participant | null = null;

  for (let i = 0; i < count / 2; i++) {
    const a = order[i];
    const b = order[count - 1 - i];
    if (a && b) groups.push([a, b]);
    else unpaired = a ?? b;
  }

  if (unpaired) {
    if (groups.length === 0) return [[unpaired]];
    groups[round % groups.length].push(unpaired);
  }

  return groups;
}

/** A key for a pair of people, the same whichever comes first. */
const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * New groups that keep apart people who were together before (Live classroom
 * kit). `count` groups whose sizes differ by at most one; `pastGroups` are the
 * earlier groups (lists of ids). The same seed gives the same groups.
 */
export function mixGroups<P extends Participant>(
  people: readonly P[],
  count: number,
  pastGroups: readonly (readonly string[])[],
  seed: number,
): P[][] {
  const met = new Map<string, number>();
  for (const g of pastGroups)
    for (let i = 0; i < g.length; i++)
      for (let j = i + 1; j < g.length; j++) met.set(pairKey(g[i], g[j]), (met.get(pairKey(g[i], g[j])) ?? 0) + 1);
  const repeats = (p: P, group: readonly P[]) =>
    group.reduce((sum, q) => sum + (q.id === p.id ? 0 : (met.get(pairKey(p.id, q.id)) ?? 0)), 0);

  // Deal everyone in a seeded order, each to the least-met group among the smallest ones.
  const groups: P[][] = Array.from({ length: Math.max(1, count) }, () => []);
  for (const p of shuffle(people, seed)) {
    const smallest = Math.min(...groups.map((g) => g.length));
    let best = -1;
    for (let i = 0; i < groups.length; i++) {
      if (groups[i].length !== smallest) continue;
      if (best < 0 || repeats(p, groups[i]) < repeats(p, groups[best])) best = i;
    }
    groups[best].push(p);
  }

  // Then swap people between groups while it lowers the repeats.
  for (let pass = 0; pass < 5; pass++) {
    let improved = false;
    for (let a = 0; a < groups.length; a++)
      for (let b = a + 1; b < groups.length; b++)
        for (let i = 0; i < groups[a].length; i++)
          for (let j = 0; j < groups[b].length; j++) {
            const p = groups[a][i];
            const q = groups[b][j];
            const restA = groups[a].filter((x) => x !== p);
            const restB = groups[b].filter((x) => x !== q);
            const before = repeats(p, restA) + repeats(q, restB);
            const after = repeats(q, restA) + repeats(p, restB);
            if (after < before) {
              groups[a][i] = q;
              groups[b][j] = p;
              improved = true;
            }
          }
    if (!improved) break;
  }
  return groups;
}

/**
 * The order to list people in so that dealing them round the groups
 * (person i → group i % count) gives these groups. Bigger groups first.
 */
export function dealOrder<P>(groups: readonly (readonly P[])[]): P[] {
  const sorted = [...groups].sort((a, b) => b.length - a.length);
  const out: P[] = [];
  const longest = Math.max(0, ...sorted.map((g) => g.length));
  for (let i = 0; i < longest; i++) for (const g of sorted) if (i < g.length) out.push(g[i]);
  return out;
}
