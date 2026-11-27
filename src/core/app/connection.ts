/** A lost connection, in words a student understands. Other messages are shown as they are. */
export function friendlyConnectionMessage(message: string): string {
  return /fetch|network|load failed|timed? ?out/i.test(message)
    ? 'Your phone can’t reach the internet right now. Check your Wi-Fi or data, then tap Try again.'
    : message;
}
