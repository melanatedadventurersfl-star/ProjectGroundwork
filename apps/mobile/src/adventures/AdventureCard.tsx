import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AdventureSummary } from './types';

type Props = {
  adventure: AdventureSummary;
  onToggleSaved: (adventure: AdventureSummary) => void;
};

export function AdventureCard({ adventure, onToggleSaved }: Props) {
  const start = new Date(adventure.starts_at);
  const price = adventure.starting_price_cents === 0
    ? 'Free'
    : `From $${(adventure.starting_price_cents / 100).toFixed(0)}`;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.categoryPill}>
          <Text style={styles.categoryText}>{adventure.category}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={adventure.is_saved ? 'Remove saved adventure' : 'Save adventure'}
          onPress={() => onToggleSaved(adventure)}
        >
          <Text style={styles.save}>{adventure.is_saved ? 'Saved' : 'Save'}</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>{adventure.title}</Text>
      <Text style={styles.summary}>{adventure.summary}</Text>
      <Text style={styles.meta}>
        {start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · {adventure.city}, {adventure.state}
      </Text>
      <Text style={styles.meta}>{adventure.difficulty} · {price}</Text>
      {adventure.status === 'sold_out' ? <Text style={styles.soldOut}>Sold out</Text> : null}

      <Link href={{ pathname: '/adventures/[id]', params: { id: adventure.id } }} asChild>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>View adventure</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#17211c', borderRadius: 18, padding: 18, gap: 10 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryPill: { backgroundColor: '#d3a94f', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  categoryText: { color: '#17211c', fontWeight: '800', textTransform: 'uppercase', fontSize: 11 },
  save: { color: '#f2ead8', fontWeight: '700' },
  title: { color: '#fff8e8', fontSize: 22, fontWeight: '800' },
  summary: { color: '#d4d8d5', fontSize: 15, lineHeight: 22 },
  meta: { color: '#aeb8b2', textTransform: 'capitalize' },
  soldOut: { color: '#ffb4a9', fontWeight: '800' },
  button: { marginTop: 4, backgroundColor: '#f2ead8', padding: 13, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#17211c', fontWeight: '800' },
});
