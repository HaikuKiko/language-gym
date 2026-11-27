/** Sharing text from any tool: the phone's share menu, copying, or an email link. */
import { Platform, Share } from 'react-native';

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

/**
 * Opens the phone's share menu (Teams, Outlook, WhatsApp, Mail …). Where the
 * browser has no share menu (most computers), copies the report instead.
 */
export async function shareReport(title: string, text: string): Promise<ShareOutcome> {
  if (Platform.OS === 'web') {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav && typeof nav.share === 'function') {
      try {
        await nav.share({ title, text });
        return 'shared';
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return 'cancelled';
        // Fall through to copying.
      }
    }
    try {
      await nav?.clipboard?.writeText(text);
      return 'copied';
    } catch {
      return 'failed';
    }
  }
  try {
    const result = await Share.share({ title, message: text });
    return result.action === Share.dismissedAction ? 'cancelled' : 'shared';
  } catch {
    return 'failed';
  }
}

/** An email with the report, for computers without a share menu. */
export function emailLink(subject: string, text: string): string {
  // Mail apps cut very long links, so keep the body to a safe length.
  const body = text.length > 1800 ? `${text.slice(0, 1800)}\n…\n(The full report was copied: paste it here.)` : text;
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
