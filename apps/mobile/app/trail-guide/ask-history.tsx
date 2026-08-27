import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { loadAskGoHistory, type AskGoHistoryThread } from '../../src/trailGuide/askHistory';
import { AppIcon } from '../../src/ui/AppIcon';

function planSummary(thread: AskGoHistoryThread) {
  const latestWithPlan = [...thread.exchanges].reverse().find((exchange) => (exchange.result?.dayPlan.length ?? 0) > 0);
  const count = latestWithPlan?.result?.dayPlan.length ?? 0;
  return count > 0 ? `${count} plan stop${count === 1 ? '' : 's'}` : 'Conversation';
}

export default function AskGoHistoryScreen() {
  const [threads, setThreads] = useState<AskGoHistoryThread[]>([]);

  useEffect(() => {
    void loadAskGoHistory().then(setThreads);
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconButton} hitSlop={10}>
          <AppIcon name="chevron-back" color="#FFF8E8" size={22} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Ask Go History</Text>
          <Text style={styles.subtitle}>Pick up where you left off</Text>
        </View>
        <View style={styles.iconButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {threads.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><Text style={styles.spark}>✦</Text></View>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptyText}>Plans and Ask Go conversations you start will show up here.</Text>
            <Pressable style={styles.primary} onPress={() => router.replace('/trail-guide/ask' as never)}>
              <Text style={styles.primaryText}>Plan something</Text>
            </Pressable>
          </View>
        ) : threads.map((thread) => (
          <Pressable
            key={thread.id}
            style={styles.thread}
            onPress={() => router.replace({ pathname: '/trail-guide/ask', params: { threadId: thread.id } } as never)}
          >
            <View style={styles.threadTop}>
              <Text style={styles.threadTitle} numberOfLines={2}>{thread.title}</Text>
              <AppIcon name="chevron-forward" color="#D7B45A" size={18} />
            </View>
            <Text style={styles.meta}>{thread.cityName} · {planSummary(thread)}</Text>
            <Text style={styles.date}>{new Date(thread.updatedAt).toLocaleString()}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D1712' },
  header: { minHeight: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2A382F' },
  iconButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, alignItems: 'center' },
  title: { color: '#FFF8E8', fontSize: 18, fontWeight: '800' },
  subtitle: { color: '#98A49D', fontSize: 11, marginTop: 2 },
  content: { padding: 16, paddingBottom: 40, gap: 10 },
  thread: { backgroundColor: '#15221A', borderRadius: 14, borderWidth: 1, borderColor: '#26372D', padding: 14 },
  threadTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  threadTitle: { flex: 1, color: '#F8EFD9', fontWeight: '750', fontSize: 15, lineHeight: 20 },
  meta: { color: '#BAC4BE', fontSize: 12, marginTop: 8 },
  date: { color: '#718078', fontSize: 11, marginTop: 4 },
  empty: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 28 },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#203329', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  spark: { color: '#D7B45A', fontSize: 22 },
  emptyTitle: { color: '#FFF8E8', fontWeight: '800', fontSize: 19 },
  emptyText: { color: '#9EAAA3', textAlign: 'center', fontSize: 13, lineHeight: 19, marginTop: 8 },
  primary: { marginTop: 20, backgroundColor: '#D7B45A', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 11 },
  primaryText: { color: '#152019', fontWeight: '800', fontSize: 13 },
});
