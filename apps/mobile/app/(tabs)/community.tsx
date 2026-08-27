import React, { type ComponentType, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { PersistentTopNav } from '../../src/navigation/PersistentTopNav';

type BoundaryProps = { children: React.ReactNode };
type BoundaryState = { error: Error | null };

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setOutpostScreen(null);
    setLoadError(null);

    import('../../src/community/OutpostHumanDigestScreen')
      .then((module) => {
        if (active) setOutpostScreen(() => module.default);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : String(error));
      });

    return () => {
      active = false;
    };
  }, [attempt]);

  return (
    <View style={styles.flex}>
      <PersistentTopNav />
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
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#0F1713' },
  loadingText: { color: '#FFF8E8', fontSize: 14, fontWeight: '700' },
  failure: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 12, backgroundColor: '#0F1713' },
  failureTitle: { color: '#FFF8E8', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  failureBody: { color: '#AEB8B2', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  retryButton: { marginTop: 6, borderRadius: 999, backgroundColor: '#D7B45A', paddingHorizontal: 18, paddingVertical: 11 },
  retryText: { color: '#101510', fontSize: 14, fontWeight: '900' },
});
