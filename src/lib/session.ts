import type { Level } from '@/core/content/levels';
import type { Question } from '@/data/questions';
import type { Participant } from '@/core/live/groups';

/** How the rounds are run; shared by the single-screen and phone versions. */
export type RoundSettings = {
  level: Level;
  /** The week of the course (1 to 16), or null for any week. */
  week: number | null;
  roundMinutes: number;
  roundCount: number;
  /**
   * Round robin: everyone talks to everyone once. The number of rounds is
   * worked out from the number of students when the session starts, and
   * roundCount is ignored.
   */
  roundRobin: boolean;
  /**
   * When true the whole session runs on its own: each round starts after a
   * short changeover and moves on when its time is up.
   */
  autoAdvance: boolean;
  /**
   * Phone sessions: "friending" (speed friending: fun get-to-know-you
   * questions, no grammar) or "conversation" (questions with the week's
   * grammar point). Missing means conversation.
   */
  mode?: SessionMode;
  /** Speed friending: a custom question set (its id) instead of a theme. */
  customSetId?: string | null;
  /**
   * Speed friending: take turns. Each round is split between the group: one
   * person talks while their partner asks, then they swap.
   */
  takeTurns?: boolean;
};

export type SessionMode = 'friending' | 'conversation';

/** What the host chooses on the single-screen setup page. */
export type SessionSettings = RoundSettings & {
  participants: Participant[];
};

export const DEFAULT_ROUND_SETTINGS: RoundSettings = {
  level: 'B1',
  week: 1,
  roundMinutes: 2,
  roundCount: 3,
  roundRobin: true,
  autoAdvance: true,
};

/** Time given at the start of each automatic round to find a partner. */
export const CHANGEOVER_SECONDS = 20;

/** A session that is being played. */
export type Session = SessionSettings & {
  /** Matching questions in a random order; rounds draw from this in turn. */
  questions: Question[];
};
