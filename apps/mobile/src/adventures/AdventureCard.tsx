import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { AdventureSummary } from './types';

type Props = { adventure: AdventureSummary; onToggleSaved: (adventure: AdventureSummary) => void };

function priceLabel(adventure: AdventureSummary) {
  return adventure.starting_price_cents === 0 ? 'Free' : `From $${Math.round(adventure.starting_price_cents / 100)}`;
}

export function AdventureCard({ adventure, onToggleSaved }: Props) {
  const start = new Date(adventure.starts_at);
  return (
    <Pressable style={s.card} onPress={() => router.push({ pathname: '/adventures/[id]', params: { id: adventure.id } })}>
      <View style={s.media}>
        {adventure.hero_image_url ? <Image source={{ uri: adventure.hero_image_url }} style={s.image} /> : <View style={s.fallback}><Text style={s.fallbackIcon}>↗</Text></View>}
      </View>
      <View style={s.copy}>
        <View style={s.topRow}>
          <Text style={s.category}>{adventure.category.toUpperCase()}</Text>
          <Pressable hitSlop={8} onPress={(event) => { event.stopPropagation(); onToggleSaved(adventure); }}>
            <Text style={s.star}>{adventure.is_saved ? '★' : '☆'}</Text>
          </Pressable>
        </View>
        <Text style={s.title} numberOfLines={2}>{adventure.title}</Text>
        <Text style={s.meta} numberOfLines={1}>⌖ {adventure.city}, {adventure.state}</Text>
        <Text style={s.meta}>▣ {start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
        <Text style={[s.price, adventure.starting_price_cents === 0 && s.free]}>{priceLabel(adventure)}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { minHeight: 138, flexDirection: 'row', backgroundColor: '#121A18', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#2E3A35' },
  media: { width: 128, backgroundColor: '#23312B' },
  image: { width: '100%', height: '100%' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#19372E' },
  fallbackIcon: { color: '#F5C542', fontSize: 28, fontWeight: '900' },
  copy: { flex: 1, padding: 13, paddingLeft: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  category: { color: '#76D1B7', fontSize: 9, fontWeight: '900', letterSpacing: .7, backgroundColor: '#183029', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  star: { color: '#F7F7F4', fontSize: 20 },
  title: { color: '#F7F7F4', fontSize: 17, lineHeight: 21, fontWeight: '900', marginTop: 5 },
  meta: { color: '#ABB5B0', fontSize: 11, marginTop: 4 },
  price: { color: '#F5C542', fontWeight: '900', fontSize: 15, marginTop: 'auto', paddingTop: 7, alignSelf: 'flex-end' },
  free: { color: '#76D1B7' },
});
