import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import { getEventCoverPosition, saveEventCoverPosition, type EventCoverPosition } from './eventMedia';

type PreviewMode = 'mobile' | 'desktop' | 'card';

const PREVIEW_HEIGHT: Record<PreviewMode, number> = {
  mobile: 210,
  desktop: 250,
  card: 300,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function EventCoverPositioner({
  adventureId,
  imageUrl,
  disabled = false,
  onSaved,
}: {
  adventureId: string;
  imageUrl: string;
  disabled?: boolean;
  onSaved?: (position: EventCoverPosition) => void;
}) {
  const [position, setPosition] = useState<EventCoverPosition>({ focalX: 0.5, focalY: 0.5, zoom: 1 });
  const [savedPosition, setSavedPosition] = useState<EventCoverPosition>({ focalX: 0.5, focalY: 0.5, zoom: 1 });
  const [mode, setMode] = useState<PreviewMode>('mobile');
  const [size, setSize] = useState({ width: 1, height: PREVIEW_HEIGHT.mobile });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const startRef = useRef({ focalX: 0.5, focalY: 0.5 });

  useEffect(() => {
    let active = true;
    setLoading(true);
    void getEventCoverPosition(adventureId)
      .then((next) => {
        if (!active) return;
        setPosition(next);
        setSavedPosition(next);
      })
      .catch(() => undefined)
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [adventureId, imageUrl]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled,
    onMoveShouldSetPanResponder: (_, gesture) => !disabled && (Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2),
    onPanResponderGrant: () => {
      startRef.current = { focalX: position.focalX, focalY: position.focalY };
      setStatus('');
    },
    onPanResponderMove: (_, gesture) => {
      const width = Math.max(1, size.width * position.zoom);
      const height = Math.max(1, size.height * position.zoom);
      setPosition((current) => ({
        ...current,
        focalX: clamp(startRef.current.focalX - gesture.dx / width, 0, 1),
        focalY: clamp(startRef.current.focalY - gesture.dy / height, 0, 1),
      }));
    },
  }), [disabled, position.focalX, position.focalY, position.zoom, size.height, size.width]);

  function adjustZoom(delta: number) {
    setStatus('');
    setPosition((current) => ({ ...current, zoom: clamp(Number((current.zoom + delta).toFixed(2)), 1, 3) }));
  }

  function reset() {
    setStatus('');
    setPosition({ focalX: 0.5, focalY: 0.5, zoom: 1 });
  }

  async function save() {
    if (disabled || saving) return;
    setSaving(true);
    setStatus('');
    try {
      await saveEventCoverPosition(adventureId, position);
      setSavedPosition(position);
      setStatus('Position saved');
      onSaved?.(position);
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : 'Unable to save cover position.');
    } finally {
      setSaving(false);
    }
  }

  const translateX = (0.5 - position.focalX) * size.width * 0.72;
  const translateY = (0.5 - position.focalY) * size.height * 0.72;
  const dirty = Math.abs(position.focalX - savedPosition.focalX) > 0.001
    || Math.abs(position.focalY - savedPosition.focalY) > 0.001
    || Math.abs(position.zoom - savedPosition.zoom) > 0.001;

  if (loading) return <View style={styles.loading}><ActivityIndicator color="#D7B45A" /></View>;

  return <View style={styles.wrap}>
    <View style={styles.previewTabs}>
      {(['mobile','desktop','card'] as PreviewMode[]).map((item) => <Pressable key={item} style={[styles.tab, mode === item && styles.tabActive]} onPress={() => setMode(item)}><Text style={[styles.tabText, mode === item && styles.tabTextActive]}>{item === 'card' ? 'Event card' : item.charAt(0).toUpperCase() + item.slice(1)}</Text></Pressable>)}
    </View>
    <View
      {...panResponder.panHandlers}
      onLayout={(event) => setSize({ width: event.nativeEvent.layout.width || 1, height: event.nativeEvent.layout.height || PREVIEW_HEIGHT[mode] })}
      style={[styles.preview, { height: PREVIEW_HEIGHT[mode] }]}
    >
      <Image
        source={{ uri: imageUrl }}
        resizeMode="cover"
        style={[styles.image, { transform: [{ translateX }, { translateY }, { scale: position.zoom }] }]}
      />
      <View pointerEvents="none" style={styles.safeFrame} />
      <View pointerEvents="none" style={styles.hint}><Text style={styles.hintText}>Drag to reposition</Text></View>
    </View>
    <View style={styles.zoomRow}>
      <Pressable disabled={disabled || position.zoom <= 1} style={styles.zoomButton} onPress={() => adjustZoom(-0.1)}><Text style={styles.zoomText}>−</Text></Pressable>
      <View style={styles.zoomValue}><Text style={styles.zoomLabel}>Zoom</Text><Text style={styles.zoomPercent}>{Math.round(position.zoom * 100)}%</Text></View>
      <Pressable disabled={disabled || position.zoom >= 3} style={styles.zoomButton} onPress={() => adjustZoom(0.1)}><Text style={styles.zoomText}>＋</Text></Pressable>
    </View>
    {!disabled ? <View style={styles.actions}>
      <Pressable style={styles.secondary} onPress={reset}><Text style={styles.secondaryText}>Reset</Text></Pressable>
      <Pressable disabled={!dirty || saving} style={[styles.primary, (!dirty || saving) && styles.disabled]} onPress={() => void save()}>{saving ? <ActivityIndicator color="#172017" /> : <Text style={styles.primaryText}>Save position</Text>}</Pressable>
    </View> : null}
    {status ? <Text style={[styles.status, status !== 'Position saved' && styles.error]}>{status}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10 },
  loading: { minHeight: 120, alignItems: 'center', justifyContent: 'center' },
  previewTabs: { flexDirection: 'row', gap: 6, marginBottom: 7 },
  tab: { minHeight: 32, borderRadius: 9, borderWidth: 1, borderColor: '#344039', paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: '#2F2815', borderColor: '#7C682D' },
  tabText: { color: '#859188', fontSize: 8.5, fontWeight: '800' },
  tabTextActive: { color: '#E5C76B' },
  preview: { borderRadius: 13, overflow: 'hidden', backgroundColor: '#0B100D', position: 'relative' },
  image: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  safeFrame: { ...StyleSheet.absoluteFillObject, borderWidth: 1, borderColor: 'rgba(255,248,232,.4)', margin: 12, borderRadius: 8 },
  hint: { position: 'absolute', left: 12, bottom: 12, backgroundColor: 'rgba(7,12,9,.78)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  hintText: { color: '#FFF8E8', fontSize: 8.5, fontWeight: '900' },
  zoomRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  zoomButton: { width: 42, height: 38, borderRadius: 11, borderWidth: 1, borderColor: '#3B473F', alignItems: 'center', justifyContent: 'center', backgroundColor: '#101712' },
  zoomText: { color: '#D7B45A', fontSize: 19, fontWeight: '900' },
  zoomValue: { flex: 1, minHeight: 38, borderRadius: 11, borderWidth: 1, borderColor: '#2E3932', backgroundColor: '#101712', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  zoomLabel: { color: '#829087', fontSize: 8.5, fontWeight: '800' },
  zoomPercent: { color: '#EDF0EE', fontSize: 10, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  secondary: { flex: 1, minHeight: 40, borderRadius: 11, borderWidth: 1, borderColor: '#3A473F', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#B8C1BB', fontSize: 9, fontWeight: '900' },
  primary: { flex: 1.4, minHeight: 40, borderRadius: 11, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#172017', fontSize: 9, fontWeight: '900' },
  disabled: { opacity: .48 },
  status: { color: '#8FD09E', fontSize: 8.5, fontWeight: '800', marginTop: 6 },
  error: { color: '#FF9D93' },
});
