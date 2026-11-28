import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { bearingDeg, compass, distanceM, formatDistance, type LatLng } from '@/core/place/geo';
import { ThemedText } from '@/core/ui/themed-text';
import { useTheme } from '@/core/ui/use-theme';

/**
 * Place kit: "you in the middle, places around you". Each place is a ball in its
 * direction (north is up), nearer ones closer to the middle, with its direction
 * and distance written on it. It never shows a map, so the exact spot stays a
 * secret. Works on every platform (no map library).
 */

// ===========================================================================
// Settings
// ===========================================================================

/** The radar's largest size on screen (points). */
const MAX_SIZE = 360;
/** Places this close or closer sit right next to "You". */
const NEAR_M = 20;
/** Places further than the furthest one (at least this far) sit at the edge. */
const MIN_EDGE_M = 300;
const BALL = 58;

// ===========================================================================

export type RadarPlace = { id: string; at: LatLng; label: string; color: string };

export function PlaceRadar({
  me,
  places,
  onPress,
}: {
  me: LatLng;
  places: RadarPlace[];
  onPress?: (id: string) => void;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const size = Math.min(MAX_SIZE, width - 48);
  const half = size / 2;
  const inner = BALL * 0.9;
  const outer = half - BALL / 2 - 4;

  const items = places.map((p) => ({ ...p, d: distanceM(me, p.at), b: bearingDeg(me, p.at) }));
  const edge = Math.max(MIN_EDGE_M, ...items.map((i) => i.d));
  const scale = (d: number) => {
    const t = Math.log(Math.max(d, NEAR_M) / NEAR_M) / Math.log(edge / NEAR_M);
    return inner + (outer - inner) * Math.min(1, Math.max(0, t));
  };

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View
        style={[
          styles.ring,
          { width: size - 4, height: size - 4, borderRadius: size, left: 2, top: 2, borderColor: theme.border },
        ]}
      />
      <View
        style={[
          styles.ring,
          { width: size / 2, height: size / 2, borderRadius: size, left: size / 4, top: size / 4, borderColor: theme.border },
        ]}
      />
      <ThemedText type="smallBold" themeColor="textSecondary" style={[styles.north, { left: half - 6 }]}>
        N
      </ThemedText>
      <View style={[styles.me, { left: half - 14, top: half - 14, backgroundColor: '#5B3CC4' }]}>
        <ThemedText type="smallBold" themeColor="onAccent" style={styles.meText}>
          You
        </ThemedText>
      </View>
      {spreadOut(
        items.map((i) => {
          const a = (i.b * Math.PI) / 180;
          return { x: half + scale(i.d) * Math.sin(a), y: half - scale(i.d) * Math.cos(a) };
        }),
        size,
      ).map((spot, n) => {
        const i = items[n];
        const x = spot.x - BALL / 2;
        const y = spot.y - BALL / 2;
        const c = compass(i.b);
        return (
          <Pressable
            key={i.id}
            accessibilityRole="button"
            accessibilityLabel={`${i.label}: ${c.words}, ${formatDistance(i.d)}`}
            onPress={onPress ? () => onPress(i.id) : undefined}
            style={({ pressed }) => [
              styles.ball,
              { left: x, top: y, backgroundColor: i.color },
              pressed && styles.pressed,
            ]}>
            <ThemedText style={styles.ballNumber}>{i.label}</ThemedText>
            <ThemedText style={styles.ballText}>
              {c.arrow} {formatDistance(i.d)}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Nudges balls that overlap apart (and away from "You"), keeping them inside the box. */
function spreadOut(spots: { x: number; y: number }[], size: number): { x: number; y: number }[] {
  const out = spots.map((s) => ({ ...s }));
  const gap = BALL + 3;
  const centre = { x: size / 2, y: size / 2 };
  for (let round = 0; round < 60; round++) {
    let moved = false;
    for (let a = 0; a < out.length; a++) {
      for (let b = a + 1; b < out.length; b++) {
        const dx = out[b].x - out[a].x;
        const dy = out[b].y - out[a].y;
        const d = Math.hypot(dx, dy);
        if (d >= gap) continue;
        // Exactly on top of each other: push sideways.
        const ux = d > 0.01 ? dx / d : 1;
        const uy = d > 0.01 ? dy / d : 0;
        const push = (gap - d) / 2;
        out[a].x -= ux * push;
        out[a].y -= uy * push;
        out[b].x += ux * push;
        out[b].y += uy * push;
        moved = true;
      }
      const dc = Math.hypot(out[a].x - centre.x, out[a].y - centre.y);
      const keep = BALL / 2 + 16;
      if (dc < keep) {
        const ux = dc > 0.01 ? (out[a].x - centre.x) / dc : 0;
        const uy = dc > 0.01 ? (out[a].y - centre.y) / dc : -1;
        out[a].x = centre.x + ux * keep;
        out[a].y = centre.y + uy * keep;
      }
      out[a].x = Math.min(size - BALL / 2, Math.max(BALL / 2, out[a].x));
      out[a].y = Math.min(size - BALL / 2, Math.max(BALL / 2, out[a].y));
    }
    if (!moved) break;
  }
  return out;
}

const styles = StyleSheet.create({
  box: { alignSelf: 'center', position: 'relative' },
  ring: { position: 'absolute', borderWidth: 1, borderStyle: 'dashed' },
  north: { position: 'absolute', top: 6 },
  me: { position: 'absolute', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  meText: { fontSize: 9, lineHeight: 11 },
  ball: {
    position: 'absolute',
    width: BALL,
    height: BALL,
    borderRadius: BALL / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  pressed: { opacity: 0.7 },
  ballNumber: { color: '#fff', fontSize: 17, lineHeight: 19, fontWeight: 800 },
  ballText: { color: '#fff', fontSize: 11, lineHeight: 13, fontWeight: 600 },
});
