import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { countWords } from '@/core/app/text';
import { Button } from '@/core/ui/button';
import { ErrorNote, Notice } from '@/core/ui/notice';
import { Pill } from '@/core/ui/pill';
import { ThemedText } from '@/core/ui/themed-text';
import { Spacing } from '@/core/ui/theme';
import type { SafetyRules } from '@/core/classes/safety-rules';
import { Slideshow } from '@/core/media/slideshow';
import { distanceM, formatDistance, warmth, warmthWords, type Fix, type LatLng } from '@/core/place/geo';
import { useTheme } from '@/core/ui/use-theme';
import { AudioPlayer } from '@/core/media/audio-player';
import { pickPhoto } from '@/core/media/photo';
import { useAudioRecorder } from '@/core/media/use-audio-recorder';
import {
  AUDIO_MAX_SECONDS,
  CONSENT_SCRIPT,
  TASK_KINDS,
  distanceFromAdults,
  isStopVisited,
  isTaskDone,
  stopAccess,
  tourSlides,
  type TaskFiles,
  type TaskWork,
  type Tour,
  type TourStop,
  type TourTask,
  type TourWork,
} from '@/lib/tours';

type TourGroupScreenProps = {
  tour: Tour;
  groupName: string;
  rules: SafetyRules;
  /** Where this phone is (null while it doesn't know). */
  fix: Fix | null;
  /** A plain message when location can't be used. */
  positionProblem?: string | null;
  /** Where the supervising adults are. */
  adults: LatLng[];
  work: TourWork;
  /** Stops in the order the group saved work at them (the slideshow order). */
  visitOrder: string[];
  /** Saves a task's work; `files` are the photo or recording to upload (live tours). */
  onSaveTask: (stopId: string, taskId: string, work: TaskWork, files?: TaskFiles) => void | Promise<void>;
  /** Extra messages for the group, e.g. "Waiting for your teacher's location". */
  notices?: string[];
  /** The demo shows each stop's code, so it can be tried away from the place. */
  showCodes?: boolean;
};

/** A group's phone during a GPS tour: choose a place, walk there, do the tasks, then the slideshow. */
export function TourGroupScreen(props: TourGroupScreenProps) {
  const { tour, groupName, rules, fix, positionProblem, adults, work, visitOrder } = props;
  const theme = useTheme();
  const [stopId, setStopId] = useState<string | null>(null);
  const [showSlides, setShowSlides] = useState(false);
  /** Stops opened once stay open, so a group can finish writing on a bench nearby. */
  const [opened, setOpened] = useState<Record<string, boolean>>({});

  const visited = tour.stops.filter((s) => isStopVisited(s, work)).length;
  const fromAdult = distanceFromAdults(fix, adults);
  const tooFar = rules.needsAdultNearby && fromAdult !== null && fromAdult > rules.maxFromAdultM;
  const stop = tour.stops.find((s) => s.id === stopId) ?? null;

  if (showSlides) {
    return (
      <Slideshow
        title={`${groupName} · ${tour.title}`}
        slides={tourSlides(tour, work, visitOrder)}
        onClose={() => setShowSlides(false)}
      />
    );
  }

  const header = (
    <View style={styles.header}>
      <ThemedText type="smallBold" style={styles.flex}>
        {groupName}
      </ThemedText>
      <Pill
        tone="accent"
        label={rules.shareLiveLocation ? '📍 Your teacher can see where you are' : fix ? '📍 Location on' : '📍 Finding you…'}
      />
    </View>
  );

  const warnings = (
    <>
      {positionProblem ? <Notice text={positionProblem} /> : null}
      {(props.notices ?? []).map((n) => (
        <Notice key={n} text={n} />
      ))}
      {tooFar && fromAdult !== null ? (
        <Notice tone="danger" text={`⚠️ Come back towards your teacher. You are ${formatDistance(fromAdult)} away.`} />
      ) : null}
    </>
  );

  if (stop) {
    return (
      <View style={styles.column}>
        {header}
        {warnings}
        <StopView
          stop={stop}
          stopNumber={tour.stops.indexOf(stop) + 1}
          {...props}
          // A stop with saved work was opened before (e.g. before a reload), so it stays open.
          wasOpened={Boolean(opened[stop.id]) || isStopVisited(stop, work)}
          onOpened={() => setOpened((o) => ({ ...o, [stop.id]: true }))}
          onBack={() => setStopId(null)}
        />
      </View>
    );
  }

  const areas = [...new Set(tour.stops.map((s) => s.area))];
  return (
    <View style={styles.column}>
      {header}
      {warnings}
      <View style={styles.gapOne}>
        <ThemedText style={styles.big}>{tour.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Choose where to go. Visit at least {tour.aim} places. You've visited {visited}.
        </ThemedText>
      </View>
      {areas.map((area) => (
        <View key={area} style={styles.gapOne}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {area}
          </ThemedText>
          {tour.stops
            .filter((s) => s.area === area)
            .map((s) => {
              const done = isStopVisited(s, work);
              const d = fix ? distanceM(fix, s.at) : null;
              return (
                <Pressable
                  key={s.id}
                  accessibilityRole="button"
                  onPress={() => setStopId(s.id)}
                  style={({ pressed }) => [
                    styles.stopRow,
                    { backgroundColor: done ? theme.successSoft : theme.backgroundElement },
                    pressed && styles.pressed,
                  ]}>
                  <View style={[styles.number, { backgroundColor: done ? theme.success : theme.accent }]}>
                    <ThemedText type="smallBold" themeColor="onAccent">
                      {done ? '✓' : tour.stops.indexOf(s) + 1}
                    </ThemedText>
                  </View>
                  <View style={styles.flex}>
                    <ThemedText type="smallBold">{s.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {s.tasks.map((t) => TASK_KINDS[t.kind].icon).join(' ')}
                      {d !== null ? ` · ${formatDistance(d)}` : ''}
                    </ThemedText>
                  </View>
                </Pressable>
              );
            })}
        </View>
      ))}
      <Button
        label={`🖼️ Our slideshow (${visited})`}
        variant={visited >= tour.aim ? 'primary' : 'secondary'}
        disabled={visited === 0}
        onPress={() => setShowSlides(true)}
      />
    </View>
  );
}

function StopView({
  stop,
  stopNumber,
  rules,
  fix,
  adults,
  work,
  onSaveTask,
  showCodes,
  wasOpened,
  onOpened,
  onBack,
}: TourGroupScreenProps & {
  stop: TourStop;
  stopNumber: number;
  wasOpened: boolean;
  onOpened: () => void;
  onBack: () => void;
}) {
  const theme = useTheme();
  const [code, setCode] = useState('');
  const access = stopAccess({ stop, fix, adults, rules, codeTyped: code });
  const open = wasOpened || access.state === 'open';
  useEffect(() => {
    if (access.state === 'open' && !wasOpened) onOpened();
  }, [access.state, wasOpened, onOpened]);
  const adultNear = useMemo(
    () => !rules.needsAdultNearby || (distanceFromAdults(fix ?? stop.at, adults) ?? Infinity) <= rules.maxFromAdultM,
    [rules, fix, adults, stop.at],
  );

  return (
    <View style={styles.column}>
      <Button label="← All places" variant="secondary" onPress={onBack} style={styles.backButton} />
      <View style={styles.gapOne}>
        <ThemedText type="small" themeColor="textSecondary">
          {stop.area} · stop {stopNumber}
        </ThemedText>
        <ThemedText style={styles.big}>{open ? `✓ ${stop.name}` : stop.name}</ThemedText>
      </View>
      {!open ? (
        <>
          <Notice text={`Clue: ${stop.clue}`} />
          {access.distance !== null ? (
            <View style={styles.gapOne}>
              <ThemedText style={styles.distance}>{formatDistance(access.distance)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.centre}>
                {warmthWords(access.distance, stop.radiusM)}
              </ThemedText>
              <View style={[styles.bar, { backgroundColor: theme.backgroundElement }]}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.round(warmth(access.distance, stop.radiusM) * 100)}%`, backgroundColor: theme.warning },
                  ]}
                />
              </View>
            </View>
          ) : null}
          {access.state === 'need-adult' ? (
            <Notice
              tone="danger"
              text={`You're here! A teacher needs to be within ${rules.maxFromAdultM} m before the tasks open.`}
            />
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              The tasks open when you are within {stop.radiusM} m.
            </ThemedText>
          )}
          {stop.tasks.map((t) => (
            <View key={t.id} style={[styles.task, styles.locked, { borderColor: theme.border }]}>
              <ThemedText type="small">
                🔒 {TASK_KINDS[t.kind].icon} {t.prompt}
              </ThemedText>
            </View>
          ))}
          {stop.backupCode ? (
            <View style={styles.gapOne}>
              <ThemedText type="small" themeColor="textSecondary">
                No signal? Type the code word for this place{showCodes ? ` (demo: "${stop.backupCode}")` : ''}.
              </ThemedText>
              <TextInput
                value={code}
                onChangeText={setCode}
                autoCapitalize="none"
                placeholder="Code word"
                placeholderTextColor={theme.textSecondary}
                accessibilityLabel="Code word"
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              />
            </View>
          ) : null}
        </>
      ) : (
        <>
          {rules.noStrangerFaces ? (
            <Notice text="Under-18 rule: photos of places and things. No faces of people you don't know." />
          ) : null}
          {stop.tasks.map((t) => (
            <TaskView
              key={t.id}
              task={t}
              work={work[stop.id]?.[t.id]}
              rules={rules}
              adultNear={adultNear}
              onSave={(w, f) => onSaveTask(stop.id, t.id, w, f)}
            />
          ))}
          <Button label="Done here: choose the next place →" onPress={onBack} />
        </>
      )}
    </View>
  );
}

function TaskView({
  task,
  work,
  rules,
  adultNear,
  onSave,
}: {
  task: TourTask;
  work: TaskWork | undefined;
  rules: SafetyRules;
  adultNear: boolean;
  onSave: (work: TaskWork, files?: TaskFiles) => void | Promise<void>;
}) {
  const theme = useTheme();
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(work?.text ?? '');
  const [agreed, setAgreed] = useState(false);
  const recorder = useAudioRecorder(AUDIO_MAX_SECONDS);
  const kind = TASK_KINDS[task.kind];
  const done = isTaskDone(task, work);
  const savedText = work?.text ?? '';
  // Work loaded after the screen opened (e.g. after a reload) fills an empty box.
  useEffect(() => {
    setDraft((d) => d || savedText);
  }, [savedText]);

  async function save(next: TaskWork, files?: TaskFiles) {
    setProblem(null);
    setBusy(true);
    try {
      await onSave(next, files);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function takePhoto(source: 'camera' | 'library') {
    setProblem(null);
    try {
      const photo = await pickPhoto(source);
      // Re-saving the photo as a new JPEG also drops its hidden location data.
      if (photo) await save({ ...work, photoUri: `data:${photo.mediaType};base64,${photo.base64}` }, { photo });
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Could not take the photo. Please try again.');
    }
  }

  async function record() {
    const recording = await recorder.start();
    if (recording) await save({ ...work, audioUri: recording.uri }, { audio: recording });
  }

  const recordable = task.kind === 'audio' || (task.kind === 'talk' && adultNear);

  return (
    <View style={[styles.task, { borderColor: done ? theme.success : theme.border }]}>
      <ThemedText type="smallBold">
        {kind.icon} {task.prompt}
      </ThemedText>
      {task.kind === 'photo' ? (
        <>
          {work?.photoUri ? (
            <Image source={{ uri: work.photoUri }} style={styles.photo} resizeMode="cover" accessibilityLabel="Your photo" />
          ) : null}
          <View style={styles.row}>
            <Button
              label={busy ? 'Saving…' : work?.photoUri ? 'Take again' : '📷 Take a photo'}
              disabled={busy}
              onPress={() => takePhoto('camera')}
              style={styles.flex}
            />
            <Button label="Choose one" variant="secondary" disabled={busy} onPress={() => takePhoto('library')} style={styles.flex} />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            The location is removed from the photo.
          </ThemedText>
        </>
      ) : null}
      {task.kind === 'write' ? (
        <>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            multiline
            placeholder="Write here…"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel={task.prompt}
            style={[styles.input, styles.writing, { color: theme.text, borderColor: theme.border }]}
          />
          <View style={styles.rowCentre}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
              {countWords(draft)}
              {task.wordTarget ? ` / about ${task.wordTarget} words` : ' words'}
            </ThemedText>
            {draft.trim() && draft === savedText ? (
              <ThemedText type="smallBold" themeColor="successText">
                Saved ✓
              </ThemedText>
            ) : (
              <Button
                label={busy ? 'Saving…' : 'Save'}
                disabled={busy || !draft.trim()}
                onPress={() => save({ ...work, text: draft })}
              />
            )}
          </View>
        </>
      ) : null}
      {task.kind === 'talk' ? (
        adultNear ? (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              Read this out first, and only record if they say yes:
            </ThemedText>
            <Notice text={`"${CONSENT_SCRIPT}"`} />
            {rules.talkToAdultsOnly ? (
              <ThemedText type="small" themeColor="textSecondary">
                Only talk to adults. Never give your name or school.
                {rules.recordPeople === 'voice' ? ' Voice only, no video.' : ''}
              </ThemedText>
            ) : null}
            {!agreed && recorder.state !== 'recording' ? (
              <Button label="✓ They said yes" variant="secondary" onPress={() => setAgreed(true)} />
            ) : null}
          </>
        ) : (
          <Notice tone="danger" text={`A teacher needs to be within ${rules.maxFromAdultM} m for this task.`} />
        )
      ) : null}
      {recordable && (task.kind === 'audio' || agreed || work?.audioUri) ? (
        <>
          {work?.audioUri && recorder.state !== 'recording' ? <AudioPlayer uri={work.audioUri} label="Your recording" /> : null}
          {recorder.state === 'unsupported' ? (
            <ThemedText type="small" themeColor="textSecondary">
              This browser can&apos;t record sound. Try Chrome or Safari.
            </ThemedText>
          ) : recorder.state === 'recording' ? (
            <Button label={`⏹ Stop (${recorder.seconds} s of ${AUDIO_MAX_SECONDS})`} onPress={recorder.stop} />
          ) : (
            <Button
              label={busy ? 'Saving…' : recorder.state === 'asking' ? 'Starting…' : work?.audioUri ? '🎙 Record again' : '🎙 Start recording'}
              disabled={busy || recorder.state === 'asking'}
              onPress={record}
            />
          )}
        </>
      ) : null}
      {!kind.ready ? (
        <ThemedText type="small" themeColor="textSecondary">
          Video comes in a later update. For now, talk about it when you present.
        </ThemedText>
      ) : null}
      <ErrorNote message={problem ?? recorder.problem} align="left" />
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: Spacing.three },
  gapOne: { gap: Spacing.one },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: Spacing.two },
  rowCentre: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  big: { fontSize: 22, lineHeight: 28, fontWeight: 800 },
  distance: { fontSize: 44, lineHeight: 52, fontWeight: 800, textAlign: 'center' },
  centre: { textAlign: 'center' },
  right: { textAlign: 'right' },
  bar: { height: 12, borderRadius: 6, overflow: 'hidden' },
  barFill: { height: 12, borderRadius: 6 },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Spacing.three,
  },
  pressed: { opacity: 0.7 },
  number: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  task: { borderWidth: 1, borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  locked: { opacity: 0.5 },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: Spacing.two },
  input: { borderWidth: 1, borderRadius: Spacing.two, padding: Spacing.two, fontSize: 16 },
  writing: { minHeight: 110, textAlignVertical: 'top' },
  backButton: { alignSelf: 'flex-start' },
});
