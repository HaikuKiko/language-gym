import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/core/ui/button';
import { Chip } from '@/core/ui/chip';
import { Pill } from '@/core/ui/pill';
import { ThemedText } from '@/core/ui/themed-text';
import { Spacing } from '@/core/ui/theme';
import type { SafetyRules } from '@/core/classes/safety-rules';
import { formatDistance, type LatLng } from '@/core/place/geo';
import { PlaceMap, type MapCircle, type MapPin } from '@/core/place/place-map';
import { useTheme } from '@/core/ui/use-theme';
import { distanceFromAdults, type Tour } from '@/lib/tours';

/** A group as the supervising adults see it. `at` is only known for groups that share their place. */
export type TourGroupStatus = {
  id: string;
  name: string;
  at: LatLng | null;
  visited: number;
  lastStop: string | null;
  /** Marked under 18 by the teacher. Left out: the tour's `rules` decide for every group (the demo). */
  under18?: boolean;
};

/** An adult who counts as "the teacher" for the within-sight rule. */
export type SupervisingAdult = { id: string; label: string; at: LatLng };

const STOP_COLOR = '#1570D1';
const GROUP_COLOR = '#5B3CC4';
const FAR_COLOR = '#C62828';
const ADULT_COLOR = '#1A8F52';

/** The supervising adults' screen during a tour: a map of groups and adults, and who is too far away. */
export function TourTeacherScreen({
  tour,
  rules,
  groups,
  adults,
  onEnd,
  onToggleUnder18,
  children,
}: {
  tour: Tour;
  rules: SafetyRules;
  groups: TourGroupStatus[];
  adults: SupervisingAdult[];
  /** The demo's End button; a live tour puts its own (with "Are you sure?") in `children`. */
  onEnd?: () => void;
  /** Live tours: the teacher marks a group under 18 (or not) from its card. */
  onToggleUnder18?: (groupId: string) => void;
  /** Shown above the End button (live tours: join QR, slideshows, code words). */
  children?: ReactNode;
}) {
  const theme = useTheme();
  const adultPlaces = useMemo(() => adults.map((a) => a.at), [adults]);

  const rows = groups.map((g) => {
    const away = distanceFromAdults(g.at, adultPlaces);
    const under18 = g.under18 ?? rules.needsAdultNearby;
    return { ...g, under18, away, tooFar: under18 && away !== null && away > rules.maxFromAdultM };
  });
  const under18Count = rows.filter((r) => r.under18).length;
  const watching = under18Count > 0;

  const pins: MapPin[] = useMemo(
    () => [
      ...tour.stops.map((s, i) => ({ id: `stop-${s.id}`, at: s.at, label: String(i + 1), color: STOP_COLOR, kind: 'stop' as const })),
      ...adults.map((a) => ({ id: `adult-${a.id}`, at: a.at, label: a.label, color: ADULT_COLOR, kind: 'person' as const })),
      ...rows
        .filter((g) => g.at)
        .map((g) => ({
          id: `group-${g.id}`,
          at: g.at as LatLng,
          label: g.tooFar && g.away !== null ? `${g.name} · ${formatDistance(g.away)}` : g.name,
          color: g.tooFar ? FAR_COLOR : GROUP_COLOR,
          kind: 'person' as const,
        })),
    ],
    // Rows are rebuilt each render; their places and names are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tour, adults, JSON.stringify(rows.map((r) => [r.id, r.at, r.tooFar, r.away && Math.round(r.away / 5)]))],
  );
  const circles: MapCircle[] = useMemo(
    () => [
      ...tour.stops.map((s) => ({ id: `r-${s.id}`, at: s.at, radiusM: s.radiusM, color: STOP_COLOR })),
      ...(watching
        ? adults.map((a) => ({ id: `sight-${a.id}`, at: a.at, radiusM: rules.maxFromAdultM, color: ADULT_COLOR, dashed: true }))
        : []),
    ],
    [tour, adults, rules, watching],
  );

  return (
    <View style={styles.column}>
      <View style={styles.header}>
        <ThemedText type="smallBold" style={styles.flex}>
          {tour.title} · live
        </ThemedText>
        <Pill
          tone="accent"
          label={
            under18Count === 0 ? 'Adults' : under18Count === rows.length ? 'Under 18' : `${under18Count} under 18`
          }
        />
      </View>
      <PlaceMap centre={tour.meetingPoint} fit={tour.stops.map((s) => s.at)} pins={pins} circles={circles} height={360} />
      <ThemedText type="small" themeColor="textSecondary">
        {watching
          ? `Green circles: within sight of an adult (${rules.maxFromAdultM} m). Under-18 groups share only their newest place, and it is deleted when the tour ends. Adult groups do not share where they are.`
          : 'Adult groups do not share where they are; you see the places they have reached.'}
      </ThemedText>
      <View style={styles.grid}>
        {rows.map((g) => (
          <View
            key={g.id}
            style={[
              styles.card,
              g.tooFar
                ? { backgroundColor: theme.markABg, borderColor: theme.warning }
                : { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}>
            <ThemedText type="smallBold">
              {g.name}
              {g.tooFar && g.away !== null ? ` ⚠️ ${formatDistance(g.away)} away` : ''}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {g.visited} of {tour.aim} places{g.lastStop ? ` · last: ${g.lastStop}` : ''}
            </ThemedText>
            {g.tooFar ? (
              <ThemedText type="small" themeColor="markA">
                Their phones say &quot;Come back towards your teacher&quot;.
              </ThemedText>
            ) : null}
            {onToggleUnder18 ? (
              <View style={styles.row}>
                <Chip label="Under 18" selected={g.under18} onPress={() => onToggleUnder18(g.id)} />
              </View>
            ) : null}
          </View>
        ))}
      </View>
      {children}
      {onEnd ? (
        <Button label="End the tour (location switches off on every phone)" variant="secondary" onPress={onEnd} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
  row: { flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  card: { flexGrow: 1, flexBasis: 200, borderWidth: 1, borderRadius: Spacing.two, padding: Spacing.two, gap: Spacing.half },
});
