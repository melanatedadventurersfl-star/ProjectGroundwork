import { router, useLocalSearchParams } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getTrailGuidePlace } from '../../src/trailGuide/catalog';
import { useTrailGuidePlacePhoto } from '../../src/trailGuide/placePhotos';
import { AppIcon } from '../../src/ui/AppIcon';

export default function TrailGuidePlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const place = getTrailGuidePlace(id);
  const photo = useTrailGuidePlacePhoto(place);

  if (!place) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.missing}>
          <Text style={styles.title}>Place unavailable</Text>
          <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>Back to Trail Guide</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {photo ? (
            <Image source={{ uri: photo.url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, styles.photoPlaceholder]}>
              <AppIcon name="photo" color="#65726B" size={38} />
              <Text style={styles.photoLoading}>Loading destination photo…</Text>
            </View>
          )}
          <View style={styles.shade} />
          <Pressable hitSlop={10} onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
            <AppIcon name="chevron-forward" color="#FFFDF6" size={22} style={{ transform: [{ rotate: '180deg' }] }} />
            <Text style={styles.backLabel}>Trail Guide</Text>
          </Pressable>
          <View style={styles.heroCopy}>
            <Text style={styles.type}>{place.category.toUpperCase()} · {place.type.toUpperCase()}</Text>
            <Text style={styles.title}>{place.name}</Text>
            <Text style={styles.area}>{place.area}</Text>
          </View>
        </View>

        <View style={styles.body}>
          {photo ? (
            <Text style={styles.photoCredit} numberOfLines={2}>
              Photo via Wikipedia{photo.credit ? ` · ${photo.credit}` : ''}{photo.license ? ` · ${photo.license}` : ''}
            </Text>
          ) : null}

          <Text style={styles.summary}>{place.summary}</Text>
          <View style={styles.tags}>{place.tags.map((tag) => <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>)}</View>

          {place.collections.length > 0 ? (
            <View style={styles.collectionBlock}>
              <Text style={styles.miniLabel}>FEATURED IN</Text>
              <View style={styles.collections}>{place.collections.map((item) => <View key={item} style={styles.collection}><Text style={styles.collectionText}>{item}</Text></View>)}</View>
            </View>
          ) : null}

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>At a glance</Text>
            <View style={styles.detailRow}><View style={styles.dot} /><Text style={styles.detailText}>Area: {place.area}</Text></View>
            {place.details.map((detail) => <View key={detail} style={styles.detailRow}><View style={styles.dot} /><Text style={styles.detailText}>{detail}</Text></View>)}
          </View>

          <View style={styles.currentInfoCard}>
            <View style={styles.currentInfoIcon}><AppIcon name="weather" color="#F5C400" size={19} /></View>
            <View style={styles.currentInfoCopy}>
              <Text style={styles.currentInfoTitle}>Check current conditions before you go</Text>
              <Text style={styles.currentInfoText}>Hours, fees, closures, water access, fire restrictions, and trail conditions can change. The Trail Guide avoids presenting those as permanent facts until live sources are connected.</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#08100C' },
  hero: { height: 340, justifyContent: 'space-between', overflow: 'hidden', backgroundColor: '#17201B' },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#17201B' },
  photoLoading: { color: '#77847D', fontSize: 11, fontWeight: '800' },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,10,7,0.48)' },
  back: { marginTop: 14, marginLeft: 16, minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, borderRadius: 14, backgroundColor: 'rgba(9,16,12,0.58)' },
  backLabel: { color: '#FFFDF6', fontSize: 13, fontWeight: '900' },
  heroCopy: { padding: 22 },
  type: { color: '#F5C400', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  title: { color: '#FFFDF6', fontSize: 34, lineHeight: 39, fontWeight: '900', marginTop: 5 },
  area: { color: '#A7D795', fontSize: 13, fontWeight: '800', marginTop: 7 },
  body: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, paddingBottom: 76 },
  photoCredit: { color: '#66736C', fontSize: 9, lineHeight: 13, marginBottom: 12 },
  summary: { color: '#E2E7E3', fontSize: 16, lineHeight: 24 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  tag: { borderRadius: 999, backgroundColor: '#1E2C24', borderWidth: 1, borderColor: '#324338', paddingHorizontal: 11, paddingVertical: 7 },
  tagText: { color: '#EDF2EE', fontSize: 12, fontWeight: '800' },
  collectionBlock: { marginTop: 22 },
  miniLabel: { color: '#7F8C85', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  collections: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  collection: { borderRadius: 11, backgroundColor: '#18261D', borderWidth: 1, borderColor: '#2E4535', paddingHorizontal: 10, paddingVertical: 7 },
  collectionText: { color: '#BFE8B1', fontSize: 10, fontWeight: '800' },
  infoCard: { marginTop: 24, borderRadius: 18, borderWidth: 1, borderColor: '#29362F', backgroundColor: '#111915', padding: 18 },
  infoTitle: { color: '#FFFDF6', fontSize: 18, fontWeight: '900', marginBottom: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 38 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#79B76A' },
  detailText: { color: '#B8C1BB', fontSize: 14, lineHeight: 20, flex: 1 },
  currentInfoCard: { marginTop: 14, borderRadius: 18, borderWidth: 1, borderColor: '#433B1C', backgroundColor: '#1A180E', padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  currentInfoIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#29240F', alignItems: 'center', justifyContent: 'center' },
  currentInfoCopy: { flex: 1 },
  currentInfoTitle: { color: '#FFF4C2', fontSize: 13, fontWeight: '900' },
  currentInfoText: { color: '#BDB69B', fontSize: 11, lineHeight: 17, marginTop: 4 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  backButton: { marginTop: 18, minHeight: 44, justifyContent: 'center', borderRadius: 14, backgroundColor: '#F5C400', paddingHorizontal: 18 },
  backText: { color: '#11150F', fontWeight: '900' },
  pressed: { opacity: 0.7 },
});
