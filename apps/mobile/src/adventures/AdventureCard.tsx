import { Link } from 'expo-router';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';

import type { AdventureSummary } from './types';

type Props = {
  adventure: AdventureSummary;
  onToggleSaved: (adventure: AdventureSummary) => void;
};

function statusLabel(adventure: AdventureSummary) {
  if (adventure.status === 'sold_out') return 'SOLD OUT';
  if (adventure.status === 'cancelled') return 'CANCELLED';
  if (adventure.status === 'completed') return 'PAST ADVENTURE';
  if (adventure.spots_remaining != null && adventure.spots_remaining <= 3) return 'ALMOST FULL';
  return adventure.is_featured ? 'FEATURED' : 'OFFICIAL MA ADVENTURE';
}

export function AdventureCard({ adventure, onToggleSaved }: Props) {
  const start = new Date(adventure.starts_at);
  const price = adventure.starting_price_cents === 0 ? 'Free' : `From $${(adventure.starting_price_cents / 100).toFixed(0)}`;
  const closed = adventure.status === 'sold_out' || adventure.status === 'cancelled' || adventure.status === 'completed';

  return (
    <View style={styles.card}>
      <ImageBackground
        source={adventure.hero_image_url ? { uri: adventure.hero_image_url } : undefined}
        style={styles.image}
        imageStyle={styles.imageRadius}
      >
        <View style={styles.shade} />
        <View style={styles.imageTopRow}>
          <View style={[styles.statusPill, adventure.status === 'cancelled' && styles.cancelledPill]}><Text style={styles.statusText}>{statusLabel(adventure)}</Text></View>
          <Pressable
            style={styles.saveButton}
            accessibilityRole="button"
            accessibilityLabel={adventure.is_saved ? 'Remove saved adventure' : 'Save adventure'}
            onPress={() => onToggleSaved(adventure)}
          >
            <Text style={styles.save}>{adventure.is_saved ? '★' : '☆'}</Text>
          </Pressable>
        </View>
        <View style={styles.imageBottom}>
          <Text style={styles.title}>{adventure.title}</Text>
          <Text style={styles.imageMeta}>{start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · {adventure.city}, {adventure.state}</Text>
        </View>
      </ImageBackground>

      <View style={styles.body}>
        <Text style={styles.summary}>{adventure.summary}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{adventure.category} · {adventure.difficulty}</Text>
          <Text style={styles.price}>{price}</Text>
        </View>
        {adventure.status === 'published' && adventure.spots_remaining != null ? <Text style={styles.spots}>{adventure.spots_remaining} spot{adventure.spots_remaining === 1 ? '' : 's'} remaining</Text> : null}
        {adventure.status === 'cancelled' ? <Text style={styles.cancelled}>This adventure has been cancelled.</Text> : null}
        {adventure.status === 'sold_out' ? <Text style={styles.soldOut}>This adventure is sold out.</Text> : null}

        <Link href={{ pathname: '/adventures/[id]', params: { id: adventure.id } }} asChild>
          <Pressable style={[styles.button, closed && styles.buttonSecondary]}>
            <Text style={[styles.buttonText, closed && styles.buttonTextSecondary]}>{adventure.status === 'completed' ? 'View memories' : adventure.status === 'cancelled' ? 'View details' : adventure.status === 'sold_out' ? 'View sold-out adventure' : 'View adventure'}</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#17211C', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#28362E' },
  image: { height: 225, justifyContent: 'space-between', backgroundColor: '#293B31' }, imageRadius: { borderTopLeftRadius: 20, borderTopRightRadius: 20 }, shade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,13,10,0.34)' },
  imageTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 13 }, statusPill: { backgroundColor: 'rgba(16,24,20,0.82)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }, cancelledPill: { backgroundColor: 'rgba(105,43,38,0.9)' }, statusText: { color: '#F0D083', fontSize: 10, fontWeight: '900', letterSpacing: 0.7 }, saveButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(16,24,20,0.82)', alignItems: 'center', justifyContent: 'center' }, save: { color: '#FFF8E8', fontSize: 23 },
  imageBottom: { padding: 16 }, title: { color: '#FFF8E8', fontSize: 24, lineHeight: 28, fontWeight: '900' }, imageMeta: { color: '#E3E8E4', marginTop: 5, fontWeight: '600' }, body: { padding: 16, gap: 10 }, summary: { color: '#D4D8D5', fontSize: 15, lineHeight: 22 }, metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, meta: { color: '#AEB8B2', textTransform: 'capitalize', flex: 1 }, price: { color: '#FFF8E8', fontWeight: '900' }, spots: { color: '#D7B45A', fontWeight: '800' }, soldOut: { color: '#FFB4A9', fontWeight: '800' }, cancelled: { color: '#FFB4A9', fontWeight: '800' },
  button: { marginTop: 2, backgroundColor: '#F2EAD8', padding: 13, borderRadius: 12, alignItems: 'center' }, buttonSecondary: { backgroundColor: '#26342C', borderWidth: 1, borderColor: '#445349' }, buttonText: { color: '#17211C', fontWeight: '900' }, buttonTextSecondary: { color: '#FFF8E8' },
});
