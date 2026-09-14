import { Camera, Map, Marker } from '@maplibre/maplibre-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { getOfflineMapStyleUrl } from './offlineMaps';

type Props = {
  latitude: number;
  longitude: number;
  title: string;
};

export function OfflineAdventureMap({ latitude, longitude, title }: Props) {
  const mapStyle = getOfflineMapStyleUrl();
  if (!mapStyle) {
    return (
      <View style={styles.unavailable}>
        <Text style={styles.unavailableTitle}>Map provider not configured</Text>
        <Text style={styles.unavailableText}>Event coordinates are still saved in the offline event pack.</Text>
      </View>
    );
  }

  return (
    <View style={styles.frame}>
      <Map style={styles.map} mapStyle={mapStyle}>
        <Camera initialViewState={{ center: [longitude, latitude], zoom: 13 }} />
        <Marker lngLat={[longitude, latitude]}>
          <View style={styles.pinOuter}>
            <View style={styles.pinInner} />
          </View>
        </Marker>
      </Map>
      <View pointerEvents="none" style={styles.label}>
        <Text numberOfLines={1} style={styles.labelText}>{title}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: 250,
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#32433C',
    backgroundColor: '#101A17',
  },
  map: { flex: 1 },
  pinOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#10231C',
    borderWidth: 3,
    borderColor: '#F4C542',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F4C542',
  },
  label: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    alignItems: 'flex-start',
  },
  labelText: {
    color: '#F7F7F4',
    backgroundColor: 'rgba(16,35,28,0.88)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 11,
    fontWeight: '800',
    overflow: 'hidden',
  },
  unavailable: {
    minHeight: 150,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#4A4030',
    backgroundColor: '#1E211A',
    padding: 18,
    justifyContent: 'center',
  },
  unavailableTitle: { color: '#F4C542', fontSize: 15, fontWeight: '900' },
  unavailableText: { color: '#B7BEB9', fontSize: 12, lineHeight: 18, marginTop: 7 },
});
