/** Small text helpers shared by every tool. */

/** How many words a text has (anything between spaces counts as a word). */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
