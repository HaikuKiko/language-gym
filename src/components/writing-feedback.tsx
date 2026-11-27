import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/core/ui/button';
import {
  Bullet,
  BulletSection,
  ParagraphNote,
  Section,
  WritingWithCorrections,
  usageText,
} from '@/core/marking/feedback-parts';
import { Pill } from '@/core/ui/pill';
import { Screen } from '@/core/ui/screen';
import { ShareReportButton } from '@/core/marking/share-report-button';
import { ThemedText } from '@/core/ui/themed-text';
import { ThemedView } from '@/core/ui/themed-view';
import { Spacing } from '@/core/ui/theme';
import { useTheme } from '@/core/ui/use-theme';
import { writingReportHtml } from '@/lib/report-html';
import { writingReport } from '@/lib/share-report';
import { markCorrections, withoutGuessCorrections } from '@/core/marking/marks';
import { type WritingResponse } from '@/lib/writing';

/** A plain-English line under each area's name, for lower levels. */
const CRITERION_HINTS: Record<string, string> = {
  Content: 'Did you answer the task?',
  Organisation: 'Order, paragraphs and linking words',
  Grammar: 'Correct sentences and punctuation',
  Vocabulary: 'Words for the topic',
};

/**
 * General English feedback: the estimated level, the four areas (Content,
 * Organisation, Grammar, Vocabulary), the writing with its mistakes, and
 * what to practise. Used by Writing practice and by class sets.
 */
export function WritingFeedbackView({
  response,
  text,
  onAgain,
  onEdit,
  header,
  footer,
  showUsage = true,
  reportTitle = 'Writing feedback',
  guessedWords = [],
  pageLines,
}: {
  response: WritingResponse;
  /** The writing the feedback is about, shown exactly as the student wrote it. */
  text: string;
  /** "Write something new"; no button without it. */
  onAgain?: () => void;
  /** "Try again: fix it yourself"; no button without it. */
  onEdit?: () => void;
  /** Shown above the level card, e.g. a class set student's name. */
  header?: ReactNode;
  /** Shown at the very end, e.g. "Back to the class set". */
  footer?: ReactNode;
  /** The "N feedback checks left today" line. */
  showUsage?: boolean;
  reportTitle?: string;
  /** Words guessed when reading a photo of the writing, highlighted in pink. */
  guessedWords?: string[];
  /**
   * The text was copied line by line from the paper (a class set): how many
   * lines each page has. Then the writing is shown with line numbers and the
   * corrections written in, and each note says which line it is on.
   */
  pageLines?: number[];
}) {
  const theme = useTheme();
  const f = response.feedback;
  // A guessed word on its own is never a mistake: it may be our misreading.
  const corrections = withoutGuessCorrections(f.corrections, guessedWords);
  const marked = markCorrections(text, corrections, f.paragraphing?.new_paragraph_before);

  return (
    <Screen>
      {header}
      <View style={[styles.levelCard, { backgroundColor: theme.hero }]}>
        <ThemedText type="smallBold" style={[styles.levelLabel, { color: theme.onHeroMuted }]}>
          ESTIMATED LEVEL
        </ThemedText>
        <ThemedText style={[styles.levelValue, { color: theme.onHero }]}>{f.cefr_level}</ThemedText>
        <ThemedText type="small" style={{ color: theme.onHeroMuted }}>
          {f.confidence === 'high'
            ? 'Clear evidence'
            : f.confidence === 'medium'
              ? 'Good evidence'
              : 'Only a rough estimate: write a bit more for a better one'}
        </ThemedText>
        <ThemedText style={[styles.levelReason, { color: theme.onHero }]}>
          {f.level_explanation}
        </ThemedText>
      </View>

      {f.criteria.length > 0 && (
        <Section title="Your level in each area">
          <View style={styles.criteriaGrid}>
            {f.criteria.map((c, i) => (
              <ThemedView key={i} type="backgroundElement" style={styles.criterionTile}>
                <View style={styles.criterionHeader}>
                  <ThemedText type="smallBold" style={styles.criterionName}>
                    {c.criterion}
                  </ThemedText>
                  <Pill label={c.level} tone="accent" />
                </View>
                {CRITERION_HINTS[c.criterion] ? (
                  <ThemedText type="small" style={{ color: theme.grammarLabel }}>
                    {CRITERION_HINTS[c.criterion]}
                  </ThemedText>
                ) : null}
                <ThemedText type="small" themeColor="textSecondary">
                  {c.comment}
                </ThemedText>
              </ThemedView>
            ))}
          </View>
        </Section>
      )}

      <ThemedText style={styles.summary}>{f.summary}</ThemedText>

      <BulletSection title="What you did well" items={f.strengths} />

      <WritingWithCorrections text={text} marked={marked} guessed={guessedWords} pageLines={pageLines} />

      {f.paragraphing?.comment ? <ParagraphNote comment={f.paragraphing.comment} /> : null}

      {f.focus_grammar && (
        <View style={[styles.focus, { backgroundColor: theme.accentSoft }]}>
          <ThemedText type="smallBold" style={{ color: theme.grammarLabel }}>
            THIS WEEK&apos;S GRAMMAR
          </ThemedText>
          <ThemedText style={{ color: theme.grammarText }}>{f.focus_grammar.comment}</ThemedText>
          {f.focus_grammar.used_well.map((s, i) => (
            <Bullet key={`w${i}`} text={`✓ ${s}`} />
          ))}
          {f.focus_grammar.to_improve.map((s, i) => (
            <Bullet key={`i${i}`} text={`→ ${s}`} />
          ))}
        </View>
      )}

      <BulletSection title="What to practise next" items={f.next_steps} />

      <View style={styles.section}>
        {onEdit && <Button label="Try again: fix it yourself" onPress={onEdit} />}
        <ShareReportButton
          title={reportTitle}
          report={() => writingReport(f, text)}
          html={() => writingReportHtml(f, text, undefined, guessedWords)}
          pdfName="writing-feedback"
        />
        {onAgain && <Button label="Write something new" variant="secondary" onPress={onAgain} />}
        {showUsage && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          {usageText(response.cached, response.remainingToday)}
        </ThemedText>
        )}
        {footer}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  centered: {
    textAlign: 'center',
  },
  levelCard: {
    padding: Spacing.four,
    borderRadius: 28,
    gap: Spacing.one,
    alignItems: 'center',
  },
  levelLabel: {
    letterSpacing: 1.5,
  },
  levelValue: {
    fontSize: 56,
    lineHeight: 64,
    fontWeight: 800,
  },
  levelReason: {
    marginTop: Spacing.two,
    textAlign: 'center',
  },
  summary: {
    fontSize: 18,
    lineHeight: 26,
  },
  focus: {
    padding: Spacing.four - 4,
    borderRadius: Spacing.four - 4,
    gap: Spacing.two,
  },
  criteriaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  criterionTile: {
    flexGrow: 1,
    flexBasis: 160,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  criterionHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.one,
  },
  criterionName: {
    flexShrink: 1,
    minWidth: 0,
  },
});
