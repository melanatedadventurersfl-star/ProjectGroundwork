import { ScrollView, StyleSheet, Text, View } from 'react-native';

const tiles = [
  { title: 'Find your next adventure', detail: 'Explore upcoming experiences near you.' },
  { title: 'Your adventure queue', detail: 'Booked adventures and readiness tasks will appear here.' },
  { title: 'Around the campfire', detail: 'Community updates will appear here.' },
];

export default function TrailheadScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>MELANATED ADVENTURERS</Text>
      <Text style={styles.title}>Trailhead</Text>
      <Text style={styles.intro}>Your starting point for getting outside, getting ready, and staying connected.</Text>

      <View style={styles.grid}>
        {tiles.map((tile) => (
          <View key={tile.title} style={styles.tile}>
            <Text style={styles.tileTitle}>{tile.title}</Text>
            <Text style={styles.tileDetail}>{tile.detail}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#F7F3EA',
    paddingHorizontal: 16,
    paddingTop: 64,
    paddingBottom: 32,
  },
  eyebrow: {
    color: '#24543B',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  title: {
    color: '#17211B',
    fontSize: 32,
    fontWeight: '800',
    marginTop: 8,
  },
  intro: {
    color: '#56615A',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 8,
    marginBottom: 24,
  },
  grid: {
    gap: 12,
  },
  tile: {
    minHeight: 132,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    justifyContent: 'space-between',
  },
  tileTitle: {
    color: '#17211B',
    fontSize: 20,
    fontWeight: '700',
  },
  tileDetail: {
    color: '#56615A',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 20,
  },
});
