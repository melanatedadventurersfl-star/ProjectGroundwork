import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import { getEventCoverPosition, saveEventCoverPosition, type EventCoverPosition } from './eventMedia';

type PreviewMode = 'mobile' | 'desktop' | 'card';

const EDITOR_PREVIEW_HEIGHT: Record<PreviewMode, number> = {
  mobile: 340,
  desktop: 430,
  card: 360,
};

const DRAG_SCALE = 0.72;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function EventCoverPositioner({
  adventureId,
  imageUrl,
  disabled = false,
  standalone = false,
  onSaved,
}: {
  adventureId: string;
  imageUrl: string;
  disabled?: boolean;
  standalone?: boolean;
  onSaved?: (position: EventCoverPosition) => void;
}) {
  const [position, setPosition] = useState<EventCoverPosition>({ focalX: 0.5, focalY: 0.5, zoom: 1 });
  const [savedPosition, setSavedPosition] = useState<EventCoverPosition>({ focalX: 0.5, focalY: 0.5, zoom: 1 });
  const [mode, setMode] = useState<PreviewMode>('mobile');
  const [size, setSize] = useState({ width: 1, height: EDITOR_PREVIEW_HEIGHT.mobile });
  const [loading, setLoading] = useState(standalone);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [drag] = useState(() => new Animated.ValueXY({ x: 0, y: 0 }));

  useEffect(() => {
    if (!standalone) return;
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
  }, [adventureId, imageUrl, standalone]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => standalone && !disabled,
    onMoveShouldSetPanResponder: (_, gesture) => standalone && !disabled && (Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2),
    onPanResponderGrant: () => {
      setStatus('');
      drag.setValue({ x: 0, y: 0 });
    },
    onPanResponderMove: Animated.event([null, { dx: drag.x, dy: drag.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_, gesture) => {
      setPosition((current) => ({
        ...current,
        focalX: clamp(current.focalX - gesture.dx / Math.max(1, size.width * DRAG_SCALE * current.zoom), 0, 1),
        focalY: clamp(current.focalY - gesture.dy / Math.max(1, size.height * DRAG_SCALE * current.zoom), 0, 1),
      }));
      drag.setValue({ x: 0, y: 0 });
    },
    onPanResponderTerminate: () => drag.setValue({ x: 0, y: 0 }),
  }), [disabled, drag, size.height, size.width, standalone]);

  function adjustZoom(delta: number) {
    setStatus('');
    setPosition((current) => ({ ...current, zoom: clamp(Number((current.zoom + delta).toFixed(2)), 1, 3) }));
  }

  function reset() {
    setStatus('');
    drag.setValue({ x: 0, y: 0 });
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

  if (!standalone) {
    return <Pressable
      disabled={disabled}
      style={[styles.launcher, disabled && styles.disabled]}
      onPress={() => router.push(`/host/cover-position/${adventureId}` as never)}
    >
      <View style={styles.launcherCopy}>
        <Text style={styles.launcherTitle}>Reposition photo</Text>
        <Text style={styles.launcherBody}>Open the cover editor to drag, zoom, and preview the image.</Text>
      </View>
      <Text style={styles.launcherArrow}>›</Text>
    </Pressable>;
  }

  const translateX = (0.5 - position.focalX) * size.width * DRAG_SCALE;
  const translateY = (0.5 - position.focalY) * size.height * DRAG_SCALE;
  const animatedTranslateX = Animated.add(drag.x, translateX);
  const animatedTranslateY = Animated.add(drag.y, translateY);
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
      onLayout={(event) => setSize({ width: event.nativeEvent.layout.width || 1, height: event.nativeEvent.layout.height || EDITOR_PREVIEW_HEIGHT[mode] })}
      style={[styles.preview, { height: EDITOR_PREVIEW_HEIGHT[mode] }]}
    >
      <Animated.Image
        source={{ uri: imageUrl }}
        resizeMode="cover"
        style={[styles.image, { transform: [{ translateX: animatedTranslateX }, { translateY: animatedTranslateY }, { scale: position.zoom }] }]}
      />
      <View pointerEvents="none" style={styles.safeFrame} />
      <View pointerEvents="none" style={styles.hint}><Text style={styles.hintText}>Drag to reposition</Text></View>
    </View>
    <Text style={styles.previewHelp}>Keep the important part of the photo inside the guide. Switch previews to check other event surfaces.</Text>
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
  launcher: { minHeight: 58, borderRadius: 12, borderWidth: 1, borderColor: '#574A28', backgroundColor: '#1C190F', paddingHorizontal: 12, paddingVertical: 10, marginTop: 9, flexDirection: 'row', alignItems: 'center', gap: 10 },
  launcherCopy: { flex: 1 },
  launcherTitle: { color: '#E7C464', fontSize: 10, fontWeight: '900' },
  launcherBody: { color: '#8D8A78', fontSize: 8.5, lineHeight: 13, marginTop: 2 },
  launcherArrow: { color: '#D7B45A', fontSize: 22 },
  wrap: { marginTop: 0 },
  loading: { minHeight: 360, alignItems: 'center', justifyContent: 'center' },
  previewTabs: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  tab: { minHeight: 40, flex: 1, borderRadius: 10, borderWidth: 1, borderColor: '#344039', paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: '#2F2815', borderColor: '#7C682D' },
  tabText: { color: '#859188', fontSize: 10, fontWeight: '800' },
  tabTextActive: { color: '#E5C76B' },
  preview: { borderRadius: 16, overflow: 'hidden', backgroundColor: '#0B100D', position: 'relative', borderWidth: 1, borderColor: '#334039' },
  image: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  safeFrame: { ...StyleSheet.absoluteFillObject, borderWidth: 2, borderColor: 'rgba(255,248,232,.48)', margin: 18, borderRadius: 10 },
  hint: { position: 'absolute', left: 14, bottom: 14, backgroundColor: 'rgba(7,12,9,.82)', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 6 },
  hintText: { color: '#FFF8E8', fontSize: 9, fontWeight: '900' },
  previewHelp: { color: '#77847C', fontSize: 8.5, lineHeight: 13, marginTop: 8 },
  zoomRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  zoomButton: { width: 52, height: 46, borderRadius: 11, borderWidth: 1, borderColor: '#3B473F', alignItems: 'center', justifyContent: 'center', backgroundColor: '#101712' },
  zoomText: { color: '#D7B45A', fontSize: 19, fontWeight: '900' },
  zoomValue: { flex: 1, minHeight: 46, borderRadius: 11, borderWidth: 1, borderColor: '#2E3932', backgroundColor: '#101712', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  zoomLabel: { color: '#829087', fontSize: 9, fontWeight: '800' },
  zoomPercent: { color: '#EDF0EE', fontSize: 11, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  secondary: { flex: 1, minHeight: 48, borderRadius: 11, borderWidth: 1, borderColor: '#3A473F', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#B8C1BB', fontSize: 9, fontWeight: '900' },
  primary: { flex: 1.4, minHeight: 48, borderRadius: 11, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#172017', fontSize: 9, fontWeight: '900' },
  disabled: { opacity: .48 },
  status: { color: '#8FD09E', fontSize: 8.5, fontWeight: '800', marginTop: 6 },
  error: { color: '#FF9D93' },
});
