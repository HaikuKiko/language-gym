/**
 * Plain-text versions of the feedback, for the Share report button. Plain
 * text pastes cleanly into Teams, Outlook, WhatsApp or an email.
 */
import { Platform, Share } from 'react-native';

import { formatBand, type IeltsFeedback } from '@/lib/ielts';
import type { WritingFeedback } from '@/lib/writing';

const RULE = '────────────';

function list(items: string[], bullet = '•'): string {
  return items.map((item) => `${bullet} ${item}`).join('\n');
}

export function ieltsReport(f: IeltsFeedback, essay: string, about?: string): string {
  const lines: string[] = [];
  lines.push('IELTS Writing Task 2: feedback report');
  if (about) lines.push(about);
  lines.push('');
  lines.push(
    `Overall band: ${formatBand(f.overall_band)}` +
      (f.target_band !== null ? ` (target ${formatBand(f.target_band)})` : ''),
  );
  for (const c of f.criteria) {
    const note = c.band !== c.band_before_length ? ` (${c.band_before_length} before the word-count rule)` : '';
    lines.push(`• ${c.criterion}: ${c.band}${note}`);
  }
  lines.push(
    `${f.word_count} words${f.length_penalty_applied ? `, under ${f.min_words}: Task Response lowered by 1` : ''}`,
  );
  lines.push('', RULE, '', f.summary);

  if (f.task_check.parts.length > 0) {
    lines.push('', 'Did the essay answer the whole question?');
    lines.push(list(f.task_check.parts.map((p) => `${p.part}: ${p.covered === 'not' ? 'not yet' : p.covered}`)));
    if (f.task_check.position_comment) lines.push(f.task_check.position_comment);
  }

  lines.push('', 'The four criteria');
  for (const c of f.criteria) {
    lines.push('', `${c.criterion}: band ${c.band}`, c.comment);
    lines.push(`${c.band >= 9 ? 'Keeping band 9' : `To reach band ${c.band + 1}`}: ${c.next_band}`);
  }

  if (f.to_reach_target.length > 0) {
    lines.push('', 'Next steps', f.to_reach_target.map((s, i) => `${i + 1}. ${s}`).join('\n'));
  }
  if (f.strengths.length > 0) lines.push('', 'What went well', list(f.strengths));
  if (f.corrections.length > 0) {
    lines.push('', 'Corrections');
    lines.push(list(f.corrections.map((c) => `"${c.original}" → "${c.corrected}": ${c.explanation}`)));
  }
  if (f.paragraphing.comment) lines.push('', 'Paragraphs', f.paragraphing.comment);

  lines.push('', RULE, '', 'The essay', '', essay.trim());
  lines.push('', RULE, 'Marked by Language Gym with AI (Claude). A guide, not an official IELTS result.');
  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

export function writingReport(f: WritingFeedback, text: string, about?: string): string {
  const lines: string[] = [];
  lines.push('Writing feedback report');
  if (about) lines.push(about);
  lines.push('', `Estimated level: ${f.cefr_level}`, f.level_explanation);
  if (f.criteria.length > 0) lines.push('', list(f.criteria.map((c) => `${c.criterion}: ${c.level}. ${c.comment}`)));
  lines.push('', RULE, '', f.summary);
  if (f.strengths.length > 0) lines.push('', 'What went well', list(f.strengths));
  if (f.corrections.length > 0) {
    lines.push('', 'Corrections');
    lines.push(list(f.corrections.map((c) => `"${c.original}" → "${c.corrected}": ${c.explanation}`)));
  }
  if (f.paragraphing?.comment) lines.push('', 'Paragraphs', f.paragraphing.comment);
  if (f.focus_grammar) lines.push('', "This week's grammar", f.focus_grammar.comment);
  if (f.next_steps.length > 0) lines.push('', 'What to practise next', list(f.next_steps));
  lines.push('', RULE, '', 'The writing', '', text.trim());
  lines.push('', RULE, 'Feedback by Language Gym with AI (Claude). It may contain mistakes.');
  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

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
