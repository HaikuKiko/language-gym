/**
 * Classes kit: what a group may do, from its age setting. Every screen asks
 * `safetyRules(...)` instead of checking ages itself, so the rules live here only.
 *
 * Agreed with the owner (27 Nov 2026): teachers mark students under 18 (the
 * default is "yes, some are"). If anyone in a group is under 18, the whole group
 * follows the under-18 rules. Under-18 groups share their place with the
 * supervising adults during an outdoor activity and must stay within sight of one
 * (any number of teachers and helper adults; adult students never count). They
 * may talk to people (adults only) while an adult is close by.
 */

// ===========================================================================
// Settings
// ===========================================================================

/** "Within sight": an under-18 group must stay this close to the nearest supervising adult. */
export const MAX_FROM_ADULT_M = 100;
/** How often an under-18 group's phone sends its newest place to the adults. */
export const LOCATION_SHARE_SECONDS = 30;
/** Photos, recordings and writing from an activity are deleted after this many days. */
export const MEDIA_RETENTION_DAYS = 30;

// ===========================================================================

export type AgeGroup = 'under-18' | 'adults';

export type SafetyRules = {
  ageGroup: AgeGroup;
  /** The group's phone shares its newest place with the supervising adults (never a trail). */
  shareLiveLocation: boolean;
  /** Places and tasks only open when a supervising adult is within `maxFromAdultM`. */
  needsAdultNearby: boolean;
  maxFromAdultM: number;
  /** Recording people: voice only, or video too. */
  recordPeople: 'voice' | 'voice-and-video';
  /** Show "places and things, no faces of people you don't know" on the camera. */
  noStrangerFaces: boolean;
  /** Only talk to adults; never give your name or school. */
  talkToAdultsOnly: boolean;
  /** The group's slideshow may get a public link. */
  publicLink: boolean;
};

/** The age setting for a group: under 18 if anyone in it is. */
export function groupAgeGroup(members: { under18: boolean }[]): AgeGroup {
  return members.some((m) => m.under18) ? 'under-18' : 'adults';
}

/** The rules for a group. `allowVideoOfPeople` is the teacher's switch for under-18 groups. */
export function safetyRules(ageGroup: AgeGroup, options: { allowVideoOfPeople?: boolean } = {}): SafetyRules {
  if (ageGroup === 'adults') {
    return {
      ageGroup,
      shareLiveLocation: false,
      needsAdultNearby: false,
      maxFromAdultM: MAX_FROM_ADULT_M,
      recordPeople: 'voice-and-video',
      noStrangerFaces: false,
      talkToAdultsOnly: false,
      publicLink: true,
    };
  }
  return {
    ageGroup,
    shareLiveLocation: true,
    needsAdultNearby: true,
    maxFromAdultM: MAX_FROM_ADULT_M,
    recordPeople: options.allowVideoOfPeople ? 'voice-and-video' : 'voice',
    noStrangerFaces: true,
    talkToAdultsOnly: true,
    publicLink: false,
  };
}
