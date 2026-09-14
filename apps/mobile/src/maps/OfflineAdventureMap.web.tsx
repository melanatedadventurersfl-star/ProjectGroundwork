import { StyleSheet, Text, View } from 'react-native';

type Props = {
  latitude: number;
  longitude: number;
  title: string;
};

export function OfflineAdventureMap({ latitude, longitude, title }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>MOBILE OFFLINE MAP</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.coords}>{latitude.toFixed(5)}, {longitude.toFixed(5)}</Text>
      <Text style={styles.body}>Downloadable map regions are available in the iOS and Android app. These coordinates remain available offline in the event pack.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 160,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#32433C',
    backgroundColor: '#121A18',
    padding: 18,
    justifyContent: 'center',
  },
  eyebrow: { color: '#76D1B7', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  title: { color: '#F7F7F4', fontSize: 17, fontWeight: '900', marginTop: 7 },
  coords: { color: '#F4C542', fontSize: 13, fontWeight: '800', marginTop: 6 },
  body: { color: '#B7BEB9', fontSize: 12, lineHeight: 18, marginTop: 10 },
});
