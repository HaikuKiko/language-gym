import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import {
  Bullet,
  CorrectionNotes,
  MarkedWriting,
  NumberedCard,
  Section,
  ParagraphNote,
} from '@/components/feedback-parts';
import { Screen } from '@/components/screen';
import { ShareReportButton } from '@/components/share-report-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CRITERION_SHORT, formatBand, type IeltsResponse } from '@/lib/ielts';
import { ieltsReportHtml } from '@/lib/report-html';
import { ieltsReport } from '@/lib/share-report';
import { markCorrections } from '@/lib/writing';

/** IELTS Task 2 band scores and feedback, for students and for teacher marking. */
export function IeltsFeedbackView({
  response,
  text,
  subtitle,
  onImprove,
  improveLabel = 'Improve this essay',
  extra,
  header,
  essayTitle = 'Your essay',
  showUsage = true,
}: {
  response: IeltsResponse;
  text: string;
  /** Shown under the band card, e.g. "Opinion essay · Technology". */
  subtitle?: string;
  /** Without it there is no "improve" button (e.g. a shared essay). */
  onImprove?: () => void;
  improveLabel?: string;
  /** Shown above the buttons, e.g. the teacher's own marks. */
  extra?: ReactNode;
  /** Shown above the band card, e.g. the question and photos of a shared essay. */
  header?: ReactNode;
  essayTitle?: string;
  /** The "N feedback checks left today" line. */
  showUsage?: boolean;
}) {
  const theme = useTheme();
  const f = response.feedback;
  const marked = markCorrections(text, f.corrections, f.paragraphing.new_paragraph_before);
  const [open, setOpen] = useState(f.criteria[0]?.code ?? null);
  const openCriterion = f.criteria.find((c) => c.code === open) ?? null;
  const onTarget = f.target_band !== null && f.overall_band >= f.target_band;

  return (
    <Screen>
      {header}
      <View style={[styles.bandCard, { backgroundColor: theme.hero }]}>
        <View style={styles.bandHalf}>
          <ThemedText type="smallBold" style={[styles.bandLabel, { color: theme.onHeroMuted }]}>
            OVERALL BAND
          </ThemedText>
          <ThemedText style={[styles.bandValue, { color: theme.onHero }]}>{formatBand(f.overall_band)}</ThemedText>
        </View>
        {f.target_band !== null && (
          <>
            <View style={[styles.bandDivider, { backgroundColor: theme.onHeroMuted }]} />
            <View style={styles.bandHalf}>
              <ThemedText type="smallBold" style={[styles.bandLabel, { color: theme.onHeroMuted }]}>
                YOUR TARGET
              </ThemedText>
              <ThemedText style={[styles.targetBig, { color: theme.onHero }]}>{formatBand(f.target_band)}</ThemedText>
              <ThemedText type="small" style={{ color: theme.onHeroMuted }}>
                {onTarget ? 'On target' : `${formatBand(f.target_band - f.overall_band)} to go`}
              </ThemedText>
            </View>
          </>
        )}
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
        {f.word_count} words
        {subtitle ? ` · ${subtitle}` : ''}
        {f.length_penalty_applied ? ` · under ${f.min_words} words: Task Response lowered by 1` : ''}
      </ThemedText>

      <View style={styles.tiles}>
        {f.criteria.map((c) => {
          const selected = c.code === open;
          return (
            <Pressable
              key={c.code}
              accessibilityRole="button"
              accessibilityState={{ expanded: selected }}
              accessibilityLabel={`${c.criterion}, band ${c.band}`}
              onPress={() => setOpen(c.code)}
              style={[
                styles.tile,
                {
                  backgroundColor: selected ? theme.accentSoft : theme.backgroundElement,
                  borderColor: selected ? theme.accent : 'transparent',
                },
              ]}>
              <ThemedText type="smallBold">{CRITERION_SHORT[c.code]}</ThemedText>
              <ThemedText style={styles.tileBand}>{c.band}</ThemedText>
            </Pressable>
          );
        })}
      </View>

      {openCriterion && (
        <View style={[styles.detail, { backgroundColor: theme.accentSoft }]}>
          <ThemedText type="smallBold" style={{ color: theme.grammarLabel }}>
            {openCriterion.criterion.toUpperCase()} · BAND {openCriterion.band}
            {openCriterion.band !== openCriterion.band_before_length ? ` (${openCriterion.band_before_length} before the word-count rule)` : ''}
          </ThemedText>
          <ThemedText style={{ color: theme.grammarText }}>{openCriterion.comment}</ThemedText>
          <ThemedText type="smallBold" style={{ color: theme.grammarText }}>
            {openCriterion.band >= 9 ? 'Keeping band 9' : `To reach band ${openCriterion.band + 1}`}
          </ThemedText>
          <ThemedText style={{ color: theme.grammarText }}>{openCriterion.next_band}</ThemedText>
        </View>
      )}

      <ThemedText style={styles.summary}>{f.summary}</ThemedText>

      {f.task_check.parts.length > 0 && (
        <Section title="Did you answer the whole question?">
          <ThemedView type="backgroundElement" style={styles.card}>
            {f.task_check.parts.map((p, i) => (
              <View key={i} style={styles.row}>
                <ThemedText style={styles.flexText}>{p.part}</ThemedText>
                <ThemedText type="smallBold" style={{ color: p.covered === 'fully' ? theme.accent : theme.warning }}>
                  {p.covered === 'fully' ? 'Fully' : p.covered === 'partly' ? 'Partly' : 'Not yet'}
                </ThemedText>
              </View>
            ))}
            <ThemedText type="small" themeColor="textSecondary">
              {f.task_check.position_comment}
            </ThemedText>
          </ThemedView>
        </Section>
      )}

      {f.to_reach_target.length > 0 && (
        <Section title="Your next steps">
          {f.to_reach_target.map((s, i) => (
            <NumberedCard key={i} number={i + 1} color={theme.hero}>
              <ThemedText>{s}</ThemedText>
            </NumberedCard>
          ))}
        </Section>
      )}

      {f.strengths.length > 0 && (
        <Section title="What you did well">
          {f.strengths.map((s, i) => (
            <Bullet key={i} text={s} />
          ))}
        </Section>
      )}

      <MarkedWriting marked={marked} title={essayTitle} />
      <CorrectionNotes marked={marked} />
      {f.paragraphing.comment ? <ParagraphNote comment={f.paragraphing.comment} /> : null}

      {extra}

      <View style={styles.section}>
        {onImprove && <Button label={improveLabel} onPress={onImprove} />}
        <ShareReportButton
          title="IELTS Writing feedback"
          report={() => ieltsReport(f, text, subtitle)}
          html={() => ieltsReportHtml(f, text, subtitle)}
          pdfName="ielts-feedback"
        />
        <Button label="Back to home" variant="secondary" onPress={() => router.replace('/')} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          AI band scores are a guide, not an official IELTS result.{' '}
          {showUsage && response.cached ? 'You sent this before, so this is the same feedback. It did not use a check. ' : ''}
          {!showUsage
            ? ''
            : response.remainingToday === 1
            ? '1 feedback check left today.'
            : `${response.remainingToday} feedback checks left today.`}
        </ThemedText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  flexText: {
    flexShrink: 1,
  },
  centered: {
    textAlign: 'center',
  },
  bandCard: {
    flexDirection: 'row',
    padding: Spacing.four,
    borderRadius: 24,
    gap: Spacing.three,
  },
  bandHalf: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  bandDivider: {
    width: 1,
    opacity: 0.4,
  },
  bandLabel: {
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  bandValue: {
    fontSize: 52,
    lineHeight: 60,
    fontWeight: 800,
  },
  targetBig: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 800,
  },
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tile: {
    flexGrow: 1,
    flexBasis: 150,
    minHeight: 88,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 2,
    gap: Spacing.one,
  },
  tileBand: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: 800,
  },
  detail: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  summary: {
    fontSize: 18,
    lineHeight: 26,
  },
});
