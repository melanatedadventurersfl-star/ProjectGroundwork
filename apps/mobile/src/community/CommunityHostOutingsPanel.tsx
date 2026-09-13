import Ionicons from '@react-native-vector-icons/ionicons';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { AdventureSummary } from '../adventures/types';

function eventDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function CommunityHostOutingsPanel({ outings }: { outings: AdventureSummary[] }) {
  if (!outings.length) {
    return (
      <View style={styles.empty}>
        <Ionicons name="calendar-outline" size={23} color="#7F9D68" />
        <View style={styles.flex}>
          <Text style={styles.emptyTitle}>No host outings are published yet</Text>
          <Text style={styles.emptyCopy}>When this host publishes an event, it will appear here automatically.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {outings.map((outing) => (
        <Pressable key={outing.id} style={styles.card} onPress={() => router.push({ pathname: '/adventures/[id]', params: { id: outing.id } })}>
          {outing.hero_image_url ? <Image source={{ uri: outing.hero_image_url }} style={styles.image} /> : <View style={[styles.image, styles.fallback]}><Ionicons name="trail-sign-outline" size={24} color="#D7B45A" /></View>}
          <View style={styles.copy}>
            <Text style={styles.eyebrow}>OUTING</Text>
            <Text style={styles.title} numberOfLines={2}>{outing.title}</Text>
            <Text style={styles.meta}>{eventDate(outing.starts_at)}</Text>
            <Text style={styles.meta} numberOfLines={1}>{[outing.venue_name || outing.city, outing.state].filter(Boolean).join(', ')}</Text>
            <View style={styles.footer}>
              <View style={styles.tag}><Text style={styles.tagText}>{outing.category}</Text></View>
              <Text style={styles.open}>View outing ›</Text>
            </View>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: 10 },
  card: { borderRadius: 15, overflow: 'hidden', borderWidth: 1, borderColor: '#28362E', backgroundColor: '#17211C' },
  image: { width: '100%', height: 150, backgroundColor: '#101A15' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  copy: { padding: 13 },
  eyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  title: { color: '#FFF8E8', fontSize: 16, lineHeight: 20, fontWeight: '900', marginTop: 3 },
  meta: { color: '#AEB8B2', fontSize: 11, lineHeight: 16, marginTop: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10 },
  tag: { borderRadius: 999, backgroundColor: '#243127', paddingHorizontal: 8, paddingVertical: 5 },
  tagText: { color: '#DCE5DE', fontSize: 9.5, fontWeight: '800' },
  open: { color: '#D7B45A', fontSize: 11, fontWeight: '900' },
  empty: { borderRadius: 15, borderWidth: 1, borderColor: '#28362E', backgroundColor: '#17211C', padding: 14, flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  emptyTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '900' },
  emptyCopy: { color: '#AEB8B2', fontSize: 11.5, lineHeight: 17, marginTop: 3 },
});
