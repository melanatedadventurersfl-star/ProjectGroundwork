import { router } from 'expo-router';
import React, { type ComponentType, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { getConnections, type Connection } from '../../src/community/circles';
import { PersistentTopNav } from '../../src/navigation/PersistentTopNav';
import { AppIcon } from '../../src/ui/AppIcon';

type BoundaryProps = { children: React.ReactNode };
type BoundaryState = { error: Error | null };

function initials(name?: string | null) {
  return (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'MA';
}

class OutpostErrorBoundary extends React.Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.failure}>
          <Text style={styles.failureTitle}>Outpost couldn’t open</Text>
          <Text style={styles.failureBody}>{this.state.error.message || 'A screen error stopped Outpost from rendering.'}</Text>
          <Pressable style={styles.retryButton} onPress={() => this.setState({ error: null })}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

export default function CommunityTab() {
  const [OutpostScreen, setOutpostScreen] = useState<ComponentType | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setOutpostScreen(null);
    setLoadError(null);

    import('../../src/community/OutpostAliveScreen')
      .then((module) => {
        if (active) setOutpostScreen(() => module.default);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : String(error));
      });

    void getConnections()
      .then((rows) => { if (active) setConnections(rows); })
      .catch(() => { if (active) setConnections([]); });

    return () => {
      active = false;
    };
  }, [attempt]);

  const trailmates = useMemo(() => connections.filter((row) => row.status === 'accepted'), [connections]);
  const pending = useMemo(() => connections.filter((row) => row.status === 'pending' && row.direction === 'incoming'), [connections]);
  const preview = trailmates.slice(0, 4);

  return (
    <View style={styles.flex}>
      <PersistentTopNav />
      <Pressable style={({ pressed }) => [styles.crewStrip, pressed && styles.pressed]} onPress={() => router.push('/connections' as never)}>
        <View style={styles.crewIcon}><AppIcon name="connections" color="#D7B45A" size={17} /></View>
        <View style={styles.crewCopy}>
          <Text style={styles.crewEyebrow}>YOUR TRAIL CREW</Text>
          <Text style={styles.crewDetail}>{trailmates.length} Trailmate{trailmates.length === 1 ? '' : 's'}{pending.length ? ` · ${pending.length} request${pending.length === 1 ? '' : 's'}` : ''}</Text>
        </View>
        <View style={styles.avatarRail}>
          {preview.map((row, index) => (
            <View key={row.connection_id} style={[styles.avatar, index > 0 && styles.avatarOverlap]}>
              {row.avatar_url ? <Image source={{ uri: row.avatar_url }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{initials(row.display_name)}</Text>}
            </View>
          ))}
          {trailmates.length > preview.length ? <View style={[styles.avatar, styles.avatarOverlap, styles.moreAvatar]}><Text style={styles.moreText}>+{trailmates.length - preview.length}</Text></View> : null}
        </View>
        <AppIcon name="chevron-forward" color="#D7B45A" size={17} />
      </Pressable>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {loadError ? (
          <View style={styles.failure}>
            <Text style={styles.failureTitle}>Outpost couldn’t load</Text>
            <Text style={styles.failureBody}>{loadError}</Text>
            <Pressable style={styles.retryButton} onPress={() => setAttempt((value) => value + 1)}>
              <Text style={styles.retryText}>Reload Outpost</Text>
            </Pressable>
          </View>
        ) : OutpostScreen ? (
          <OutpostErrorBoundary key={attempt}>
            <OutpostScreen />
          </OutpostErrorBoundary>
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#D7B45A" />
            <Text style={styles.loadingText}>Opening Outpost…</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  crewStrip: { minHeight: 58, marginHorizontal: 14, marginTop: 5, marginBottom: 2, borderRadius: 16, borderWidth: 1, borderColor: '#33483A', backgroundColor: '#132019', paddingHorizontal: 11, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 9 },
  pressed: { opacity: 0.68 },
  crewIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#223128', alignItems: 'center', justifyContent: 'center' },
  crewCopy: { flex: 1, minWidth: 0 },
  crewEyebrow: { color: '#7F9D68', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.85 },
  crewDetail: { color: '#FFF8E8', fontSize: 12, fontWeight: '800', marginTop: 2 },
  avatarRail: { flexDirection: 'row', alignItems: 'center', paddingLeft: 5 },
  avatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#132019', backgroundColor: '#26342A', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarOverlap: { marginLeft: -8 },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: '#D7B45A', fontSize: 8, fontWeight: '900' },
  moreAvatar: { backgroundColor: '#223128' },
  moreText: { color: '#FFF8E8', fontSize: 8, fontWeight: '900' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#0F1713' },
  loadingText: { color: '#FFF8E8', fontSize: 14, fontWeight: '700' },
  failure: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 12, backgroundColor: '#0F1713' },
  failureTitle: { color: '#FFF8E8', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  failureBody: { color: '#AEB8B2', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  retryButton: { marginTop: 6, borderRadius: 999, backgroundColor: '#D7B45A', paddingHorizontal: 18, paddingVertical: 11 },
  retryText: { color: '#101510', fontSize: 14, fontWeight: '900' },
});
