import Ionicons from '@react-native-vector-icons/ionicons';
import * as Location from 'expo-location';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAdventure } from '../../src/adventures/api';
import type { AdventureDetail } from '../../src/adventures/types';
import { downloadEventPack, getEventPack, isEventPackStale } from '../../src/offline/eventPack';
import type { OfflineEventPack } from '../../src/offline/safetyTypes';
import { OfflineAdventureMap } from '../../src/maps/OfflineAdventureMap';
import {
  deleteOfflineMapPack,
  downloadOfflineMapPack,
  formatOfflineMapBytes,
  getOfflineMapPack,
  isOfflineMapConfigured,
} from '../../src/maps/offlineMaps';
import type { OfflineMapPack, OfflineMapProgress } from '../../src/maps/types';
import { getTrailPowerSnapshot, setTrailPowerManualEnabled, subscribeTrailPower } from '../../src/power/trailPower';

const RADIUS_OPTIONS = [
  { km: 3, label: 'Camp' },
  { km: 8, label: 'Standard' },
  { km: 15, label: 'Wide' },
] as const;

type CheckProps = {
  icon: string;
  title: string;
  detail: string;
  ready: boolean;
  required?: boolean;
};

function ReadinessCheck({ icon, title, detail, ready, required = true }: CheckProps) {
  return (
    <View style={styles.checkRow}>
      <View style={[styles.checkIcon, ready ? styles.checkIconReady : styles.checkIconPending]}>
        <Ionicons name={ready ? 'checkmark' : icon as never} size={17} color={ready ? '#10231C' : '#F4C542'} />
      </View>
      <View style={styles.flex}>
        <View style={styles.checkTitleRow}>
          <Text style={styles.checkTitle}>{title}</Text>
          {!required ? <Text style={styles.optional}>OPTIONAL</Text> : null}
        </View>
        <Text style={styles.checkDetail}>{detail}</Text>
      </View>
    </View>
  );
}

function mapStateLabel(mapPack: OfflineMapPack | null, progress: OfflineMapProgress | null) {
  const state = progress?.state ?? mapPack?.state;
  const percentage = progress?.percentage ?? mapPack?.percentage ?? 0;
  if (state === 'complete') return 'Downloaded and ready offline';
  if (state === 'downloading') return `Downloading ${Math.round(percentage)}%`;
  if (state === 'error') return progress?.error ?? mapPack?.error ?? 'Download failed';
  return 'Not downloaded';
}

export default function PreTripReadinessScreen() {
  const { adventureId } = useLocalSearchParams<{ adventureId: string }>();
  const [pack, setPack] = useState<OfflineEventPack | null>(null);
  const [adventure, setAdventure] = useState<AdventureDetail | null>(null);
  const [mapPack, setMapPack] = useState<OfflineMapPack | null>(null);
  const [mapProgress, setMapProgress] = useState<OfflineMapProgress | null>(null);
  const [radiusKm, setRadiusKm] = useState(8);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(Platform.OS === 'web');
  const [trailPower, setTrailPower] = useState(getTrailPowerSnapshot());

  const mapsConfigured = isOfflineMapConfigured();
  const nativeMapsRequired = Platform.OS !== 'web';

  const load = useCallback(async () => {
    if (!adventureId) return;
    try {
      const [savedPack, savedMap, locationPermission] = await Promise.all([
        getEventPack(adventureId),
        getOfflineMapPack(adventureId),
        Platform.OS === 'web' ? Promise.resolve({ granted: true }) : Location.getForegroundPermissionsAsync(),
      ]);
      setLocationPermissionGranted(Boolean(locationPermission.granted));
      setPack(savedPack);
      setMapPack(savedMap);
      if (savedMap?.radiusKm) setRadiusKm(savedMap.radiusKm);
      if (savedPack?.adventure) {
        setAdventure(savedPack.adventure);
      } else {
        setAdventure(await getAdventure(adventureId));
      }
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load trip readiness.');
    }
  }, [adventureId]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  useEffect(() => subscribeTrailPower(setTrailPower), []);

  const locationReady = adventure?.latitude != null && adventure.longitude != null;
  const eventPackReady = Boolean(pack);
  const eventPackFresh = Boolean(pack && !isEventPackStale(pack));
  const mapReady = !nativeMapsRequired || mapPack?.state === 'complete' || mapProgress?.state === 'complete';
  const readyOffline = eventPackFresh && locationReady && mapReady && locationPermissionGranted;

  const checks = useMemo(() => [
    {
      icon: 'cloud-download-outline',
      title: 'Offline event pack',
      detail: pack
        ? `${eventPackFresh ? 'Current' : 'Update recommended'} · Last saved ${new Date(pack.downloadedAt).toLocaleString()}`
        : 'Schedule, announcements, event details, and safety essentials are not downloaded yet.',
      ready: eventPackFresh,
      required: true,
    },
    {
      icon: 'map-outline',
      title: 'Offline map region',
      detail: nativeMapsRequired
        ? mapsConfigured
          ? mapStateLabel(mapPack, mapProgress)
          : 'This build needs an offline-enabled MapLibre style before map packs can be downloaded.'
        : 'Native map packs are downloaded in the iOS and Android app.',
      ready: mapReady,
      required: nativeMapsRequired,
    },
    {
      icon: 'location-outline',
      title: 'Meeting location',
      detail: locationReady
        ? `${adventure?.venue_name ?? adventure?.city ?? 'Event location'} · Coordinates saved with the trip.`
        : 'This Adventure does not have coordinates yet. Offline return navigation needs a saved location.',
      ready: locationReady,
      required: true,
    },
    {
      icon: 'navigate-outline',
      title: 'Location permission',
      detail: locationPermissionGranted
        ? 'Foreground location is available for Safety Mode and offline return guidance.'
        : 'Enable foreground location before the trip so Safety Mode can record your route.',
      ready: locationPermissionGranted,
      required: true,
    },
    {
      icon: 'battery-half-outline',
      title: 'Battery',
      detail: trailPower.batteryLevel >= 0
        ? `${Math.round(trailPower.batteryLevel * 100)}% · ${trailPower.mode === 'critical' ? 'Trail Power Mode active' : trailPower.mode === 'trail_power' ? 'Trail Power Mode active' : trailPower.mode === 'suggested' ? 'Trail Power Mode recommended' : 'Normal power profile'}`
        : 'Battery level is unavailable on this device.',
      ready: trailPower.batteryLevel < 0 || trailPower.batteryLevel >= 0.30 || trailPower.mode === 'trail_power' || trailPower.mode === 'critical',
      required: false,
    },
    {
      icon: 'calendar-outline',
      title: 'Schedule',
      detail: pack?.schedule.length
        ? `${pack.schedule.length} schedule item${pack.schedule.length === 1 ? '' : 's'} available offline.`
        : 'No schedule items are currently saved for this Adventure.',
      ready: Boolean(pack?.schedule.length),
      required: false,
    },
    {
      icon: 'megaphone-outline',
      title: 'Host updates',
      detail: pack
        ? `${pack.announcements.length} current announcement${pack.announcements.length === 1 ? '' : 's'} saved offline.`
        : 'Host announcements will be included when the event pack downloads.',
      ready: Boolean(pack),
      required: false,
    },
  ], [adventure, eventPackFresh, locationPermissionGranted, locationReady, mapPack, mapProgress, mapReady, mapsConfigured, nativeMapsRequired, pack, trailPower]);

  const requiredChecks = checks.filter((check) => check.required);
  const requiredReadyCount = requiredChecks.filter((check) => check.ready).length;

  async function prepareOffline() {
    if (!adventureId) return;
    setBusy(true);
    setError(null);
    try {
      const nextPack = await downloadEventPack(adventureId);
      setPack(nextPack);
      setAdventure(nextPack.adventure);

      const latitude = nextPack.adventure.latitude;
      const longitude = nextPack.adventure.longitude;
      if (nativeMapsRequired && mapsConfigured && latitude != null && longitude != null) {
        setMapProgress({
          state: 'downloading',
          percentage: 0,
          completedResourceCount: 0,
          completedResourceSize: 0,
          error: null,
        });
        const started = await downloadOfflineMapPack(
          { adventureId, latitude, longitude, radiusKm },
          (progress) => {
            setMapProgress(progress);
            if (progress.state === 'complete' || progress.state === 'error') {
              void getOfflineMapPack(adventureId).then(setMapPack);
            }
          },
        );
        setMapPack(started);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not prepare this Adventure for offline use.');
    } finally {
      setBusy(false);
    }
  }

  async function removeMap() {
    if (!adventureId) return;
    Alert.alert('Remove offline map?', 'The event pack and safety information will stay on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove map',
        style: 'destructive',
        onPress: () => {
          void deleteOfflineMapPack(adventureId).then(() => {
            setMapPack(null);
            setMapProgress(null);
          });
        },
      },
    ]);
  }

  const displayedMapBytes = mapProgress?.completedResourceSize ?? mapPack?.completedResourceSize ?? 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name="chevron-back" size={24} color="#F7F7F4" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>BEFORE YOU LOSE SIGNAL</Text>
          <Text style={styles.headerTitle}>Trip Readiness</Text>
        </View>
        <Pressable accessibilityLabel="Refresh readiness" onPress={() => void load()} style={styles.iconButton}>
          <Ionicons name="refresh" size={20} color="#F4C542" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, readyOffline && styles.heroReady]}>
          <View style={[styles.heroIcon, readyOffline && styles.heroIconReady]}>
            <Ionicons name={readyOffline ? 'checkmark-circle' : 'cloud-offline-outline'} size={28} color={readyOffline ? '#10231C' : '#F4C542'} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.heroKicker}>{readyOffline ? 'READY OFFLINE' : 'PREP NEEDED'}</Text>
            <Text style={styles.heroTitle}>{adventure?.title ?? 'Adventure'}</Text>
            <Text style={styles.heroText}>
              {readyOffline
                ? `${requiredReadyCount} of ${requiredChecks.length} essentials ready for offline use.`
                : `${requiredReadyCount} of ${requiredChecks.length} essentials ready. Finish the remaining items before signal gets weak.`}
            </Text>
          </View>
        </View>

        {error ? <Text style={styles.warning}>{error}</Text> : null}

        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>READINESS CHECK</Text>
          {checks.map((check) => <ReadinessCheck key={check.title} {...check} />)}
        </View>

        {locationReady && adventure ? (
          <OfflineAdventureMap
            latitude={adventure.latitude as number}
            longitude={adventure.longitude as number}
            title={adventure.venue_name ?? adventure.title}
          />
        ) : null}

        {nativeMapsRequired ? (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <View style={styles.flex}>
                <Text style={styles.cardEyebrow}>OFFLINE MAP AREA</Text>
                <Text style={styles.cardTitle}>Choose how much area to save</Text>
              </View>
              {displayedMapBytes > 0 ? <Text style={styles.sizeText}>{formatOfflineMapBytes(displayedMapBytes)}</Text> : null}
            </View>
            <View style={styles.optionRow}>
              {RADIUS_OPTIONS.map((option) => (
                <Pressable
                  key={option.km}
                  onPress={() => setRadiusKm(option.km)}
                  style={[styles.option, radiusKm === option.km && styles.optionActive]}
                >
                  <Text style={[styles.optionText, radiusKm === option.km && styles.optionTextActive]}>{option.label}</Text>
                  <Text style={[styles.optionSub, radiusKm === option.km && styles.optionTextActive]}>{option.km} km</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.subtle}>Larger areas use more storage. Download over Wi-Fi when possible.</Text>
            {(mapPack || mapProgress) ? (
              <View style={styles.progressWrap}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.max(2, mapProgress?.percentage ?? mapPack?.percentage ?? 0)}%` }]} />
                </View>
                <Text style={styles.progressText}>{mapStateLabel(mapPack, mapProgress)}</Text>
              </View>
            ) : null}
            {mapPack ? (
              <Pressable onPress={() => void removeMap()} style={styles.textButton}>
                <Text style={styles.textButtonText}>Remove downloaded map</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>TRAIL POWER MODE</Text>
          <Text style={styles.cardTitle}>{trailPower.mode === 'critical' ? 'Battery protection is active' : trailPower.manualEnabled || trailPower.lowPowerMode ? 'Reduced-power field profile' : 'Automatic battery protection'}</Text>
          <Text style={styles.subtle}>At 30% the app recommends Trail Power Mode. At 15% it automatically reduces foreground breadcrumb sampling. Safety controls remain available.</Text>
          <Pressable style={styles.textButton} onPress={() => setTrailPowerManualEnabled(!trailPower.manualEnabled)}>
            <Text style={styles.textButtonText}>{trailPower.manualEnabled ? 'Use automatic power mode' : 'Turn on Trail Power Mode'}</Text>
          </Pressable>
        </View>

        <Pressable disabled={busy} style={styles.primaryButton} onPress={() => void prepareOffline()}>
          {busy ? <ActivityIndicator color="#10231C" /> : <Ionicons name="download-outline" size={20} color="#10231C" />}
          <Text style={styles.primaryButtonText}>{pack ? 'Refresh offline trip' : 'Prepare for offline'}</Text>
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          onPress={() => adventureId && router.push({ pathname: '/safety/[adventureId]', params: { adventureId } })}
        >
          <Ionicons name="shield-checkmark-outline" size={19} color="#76D1B7" />
          <Text style={styles.secondaryButtonText}>Open Adventure Safety Mode</Text>
        </Pressable>

        <Text style={styles.footerNote}>Offline maps depend on the map provider configured for this build. Go Melanated never treats a partial map download as ready.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0C1512' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#22302B' },
  headerCopy: { flex: 1, marginHorizontal: 10 },
  eyebrow: { color: '#76D1B7', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  headerTitle: { color: '#F7F7F4', fontSize: 19, fontWeight: '900', marginTop: 2 },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#17231F' },
  content: { padding: 16, paddingBottom: 38, gap: 14 },
  hero: { flexDirection: 'row', gap: 13, borderRadius: 20, borderWidth: 1, borderColor: '#574A2F', backgroundColor: '#211F16', padding: 16 },
  heroReady: { borderColor: '#315A4C', backgroundColor: '#14251F' },
  heroIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#332D1D', alignItems: 'center', justifyContent: 'center' },
  heroIconReady: { backgroundColor: '#76D1B7' },
  heroKicker: { color: '#F4C542', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  heroTitle: { color: '#F7F7F4', fontSize: 20, fontWeight: '900', marginTop: 3 },
  heroText: { color: '#B7BEB9', fontSize: 12, lineHeight: 18, marginTop: 5 },
  warning: { color: '#F4B9A8', backgroundColor: '#2B1916', borderRadius: 12, padding: 12, fontSize: 12, lineHeight: 18 },
  card: { borderRadius: 18, borderWidth: 1, borderColor: '#2C3C36', backgroundColor: '#121A18', padding: 16 },
  cardEyebrow: { color: '#76D1B7', fontSize: 10, fontWeight: '900', letterSpacing: 0.9 },
  cardTitle: { color: '#F7F7F4', fontSize: 17, fontWeight: '900', marginTop: 4 },
  checkRow: { flexDirection: 'row', gap: 12, paddingTop: 15 },
  checkIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  checkIconReady: { backgroundColor: '#76D1B7' },
  checkIconPending: { backgroundColor: '#2B281C', borderWidth: 1, borderColor: '#5A4E30' },
  checkTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkTitle: { color: '#F7F7F4', fontSize: 13, fontWeight: '800' },
  checkDetail: { color: '#9EA9A4', fontSize: 11, lineHeight: 16, marginTop: 3 },
  optional: { color: '#7C8983', fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  flex: { flex: 1 },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  sizeText: { color: '#F4C542', fontSize: 12, fontWeight: '900' },
  optionRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  option: { flex: 1, borderRadius: 13, borderWidth: 1, borderColor: '#34443E', backgroundColor: '#18231F', paddingVertical: 10, alignItems: 'center' },
  optionActive: { borderColor: '#F4C542', backgroundColor: '#2B291A' },
  optionText: { color: '#B9C2BE', fontSize: 11, fontWeight: '900' },
  optionSub: { color: '#7E8A85', fontSize: 9, marginTop: 2 },
  optionTextActive: { color: '#F4C542' },
  subtle: { color: '#8E9A95', fontSize: 11, lineHeight: 16, marginTop: 10 },
  progressWrap: { marginTop: 14 },
  progressTrack: { height: 7, borderRadius: 999, backgroundColor: '#25322D', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#76D1B7' },
  progressText: { color: '#B7BEB9', fontSize: 10, marginTop: 6 },
  textButton: { alignSelf: 'flex-start', marginTop: 12, paddingVertical: 5 },
  textButtonText: { color: '#F2A99B', fontSize: 11, fontWeight: '800' },
  primaryButton: { minHeight: 52, borderRadius: 16, backgroundColor: '#F4C542', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 16 },
  primaryButtonText: { color: '#10231C', fontSize: 14, fontWeight: '900' },
  secondaryButton: { minHeight: 50, borderRadius: 16, borderWidth: 1, borderColor: '#335447', backgroundColor: '#16251F', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 16 },
  secondaryButtonText: { color: '#76D1B7', fontSize: 13, fontWeight: '900' },
  footerNote: { color: '#76817C', fontSize: 10, lineHeight: 15, textAlign: 'center', paddingHorizontal: 12 },
});
