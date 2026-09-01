import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import OutpostAliveScreen from '../../src/community/OutpostAliveScreen';
import { PersistentTopNav } from '../../src/navigation/PersistentTopNav';

type BoundaryProps = { children: React.ReactNode };
type BoundaryState = { error: Error | null };

class OutpostErrorBoundary extends React.Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  private retry = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
      return;
    }
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <View style={styles.failure}>
          <Text style={styles.failureTitle}>Outpost couldn’t open</Text>
          <Text style={styles.failureBody}>Outpost needs to reload before it can continue.</Text>
          <Pressable style={styles.retryButton} onPress={this.retry}>
            <Text style={styles.retryText}>{Platform.OS === 'web' ? 'Reload Page' : 'Try Again'}</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

export default function CommunityTab() {
  return (
    <View style={styles.flex}>
      <PersistentTopNav />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <OutpostErrorBoundary>
          <OutpostAliveScreen />
        </OutpostErrorBoundary>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  failure: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 12, backgroundColor: '#0F1713' },
  failureTitle: { color: '#FFF8E8', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  failureBody: { color: '#AEB8B2', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  retryButton: { marginTop: 6, borderRadius: 999, backgroundColor: '#D7B45A', paddingHorizontal: 18, paddingVertical: 11 },
  retryText: { color: '#101510', fontSize: 14, fontWeight: '900' },
});
