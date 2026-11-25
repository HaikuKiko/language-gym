/**
 * The public product: speed friending as visitors see it. "Speed friending"
 * is only our internal name. To rename the product, change "name" in
 * product.json (it is also the browser tab's title, via app.config.js).
 */
import product from './product.json';

// ===========================================================================
// Settings
// ===========================================================================

/** The public name (not chosen yet; "TalkRounds" is a candidate). */
export const PRODUCT_NAME: string = product.name;
/** The one-sentence description on the landing page. */
export const PRODUCT_SENTENCE =
  'Speed-friending speaking practice: every student talks to everyone, with a new partner and a new question each round.';
/**
 * The landing page video (30 to 60 seconds): a link to an .mp4 file, or a
 * YouTube/Vimeo "embed" link. Empty = no video shown yet.
 */
export const LANDING_VIDEO_URL = '';

// ===========================================================================
