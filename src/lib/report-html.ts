/**
 * The feedback as an HTML page that looks like the app's results screens:
 * the band card, criterion tiles, coloured cards and the essay with its
 * mistakes underlined. Used for the PDF and for printing. Each top-level
 * block is a `.blk`, so the PDF never cuts a card in half.
 */
import { CRITERION_SHORT, formatBand, type IeltsFeedback } from '@/lib/ielts';
import { Colors } from '@/core/ui/theme';
import { markCorrections, withoutGuessCorrections } from '@/core/marking/marks';
import { bullets, esc, header, markedEssay, notes, paragraphNote, section } from '@/core/marking/report-html';
import { type WritingFeedback } from '@/lib/writing';

const C = Colors.light;

const FOOT_IELTS = 'Marked by Language Gym with AI (Claude). A guide, not an official IELTS result.';
const FOOT_WRITING = 'Feedback by Language Gym with AI (Claude). It may contain mistakes.';

/** `guessed`: words guessed when reading handwriting, shown in pink. */
export function ieltsReportHtml(f: IeltsFeedback, essay: string, about?: string, guessed: string[] = []): string {
  const marked = markCorrections(essay, withoutGuessCorrections(f.corrections, guessed), f.paragraphing.new_paragraph_before);
  const parts: string[] = [];
  parts.push(header('Feedback report', 'LANGUAGE GYM · IELTS WRITING TASK 2', [`${f.word_count} words`, about].filter(Boolean).join(' · ')));

  const target =
    f.target_band !== null
      ? `<div class="div"></div><div class="half"><div class="lab">TARGET</div><div class="mid">${formatBand(f.target_band)}</div><div style="color:${C.onHeroMuted};font-size:13px">${
          f.overall_band >= f.target_band ? 'On target' : `${formatBand(f.target_band - f.overall_band)} to go`
        }</div></div>`
      : '';
  parts.push(
    `<div class="blk"><div class="hero"><div class="half"><div class="lab">OVERALL BAND</div><div class="big">${formatBand(
      f.overall_band,
    )}</div></div>${target}</div>${
      f.length_penalty_applied
        ? `<div class="muted" style="text-align:center;margin-top:6px">Under ${f.min_words} words: Task Response lowered by 1</div>`
        : ''
    }</div>`,
  );
  parts.push(
    `<div class="blk"><div class="tiles">${f.criteria
      .map((c) => `<div class="tile"><b>${esc(CRITERION_SHORT[c.code])}</b><div class="n">${c.band}</div></div>`)
      .join('')}</div></div>`,
  );
  parts.push(`<div class="blk"><div class="summary">${esc(f.summary)}</div></div>`);

  if (f.task_check.parts.length > 0) {
    parts.push(
      section(
        'Did the essay answer the whole question?',
        `<div class="card">${f.task_check.parts
          .map(
            (p) =>
              `<div class="row"><span>${esc(p.part)}</span><span class="${p.covered === 'fully' ? 'ok' : 'warn'}">${
                p.covered === 'fully' ? 'Fully' : p.covered === 'partly' ? 'Partly' : 'Not yet'
              }</span></div>`,
          )
          .join('')}${f.task_check.position_comment ? `<div class="muted" style="margin-top:6px">${esc(f.task_check.position_comment)}</div>` : ''}</div>`,
      ),
    );
  }

  parts.push(`<div class="blk"><h2>The four criteria</h2></div>`);
  for (const c of f.criteria) {
    const before = c.band !== c.band_before_length ? ` (${c.band_before_length} before the word-count rule)` : '';
    parts.push(
      `<div class="blk"><div class="card soft"><div class="lab">${esc(c.criterion.toUpperCase())} · BAND ${c.band}${esc(before)}</div><div style="margin:4px 0 8px">${esc(
        c.comment,
      )}</div><b>${c.band >= 9 ? 'Keeping band 9' : `To reach band ${c.band + 1}`}</b><div>${esc(c.next_band)}</div></div></div>`,
    );
  }

  if (f.to_reach_target.length > 0) {
    parts.push(`<div class="blk"><h2>Next steps</h2></div>`);
    f.to_reach_target.forEach((s, i) =>
      parts.push(
        `<div class="blk"><div class="card num"><div class="badge" style="background:${C.hero}">${i + 1}</div><div>${esc(s)}</div></div></div>`,
      ),
    );
  }
  if (f.strengths.length > 0) parts.push(section('What went well', bullets(f.strengths)));
  parts.push(markedEssay(marked, 'The essay', guessed));
  parts.push(notes(marked));
  parts.push(paragraphNote(f.paragraphing.comment));
  parts.push(`<div class="blk foot">${esc(FOOT_IELTS)}</div>`);
  return `<div class="lg-report">${parts.join('')}</div>`;
}

/** `guessed`: words guessed when reading handwriting, shown in pink. */
export function writingReportHtml(f: WritingFeedback, text: string, about?: string, guessed: string[] = []): string {
  const marked = markCorrections(text, withoutGuessCorrections(f.corrections, guessed), f.paragraphing?.new_paragraph_before ?? []);
  const parts: string[] = [];
  parts.push(header('Writing feedback', 'LANGUAGE GYM · WRITING', about ?? ''));
  parts.push(
    `<div class="blk"><div class="hero"><div class="half"><div class="lab">ESTIMATED LEVEL</div><div class="big">${esc(
      f.cefr_level,
    )}</div></div></div><div class="muted" style="text-align:center;margin-top:6px">${esc(f.level_explanation)}</div></div>`,
  );
  if (f.criteria.length > 0) {
    parts.push(
      `<div class="blk"><div class="tiles">${f.criteria
        .map((c) => `<div class="tile"><b>${esc(c.criterion)}</b><div class="n">${esc(c.level)}</div></div>`)
        .join('')}</div></div>`,
    );
  }
  parts.push(`<div class="blk"><div class="summary">${esc(f.summary)}</div></div>`);
  for (const c of f.criteria) {
    parts.push(
      `<div class="blk"><div class="card soft"><div class="lab">${esc(c.criterion.toUpperCase())} · ${esc(c.level)}</div><div>${esc(c.comment)}</div></div></div>`,
    );
  }
  if (f.strengths.length > 0) parts.push(section('What went well', bullets(f.strengths)));
  parts.push(markedEssay(marked, 'The writing', guessed));
  parts.push(notes(marked));
  parts.push(paragraphNote(f.paragraphing?.comment));
  if (f.focus_grammar) parts.push(section("This week's grammar", `<div class="card soft">${esc(f.focus_grammar.comment)}</div>`));
  if (f.next_steps.length > 0) parts.push(section('What to practise next', bullets(f.next_steps)));
  parts.push(`<div class="blk foot">${esc(FOOT_WRITING)}</div>`);
  return `<div class="lg-report">${parts.join('')}</div>`;
}
