import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/core/ui/themed-text';
import { Spacing } from '@/core/ui/theme';
import { loadScript, loadStylesheet } from '@/core/app/load-script';
import type { LatLng } from '@/core/place/geo';
import { useTheme } from '@/core/ui/use-theme';

/**
 * Place kit: a map (Leaflet with OpenStreetMap, free, loaded from cdnjs) with
 * labelled pins and circles. Web only for now; the phone apps show a note.
 */

// ===========================================================================
// Settings
// ===========================================================================

const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css';
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const MAX_ZOOM = 19;

// ===========================================================================

export type MapPin = {
  id: string;
  at: LatLng;
  label: string;
  /** Background colour of the label. */
  color: string;
  /** "stop" = a numbered place on the route; "person" = a group or an adult. */
  kind: 'stop' | 'person';
};

export type MapCircle = { id: string; at: LatLng; radiusM: number; color: string; dashed?: boolean };

type PlaceMapProps = {
  centre: LatLng;
  zoom?: number;
  /** Start zoomed so all these places show (instead of `centre` and `zoom`). */
  fit?: LatLng[];
  pins: MapPin[];
  circles?: MapCircle[];
  /** Tapping the map gives the place tapped (route building, the demo's pretend walk). */
  onTap?: (at: LatLng) => void;
  height?: number;
};

// Just the parts of Leaflet used here.
type LeafletLayer = { addTo: (m: unknown) => LeafletLayer };
type LeafletGroup = LeafletLayer & { clearLayers: () => void; addLayer: (l: LeafletLayer) => void };
type LeafletMap = {
  setView: (c: [number, number], z: number) => LeafletMap;
  fitBounds: (b: [number, number][], o?: object) => LeafletMap;
  on: (event: 'click', fn: (e: { latlng: LatLng }) => void) => void;
  invalidateSize: () => void;
  remove: () => void;
};
type Leaflet = {
  map: (el: HTMLElement, o?: object) => LeafletMap;
  tileLayer: (url: string, o: object) => LeafletLayer;
  layerGroup: () => LeafletGroup;
  circle: (c: [number, number], o: object) => LeafletLayer;
  marker: (c: [number, number], o: object) => LeafletLayer;
  divIcon: (o: object) => unknown;
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

export function PlaceMap({ centre, zoom = 16, fit, pins, circles = [], onTap, height = 320 }: PlaceMapProps) {
  const theme = useTheme();
  const box = useRef<HTMLElement | null>(null);
  const map = useRef<{ L: Leaflet; map: LeafletMap; layer: LeafletGroup } | null>(null);
  const tap = useRef(onTap);
  tap.current = onTap;
  const [problem, setProblem] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Make the map once.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    loadStylesheet(LEAFLET_CSS);
    loadScript<Leaflet>(LEAFLET_JS, 'L', 'Could not load the map.')
      .then((L) => {
        if (cancelled || !box.current) return;
        const m = L.map(box.current, { zoomControl: true });
        if (fit && fit.length > 1) m.fitBounds(fit.map((p) => [p.lat, p.lng]), { padding: [24, 24] });
        else m.setView([centre.lat, centre.lng], zoom);
        L.tileLayer(TILES, { maxZoom: MAX_ZOOM, attribution: ATTRIBUTION }).addTo(m);
        const layer = L.layerGroup();
        layer.addTo(m);
        m.on('click', (e) => tap.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
        map.current = { L, map: m, layer };
        observer = new ResizeObserver(() => m.invalidateSize());
        observer.observe(box.current);
        setReady(true);
      })
      .catch((e: Error) => !cancelled && setProblem(e.message));
    return () => {
      cancelled = true;
      observer?.disconnect();
      map.current?.map.remove();
      map.current = null;
    };
    // The starting view only; later changes come through the pins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw pins and circles when they change.
  useEffect(() => {
    const current = map.current;
    if (!ready || !current) return;
    const { L, layer } = current;
    layer.clearLayers();
    for (const c of circles) {
      layer.addLayer(
        L.circle([c.at.lat, c.at.lng], {
          radius: c.radiusM,
          color: c.color,
          weight: 2,
          dashArray: c.dashed ? '6 6' : undefined,
          fillOpacity: 0.08,
          interactive: false,
        }),
      );
    }
    for (const p of pins) {
      const round = p.kind === 'stop';
      const html = `<div style="transform:translate(-50%,-50%);display:inline-block;white-space:nowrap;background:${p.color};color:#fff;font:700 12px system-ui,sans-serif;padding:${round ? '4px 8px' : '3px 8px'};border-radius:${round ? '14px' : '8px'};border:2px solid #fff;box-shadow:0 1px 4px #0005">${escapeHtml(p.label)}</div>`;
      layer.addLayer(
        L.marker([p.at.lat, p.at.lng], {
          icon: L.divIcon({ html, className: '', iconSize: [0, 0] }),
          interactive: false,
          zIndexOffset: round ? 0 : 1000,
        }),
      );
    }
  }, [ready, pins, circles]);

  if (Platform.OS !== 'web') {
    return (
      <View style={[styles.note, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="small" themeColor="textSecondary">
          The map opens in the web version.
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { height, borderColor: theme.border }]}>
      <View
        ref={(node) => {
          box.current = node as unknown as HTMLElement | null;
        }}
        style={StyleSheet.absoluteFill}
      />
      {problem ? (
        <View style={[styles.problem, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="small">{problem}</ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: Spacing.three,
    borderWidth: 1,
    overflow: 'hidden',
  },
  note: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  problem: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
});
