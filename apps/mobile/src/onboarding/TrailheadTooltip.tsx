import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getTrailheadProgress } from './trailheadProgress';
import {
  getPendingTrailheadTooltip,
  getTrailheadDestination,
  setPendingTrailheadTooltip,
} from './trailheadExperience';

export function TrailheadTooltip() {
  const pathname = usePathname();
  const [action, setAction] = useState(getPendingTrailheadTooltip());

  useEffect(() => {
    const pending = getPendingTrailheadTooltip();
    if (!pending) {
      setAction(null);
      return;
    }

    const progress = getTrailheadProgress();
    const alreadyDone = progress.completed.some((item) => item.action === pending && item.complete);
    if (alreadyDone) {
      setPendingTrailheadTooltip(null);
      setAction(null);
      return;
    }

    setAction(pending);
  }, [pathname]);

  if (!action) return null;
  const destination = getTrailheadDestination(action);
  if (!destination || !destination.matches(pathname)) return null;

  function dismiss() {
    setPendingTrailheadTooltip(null);
    setAction(null);
  }

  return (
    <View pointerEvents="box-none" style={styles.layer}>
      <View style={styles.tooltip} accessibilityRole="summary">
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>TRAILHEAD</Text>
          <Text style={styles.title}>{destination.title}</Text>
          <Text style={styles.body}>{destination.tooltip}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss Trailhead tip" hitSlop={10} onPress={dismiss} style={styles.close}>
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 86,
    zIndex: 100,
    alignItems: 'center',
  },
  tooltip: {
    width: '100%',
    maxWidth: 440,
    minHeight: 88,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#B8943D',
    backgroundColor: '#102D25',
    paddingHorizontal: 15,
    paddingVertical: 13,
    flexDirection: 'row',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  copy: { flex: 1 },
  eyebrow: { color: '#DDB64B', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#FFF8E8', fontSize: 14, lineHeight: 18, fontWeight: '900', marginTop: 3 },
  body: { color: '#C3D0C9', fontSize: 11, lineHeight: 16, marginTop: 4 },
  close: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1D473A' },
  closeText: { color: '#FFF8E8', fontSize: 20, lineHeight: 22, fontWeight: '700', marginTop: -1 },
});
