import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/core/ui/button';
import { CalibrationCard } from '@/components/calibration-card';
import { IeltsFeedbackView } from '@/components/ielts-feedback';
import { Screen } from '@/core/ui/screen';
import { ThemedText } from '@/core/ui/themed-text';
import { Spacing } from '@/core/ui/theme';
import { useTheme } from '@/core/ui/use-theme';
import {
  CODE_NAMES,
  CODES,
  findMySharedMarks,
  formatBand,
  loadSharedMarks,
  type Bands,
  type SharedMark,
} from '@/lib/calibration';
import { loadSharedEssay, type SharedEssay } from '@/lib/shared-essay';
import { errorMessage } from '@/core/app/supabase';

/**
 * A colleague's shared results (/calibrate/<code>): the question, the photos,
 * the AI's feedback, everyone's marks so far, and a place to add yours. The
 * marks join the calibration.
 */
export default function SharedResultsRoute() {
  const theme = useTheme();
  const { code } = useLocalSearchParams<{ code: string }>();
  const [shared, setShared] = useState<SharedEssay | null | undefined>(undefined);
  const [earlier, setEarlier] = useState<{ id: number; teacher: Bands } | null>(null);
  const [marks, setMarks] = useState<SharedMark[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [bigPhoto, setBigPhoto] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const essay = await loadSharedEssay(String(code ?? ''));
      if (essay) {
        const [mine, all] = await Promise.all([findMySharedMarks(essay.code), loadSharedMarks(essay.code)]);
        setEarlier(mine);
        setMarks(all);
      }
      setShared(essay);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [code]);

  useEffect(() => {
    load();
  }, [load]);

  const home = <Button label="Home" variant="secondary" onPress={() => router.replace('/dashboard')} />;

  if (error || shared === undefined) {
    return (
      <Screen>
        <ThemedText type="subtitle">Shared results</ThemedText>
        {error ? (
          <>
            <ThemedText themeColor="warning">{error}</ThemedText>
            <Button label="Try again" onPress={load} />
          </>
        ) : (
          <ActivityIndicator color={theme.accent} />
        )}
        {home}
      </Screen>
    );
  }

  if (shared === null) {
    return (
      <Screen>
        <ThemedText type="subtitle">Shared results</ThemedText>
        <ThemedText themeColor="textSecondary">
          There is no essay with the code {String(code ?? '').toUpperCase()}. Check the link you were sent.
        </ThemedText>
        {home}
      </Screen>
    );
  }

  const header = (
    <>
      <View style={styles.header}>
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          SHARED RESULTS
        </ThemedText>
        <ThemedText type="subtitle">IELTS Writing Task 2</ThemedText>
        <ThemedText themeColor="textSecondary">
          A colleague shared the AI&apos;s marking of this essay. Add your own marks at the bottom: they join the
          calibration.
        </ThemedText>
      </View>
      <View style={[styles.box, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold">The question</ThemedText>
        <ThemedText>{shared.question || '(Not given: the AI worked it out from the essay.)'}</ThemedText>
      </View>
      {shared.photoUrls.length > 0 && (
        <View style={styles.section}>
          <ThemedText type="smallBold">The pages (tap to enlarge)</ThemedText>
          <View style={styles.pages}>
            {shared.photoUrls.map((url, i) => (
              <Pressable
                key={url}
                accessibilityRole="imagebutton"
                accessibilityLabel={`Page ${i + 1}, tap to enlarge`}
                onPress={() => setBigPhoto(url)}
                style={[styles.page, { borderColor: theme.border }]}>
                <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" />
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </>
  );

  const marking = (
    <>
      <MarksSoFar ai={shared.marking.ai} aiOverall={shared.marking.aiOverall} marks={marks} />
      <CalibrationCard
        marking={shared.marking}
        question={shared.question}
        essay={shared.essay}
        sharedCode={shared.code}
        earlier={earlier}
        optional={false}
        onSaved={() => {
          loadSharedMarks(shared.code).then(setMarks);
        }}
      />
    </>
  );

  const photoModal = (
    <Modal visible={bigPhoto !== null} transparent animationType="fade" onRequestClose={() => setBigPhoto(null)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close the photo"
        onPress={() => setBigPhoto(null)}
        style={styles.overlay}>
        {bigPhoto && <Image source={{ uri: bigPhoto }} style={styles.big} contentFit="contain" />}
        <ThemedText style={styles.closeHint}>Tap to close</ThemedText>
      </Pressable>
    </Modal>
  );

  // The AI's full feedback, with everyone's marks underneath.
  if (shared.feedback) {
    return (
      <>
        <IeltsFeedbackView
          response={{ feedback: shared.feedback, remainingToday: 0 }}
          text={shared.essay}
          subtitle="Shared by a colleague"
          header={header}
          essayTitle="The essay"
          showUsage={false}
          extra={marking}
        />
        {photoModal}
      </>
    );
  }

  // Shared before the full feedback was kept: the essay and the bands only.
  return (
    <Screen>
      {header}
      <View style={[styles.box, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold">The essay · {shared.marking.wordCount} words</ThemedText>
        <ThemedText selectable>{shared.essay}</ThemedText>
      </View>
      {marking}
      {home}
      {photoModal}
    </Screen>
  );
}

/** The AI's bands and every teacher's so far, one row each. */
function MarksSoFar({ ai, aiOverall, marks }: { ai: Bands; aiOverall: number; marks: SharedMark[] }) {
  const theme = useTheme();
  let others = 0;
  const rows: { name: string; bands: Bands; overall: number; mine?: boolean }[] = [
    { name: 'AI', bands: ai, overall: aiOverall },
    ...marks.map((m) => ({ name: m.mine ? 'You' : `Teacher ${++others}`, bands: m.teacher, overall: m.overall, mine: m.mine })),
  ];
  const cell = (text: ReactNode, bold = false, color?: string) => (
    <ThemedText type={bold ? 'smallBold' : 'small'} style={[styles.cell, color ? { color } : null]}>
      {text}
    </ThemedText>
  );

  return (
    <View style={[styles.box, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold" style={styles.title}>
        Everyone&apos;s marks so far
      </ThemedText>
      <View style={styles.tableRow}>
        <ThemedText type="small" style={styles.nameCell}>
          {' '}
        </ThemedText>
        {CODES.map((c) => (
          <View key={c} style={styles.cellWrap}>
            {cell(c.toUpperCase(), true, theme.textSecondary)}
          </View>
        ))}
        <View style={styles.cellWrap}>{cell('All', true, theme.textSecondary)}</View>
      </View>
      {rows.map((r, i) => (
        <View key={i} style={[styles.tableRow, styles.line, { borderTopColor: theme.border }]}>
          <ThemedText type={r.mine || i === 0 ? 'smallBold' : 'small'} style={styles.nameCell}>
            {r.name}
          </ThemedText>
          {CODES.map((c) => (
            <View key={c} style={styles.cellWrap}>
              {cell(r.bands[c], r.mine, i > 0 && r.bands[c] !== ai[c] ? theme.warning : undefined)}
            </View>
          ))}
          <View style={styles.cellWrap}>{cell(formatBand(r.overall), true)}</View>
        </View>
      ))}
      {marks.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          No teacher has added marks yet. Be the first!
        </ThemedText>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        {CODES.map((c) => `${c.toUpperCase()} = ${CODE_NAMES[c]}`).join(' · ')}. Orange: different from the AI.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
  },
  section: {
    gap: Spacing.two,
  },
  box: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  line: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  nameCell: {
    flex: 1,
  },
  cellWrap: {
    width: 44,
    alignItems: 'center',
  },
  cell: {
    textAlign: 'center',
  },
  pages: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  page: {
    width: 88,
    height: 118,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
  big: {
    width: '100%',
    height: '90%',
  },
  closeHint: {
    color: '#ffffff',
    marginTop: Spacing.two,
  },
});
