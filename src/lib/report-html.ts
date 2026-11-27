/**
 * The feedback as an HTML page that looks like the app's results screens:
 * the band card, criterion tiles, coloured cards and the essay with its
 * mistakes underlined. Used for the PDF and for printing. Each top-level
 * block is a `.blk`, so the PDF never cuts a card in half.
 */
import { Colors } from '@/core/ui/theme';
import { CRITERION_SHORT, formatBand, type IeltsFeedback } from '@/lib/ielts';
import { markCorrections, type MarkedText, type WritingFeedback } from '@/lib/writing';

const C = Colors.light;

function esc(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const REPORT_CSS = `
.lg-report{font-family:Inter,"Segoe UI",system-ui,-apple-system,Roboto,Arial,sans-serif;color:${C.text};background:#fff;width:720px;padding:8px 0;font-size:15px;line-height:1.5;box-sizing:border-box}
.lg-report *{box-sizing:border-box}
.lg-report .blk{padding:8px 0}
.lg-report .eyebrow{font-size:12px;font-weight:700;letter-spacing:1.5px;color:${C.accent}}
.lg-report h1{font-size:28px;line-height:1.2;margin:4px 0 2px;font-weight:800}
.lg-report h2{font-size:18px;margin:0 0 8px;font-weight:700}
.lg-report .muted{color:${C.textSecondary};font-size:13px}
.lg-report .hero{display:flex;background:${C.hero};color:${C.onHero};border-radius:24px;padding:22px}
.lg-report .hero .half{flex:1;text-align:center}
.lg-report .hero .lab{font-size:12px;font-weight:700;letter-spacing:1.5px;color:${C.onHeroMuted}}
.lg-report .hero .big{font-size:52px;line-height:60px;font-weight:800}
.lg-report .hero .mid{font-size:28px;line-height:34px;font-weight:800}
.lg-report .hero .div{width:1px;background:${C.onHeroMuted};opacity:.4;margin:0 12px}
.lg-report .tiles{display:flex;gap:8px}
.lg-report .tile{flex:1;background:${C.backgroundElement};border-radius:16px;padding:12px 14px}
.lg-report .tile b{font-size:13px}
.lg-report .tile .n{font-size:30px;line-height:36px;font-weight:800}
.lg-report .card{background:${C.backgroundElement};border-radius:16px;padding:14px 16px}
.lg-report .soft{background:${C.accentSoft};color:${C.grammarText}}
.lg-report .soft .lab{font-size:12px;font-weight:700;letter-spacing:1px;color:${C.grammarLabel}}
.lg-report .row{display:flex;justify-content:space-between;gap:8px;padding:2px 0}
.lg-report .ok{color:${C.accent};font-weight:700}
.lg-report .warn{color:${C.warning};font-weight:700}
.lg-report .num{display:flex;gap:12px;align-items:flex-start}
.lg-report .badge{flex:none;width:28px;height:28px;border-radius:14px;color:#fff;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center}
.lg-report .summary{font-size:18px;line-height:26px}
.lg-report .essay{white-space:pre-wrap;font-size:16px;line-height:26px}
.lg-report .mk{text-decoration:underline wavy ${C.markA};text-decoration-skip-ink:none;text-underline-offset:3px}
.lg-report .mn{color:${C.markA};font-weight:700;font-size:12px}
.lg-report .pm{color:${C.markA};font-weight:700}
.lg-report .wa{color:${C.markA};font-weight:700}
.lg-report .wb{color:${C.markB};font-weight:700}
.lg-report ul{margin:0;padding-left:20px}
.lg-report .foot{color:${C.textSecondary};font-size:12px;text-align:center;padding-top:12px}
`;

function header(title: string, eyebrow: string, sub: string): string {
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return `<div class="blk"><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1><div class="muted">${esc(
    [date, sub].filter(Boolean).join(' · '),
  )}</div></div>`;
}

function section(title: string, body: string): string {
  return `<div class="blk"><h2>${esc(title)}</h2>${body}</div>`;
}

function markedEssay(marked: MarkedText, title: string): string {
  const body = marked.segments
    .map((s) =>
      s.paragraphMark
        ? '<span class="pm">\n¶ </span>'
        : s.number === null
          ? esc(s.text)
          : `<span class="mk">${esc(s.text)}</span><span class="mn"> ${s.number}</span>`,
    )
    .join('');
  const hint =
    marked.notes.length > 0 || marked.paragraphMarks > 0
      ? `<div class="muted" style="margin-top:6px">The words stay as written.${
          marked.notes.length > 0 ? ' The numbers show what to look at.' : ''
        }${marked.paragraphMarks > 0 ? ' ¶ shows where a new paragraph can start.' : ''}</div>`
      : '';
  return section(title, `<div class="card essay">${body}</div>${hint}`);
}

function notes(marked: MarkedText): string {
  if (marked.notes.length === 0) return '';
  const cards = marked.notes
    .map(
      ({ number, correction }) =>
        `<div class="blk"><div class="card num"><div class="badge" style="background:${C.markA}">${number}</div><div><div><span class="muted">Wrote </span><span class="wa">${esc(
          correction.original,
        )}</span><span class="muted"> → try </span><span class="wb">${esc(correction.corrected)}</span></div><div class="muted">${esc(
          correction.explanation,
        )}</div></div></div></div>`,
    )
    .join('');
  return `<div class="blk"><h2>What to look at</h2></div>${cards}`;
}

function paragraphNote(comment: string | undefined): string {
  if (!comment) return '';
  return section(
    'Paragraphs',
    `<div class="card num"><div class="badge" style="background:${C.markA}">¶</div><div>${esc(comment)}</div></div>`,
  );
}

function bullets(items: string[]): string {
  return `<div class="card"><ul>${items.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>`;
}

const FOOT_IELTS = 'Marked by Language Gym with AI (Claude). A guide, not an official IELTS result.';
const FOOT_WRITING = 'Feedback by Language Gym with AI (Claude). It may contain mistakes.';

export function ieltsReportHtml(f: IeltsFeedback, essay: string, about?: string): string {
  const marked = markCorrections(essay, f.corrections, f.paragraphing.new_paragraph_before);
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
  parts.push(markedEssay(marked, 'The essay'));
  parts.push(notes(marked));
  parts.push(paragraphNote(f.paragraphing.comment));
  parts.push(`<div class="blk foot">${esc(FOOT_IELTS)}</div>`);
  return `<div class="lg-report">${parts.join('')}</div>`;
}

export function writingReportHtml(f: WritingFeedback, text: string, about?: string): string {
  const marked = markCorrections(text, f.corrections, f.paragraphing?.new_paragraph_before ?? []);
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
  parts.push(markedEssay(marked, 'The writing'));
  parts.push(notes(marked));
  parts.push(paragraphNote(f.paragraphing?.comment));
  if (f.focus_grammar) parts.push(section("This week's grammar", `<div class="card soft">${esc(f.focus_grammar.comment)}</div>`));
  if (f.next_steps.length > 0) parts.push(section('What to practise next', bullets(f.next_steps)));
  parts.push(`<div class="blk foot">${esc(FOOT_WRITING)}</div>`);
  return `<div class="lg-report">${parts.join('')}</div>`;
}

/** A whole page, for printing or opening in a browser. */
export function reportPage(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(
    title,
  )}</title><style>${REPORT_CSS}
body{margin:0;background:#fff}
.lg-report{margin:0 auto;padding:24px 16px;max-width:760px;width:auto}
@page{size:A4;margin:14mm}
@media print{.lg-report{padding:0}.blk{break-inside:avoid}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>${body}</body></html>`;
}
