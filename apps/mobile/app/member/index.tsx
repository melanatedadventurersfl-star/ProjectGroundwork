import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMemberBasecamp } from '../../src/member/api';

export default function MemberBasecampScreen() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { getMemberBasecamp().then(setData).catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load member details.')); }, []);
  if (!data && !error) return <SafeAreaView style={styles.center}><ActivityIndicator /></SafeAreaView>;
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>MEMBER BASECAMP</Text>
        <Text style={styles.title}>{data?.profile?.display_name ?? 'Your account'}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.card}><Text style={styles.cardTitle}>Profile</Text><Text style={styles.detail}>{data?.profile?.home_city ?? 'Location not set'}, {data?.profile?.home_state ?? ''}</Text><Text style={styles.detail}>Status: {data?.profile?.status ?? 'unknown'}</Text></View>
        <View style={styles.card}><Text style={styles.cardTitle}>Household</Text><Text style={styles.detail}>{data?.households?.length ?? 0} household connection(s)</Text></View>
        <View style={styles.card}><Text style={styles.cardTitle}>Ticket wallet</Text><Text style={styles.detail}>{data?.tickets?.length ?? 0} attendee credential(s)</Text></View>
        <View style={styles.card}><Text style={styles.cardTitle}>Support</Text><Text style={styles.detail}>{data?.support?.filter((item: any) => !['resolved','closed'].includes(item.status)).length ?? 0} open request(s)</Text></View>
        <View style={styles.card}><Text style={styles.cardTitle}>Communication</Text><Text style={styles.detail}>Push {data?.settings?.push_enabled === false ? 'off' : 'on'} · Email {data?.settings?.email_enabled === false ? 'off' : 'on'} · SMS {data?.settings?.sms_enabled ? 'on' : 'off'}</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0f1713' }, center: { flex: 1, backgroundColor: '#0f1713', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 48, gap: 12 }, eyebrow: { color: '#d3a94f', fontWeight: '900', letterSpacing: 1.1 }, title: { color: '#fff8e8', fontSize: 34, fontWeight: '900', marginBottom: 6 },
  card: { backgroundColor: '#17211c', borderRadius: 16, padding: 18, gap: 6 }, cardTitle: { color: '#fff8e8', fontSize: 19, fontWeight: '900' }, detail: { color: '#aeb8b2', lineHeight: 21 }, error: { color: '#ffb4a9' },
});
