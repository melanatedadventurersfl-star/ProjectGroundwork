import Ionicons from '@react-native-vector-icons/ionicons';
import * as Location from 'expo-location';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { downloadEventPack, getEventPack, isEventPackStale } from '../../src/offline/eventPack';
import { getRosterSweep, setRosterSweepStatus } from '../../src/offline/safetyStore';
import type {
  GeoPoint,
  LocalSafetySession,
  OfflineEventPack,
  RosterSweepStatus,
  SafetyBreadcrumb,
  SafetyCheckInStatus,
} from '../../src/offline/safetyTypes';
import { bearingDegrees, bearingLabel, distanceMeters, formatDistance, shouldRecordBreadcrumb } from '../../src/safety/geo';
import {
  countPendingOfflineActions,
  flushSafetyQueue,
  getActiveSafetySession,
  getBreadcrumbs,
  markSafePoint,
  queueSafetyCheckIn,
  recordSafetyBreadcrumb,
  startSafetySession,
} from '../../src/safety/service';

const RETURN_OPTIONS = [
  { label: '1 hr', hours: 1 },
  { label: '2 hr', hours: 2 },
  { label: '4 hr', hours: 4 },
];

function toPoint(location: Location.LocationObject): GeoPoint {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
    recordedAt: new Date(location.timestamp).toISOString(),
  };
}

function formatClock(value: string | null) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function OfflineRoute({ breadcrumbs, current }: { breadcrumbs: SafetyBreadcrumb[]; current: GeoPoint | null }) {
  const points = useMemo(() => {
    const source = current ? [...breadcrumbs, { ...current, id: -1, sessionId: 'current' }] : breadcrumbs;
    if (source.length === 0) return [];

    const lats = source.map((point) => point.latitude);
    const lons = source.map((point) => point.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const latRange = Math.max(maxLat - minLat, 0.0001);
    const lonRange = Math.max(maxLon - minLon, 0.0001);

    return source.map((point) => ({
      x: 18 + ((point.longitude - minLon) / lonRange) * 264,
      y: 142 - ((point.latitude - minLat) / latRange) * 124,
    }));
  }, [breadcrumbs, current]);

  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) {
    return (
      <View style={styles.routeEmpty}>
        <Text style={styles.subtle}>Your offline route trace appears here after Safety Mode starts.</Text>
      </View>
    );
  }

  const polyline = points.map((point) => `${point.x},${point.y}`).join(' ');
  return (
    <View style={styles.routeWrap}>
      <Svg width="100%" height={160} viewBox="0 0 300 160">
        {points.length > 1 ? (
          <Polyline points={polyline} fill="none" stroke="#F4C542" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        ) : null}
        <Circle cx={first.x} cy={first.y} r={7} fill="#76D1B7" />
        <Circle cx={last.x} cy={last.y} r={8} fill="#F4C542" />
      </Svg>
      <View style={styles.routeLegend}>
        <Text style={styles.routeLegendText}>● Start</Text>
        <Text style={styles.routeLegendText}>● Current</Text>
      </View>
    </View>
  );
}

export default function AdventureSafetyScreen() {
  const { adventureId } = useLocalSearchParams<{ adventureId: string }>();
  const [pack, setPack] = useState<OfflineEventPack | null>(null);
  const [session, setSession] = useState<LocalSafetySession | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<SafetyBreadcrumb[]>([]);
  const [currentPoint, setCurrentPoint] = useState<GeoPoint | null>(null);
  const [pending, setPending] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [returnHours, setReturnHours] = useState(2);
  const [sweep, setSweep] = useState<Record<string, RosterSweepStatus>>({});
  const lastRecorded = useRef<GeoPoint | undefined>(undefined);

  const load = useCallback(async () => {
    if (!adventureId) return;

    try {
      const savedPack = await getEventPack(adventureId);
      const [activeSession, pendingCount, sweepRows] = await Promise.all([
        getActiveSafetySession(adventureId),
        countPendingOfflineActions(),
        getRosterSweep(adventureId),
      ]);

      setPack(savedPack);
      setSession(activeSession);
      setPending(pendingCount);
      setSweep(Object.fromEntries(sweepRows.map((row) => [row.attendeeId, row.status])));
      setBreadcrumbs(activeSession ? await getBreadcrumbs(activeSession.id) : []);
    } catch (caught) {
      setSyncError(caught instanceof Error ? caught.message : 'Could not load offline safety data.');
    }
  }, [adventureId]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const getLocation = useCallback(async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return null;
    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const point = toPoint(location);
    setCurrentPoint(point);
    return point;
  }, []);

  useEffect(() => {
    if (!session || session.status !== 'active') return;

    let disposed = false;
    let subscription: { remove: () => void } | null = null;

    void (async () => {
      const permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted || disposed) return;

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 30,
          timeInterval: 60_000,
        },
        (location) => {
          const point = toPoint(location);
          setCurrentPoint(point);
          if (!shouldRecordBreadcrumb(lastRecorded.current, point, 30)) return;

          lastRecorded.current = point;
          void recordSafetyBreadcrumb(session.id, point).then(async () => {
            if (!disposed) setBreadcrumbs(await getBreadcrumbs(session.id));
          });
        },
      );
    })();

    return () => {
      disposed = true;
      subscription?.remove();
    };
  }, [session]);

  const navigationTarget = useMemo(() => {
    if (session?.safePointLatitude != null && session.safePointLongitude != null) {
      return { latitude: session.safePointLatitude, longitude: session.safePointLongitude, label: 'safe point' };
    }
    if (pack?.adventure.latitude != null && pack.adventure.longitude != null) {
      return { latitude: pack.adventure.latitude, longitude: pack.adventure.longitude, label: 'event location' };
    }
    return null;
  }, [pack, session]);

  const navigation = useMemo(() => {
    if (!currentPoint || !navigationTarget) return null;
    const distance = distanceMeters(currentPoint, navigationTarget);
    const bearing = bearingDegrees(currentPoint, navigationTarget);
    return { distance, bearing };
  }, [currentPoint, navigationTarget]);

  const refreshSyncState = useCallback(async () => {
    const result = await flushSafetyQueue();
    setPending(result.pending);
    setSyncError(result.lastError);
    return result;
  }, []);

  async function downloadPack() {
    if (!adventureId) return;
    setBusy(true);
    try {
      const next = await downloadEventPack(adventureId);
      setPack(next);
      setSyncError(null);
    } catch (caught) {
      setSyncError(caught instanceof Error ? caught.message : 'Could not update the offline event pack.');
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    if (!adventureId) return;
    setBusy(true);
    try {
      const point = await getLocation();
      const venuePoint = pack?.adventure.latitude != null && pack.adventure.longitude != null
        ? { latitude: pack.adventure.latitude, longitude: pack.adventure.longitude }
        : null;
      const expectedReturnAt = new Date(Date.now() + returnHours * 60 * 60 * 1000).toISOString();
      const next = await startSafetySession({ adventureId, expectedReturnAt, safePoint: point ?? venuePoint });
      setSession(next);

      if (point) {
        lastRecorded.current = point;
        await recordSafetyBreadcrumb(next.id, point);
        setBreadcrumbs(await getBreadcrumbs(next.id));
      }

      await refreshSyncState();
    } catch (caught) {
      setSyncError(caught instanceof Error ? caught.message : 'Could not start Safety Mode.');
    } finally {
      setBusy(false);
    }
  }

  async function checkIn(status: SafetyCheckInStatus) {
    if (!session) return;
    setBusy(true);
    try {
      const point = await getLocation().catch(() => currentPoint);
      const next = await queueSafetyCheckIn(session, status, point);
      setSession(status === 'back' ? null : next);
      const result = await refreshSyncState();

      if (status === 'need_help') {
        Alert.alert(
          'Help check-in recorded',
          result.pending > 0
            ? 'Your help check-in is saved on this device and will send when a connection is available. Call emergency services if you are in immediate danger.'
            : 'Your help check-in was sent. Call emergency services if you are in immediate danger.',
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveCurrentAsSafePoint() {
    if (!session) return;
    const point = await getLocation();
    if (!point) {
      Alert.alert('Location unavailable', 'Location permission is required to mark a safe point.');
      return;
    }
    setSession(await markSafePoint(session, point));
  }

  async function shareLocation() {
    const point = currentPoint ?? await getLocation();
    if (!point) return;
    await Share.share({ message: `My current location is ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}.` });
  }

  async function textLocation() {
    const point = currentPoint ?? await getLocation();
    if (!point) return;
    const body = encodeURIComponent(`My current location is ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}.`);
    await Linking.openURL(`sms:?body=${body}`);
  }

  async function markSweep(attendeeId: string, status: RosterSweepStatus) {
    if (!adventureId) return;
    await setRosterSweepStatus(adventureId, attendeeId, status);
    setSweep((current) => ({ ...current, [attendeeId]: status }));
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name="chevron-back" size={24} color="#F7F7F4" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>ADVENTURE SAFETY</Text>
          <Text style={styles.headerTitle}>Offline + Safety</Text>
        </View>
        <Pressable accessibilityLabel="Sync safety data" onPress={() => void refreshSyncState()} style={styles.iconButton}>
          <Ionicons name="sync" size={20} color="#F4C542" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.statusBanner, pending > 0 && styles.statusBannerOffline]}>
          <Ionicons
            name={pending > 0 ? 'cloud-offline-outline' : 'shield-checkmark-outline'}
            size={20}
            color={pending > 0 ? '#F4C542' : '#76D1B7'}
          />
          <View style={styles.flex}>
            <Text style={styles.statusTitle}>
              {pending > 0 ? `${pending} safety update${pending === 1 ? '' : 's'} waiting to send` : 'Safety data synced'}
            </Text>
            <Text style={styles.statusText}>
              {pending > 0 ? 'Saved on this device. Safety updates sync before noncritical data.' : 'Offline tools remain available if signal drops.'}
            </Text>
          </View>
        </View>

        {syncError ? <Text style={styles.warning}>{syncError}</Text> : null}

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.flex}>
              <Text style={styles.cardEyebrow}>OFFLINE EVENT PACK</Text>
              <Text style={styles.cardTitle}>{pack?.adventure.title ?? 'Event details not downloaded'}</Text>
              <Text style={styles.subtle}>
                {pack
                  ? `Saved ${new Date(pack.downloadedAt).toLocaleString()}${isEventPackStale(pack) ? ' · Update recommended' : ''}`
                  : 'Download before leaving reliable service.'}
              </Text>
            </View>
            <Ionicons name={pack ? 'download' : 'cloud-download-outline'} size={25} color={pack ? '#76D1B7' : '#F4C542'} />
          </View>
          <Pressable disabled={busy} style={styles.secondaryButton} onPress={() => void downloadPack()}>
            {busy ? <ActivityIndicator color="#10231C" /> : (
              <Text style={styles.secondaryButtonText}>{pack ? 'Update offline pack' : 'Download for offline use'}</Text>
            )}
          </Pressable>
        </View>

        {!session ? (
          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>TRAIL POWER MODE</Text>
            <Text style={styles.bigTitle}>Start Adventure Safety Mode</Text>
            <Text style={styles.body}>Records a lightweight route trace while this screen is active. Your full breadcrumb trail stays on this device.</Text>
            <Text style={styles.fieldLabel}>Expected return</Text>
            <View style={styles.optionRow}>
              {RETURN_OPTIONS.map((option) => (
                <Pressable
                  key={option.hours}
                  onPress={() => setReturnHours(option.hours)}
                  style={[styles.option, returnHours === option.hours && styles.optionActive]}
                >
                  <Text style={[styles.optionText, returnHours === option.hours && styles.optionTextActive]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable disabled={busy} style={styles.primaryButton} onPress={() => void start()}>
              <Ionicons name="navigate" size={19} color="#10231C" />
              <Text style={styles.primaryButtonText}>Start Adventure</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={styles.flex}>
                  <Text style={styles.cardEyebrow}>SAFETY MODE ACTIVE</Text>
                  <Text style={styles.bigTitle}>Expected back {formatClock(session.expectedReturnAt)}</Text>
                </View>
                <View style={styles.liveDot} />
              </View>
              <Text style={styles.subtle}>
                Last check-in: {session.lastCheckIn ? session.lastCheckIn.replace('_', ' ') : 'none'}
                {session.lastCheckInAt ? ` · ${formatClock(session.lastCheckInAt)}` : ''}
              </Text>
              <View style={styles.checkGrid}>
                <Pressable disabled={busy} style={styles.checkButton} onPress={() => void checkIn('okay')}>
                  <Ionicons name="checkmark-circle-outline" size={22} color="#76D1B7" />
                  <Text style={styles.checkText}>I’m okay</Text>
                </Pressable>
                <Pressable disabled={busy} style={styles.checkButton} onPress={() => void checkIn('back')}>
                  <Ionicons name="home-outline" size={22} color="#76D1B7" />
                  <Text style={styles.checkText}>I’m back</Text>
                </Pressable>
                <Pressable disabled={busy} style={[styles.checkButton, styles.helpButton]} onPress={() => void checkIn('need_help')}>
                  <Ionicons name="warning-outline" size={22} color="#F7B3A9" />
                  <Text style={styles.helpText}>Need help</Text>
                </Pressable>
                <Pressable disabled={busy} style={styles.checkButton} onPress={() => void saveCurrentAsSafePoint()}>
                  <Ionicons name="flag-outline" size={22} color="#F4C542" />
                  <Text style={styles.checkText}>Mark safe point</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardEyebrow}>OFFLINE ROUTE TRACE</Text>
              <OfflineRoute breadcrumbs={breadcrumbs} current={currentPoint} />
              {navigationTarget && navigation ? (
                <View style={styles.navigationCard}>
                  <Text style={styles.navigationDistance}>{formatDistance(navigation.distance)}</Text>
                  <Text style={styles.navigationBearing}>
                    {Math.round(navigation.bearing)}° {bearingLabel(navigation.bearing)} to {navigationTarget.label}
                  </Text>
                </View>
              ) : null}
              <Text style={styles.microcopy}>This is a local breadcrumb recovery view. It does not require a data connection or downloaded street tiles.</Text>
            </View>
          </>
        )}

        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>EMERGENCY COMMUNICATION</Text>
          <Text style={styles.body}>A queued Go Melanated check-in is not the same as a delivered emergency message. Use cellular voice or SMS when available.</Text>
          <View style={styles.actionRow}>
            <Pressable style={[styles.actionButton, styles.emergencyButton]} onPress={() => void Linking.openURL('tel:911')}>
              <Ionicons name="call" size={18} color="#F7F7F4" />
              <Text style={styles.emergencyText}>Call 911</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={() => void textLocation()}>
              <Ionicons name="chatbubble-outline" size={18} color="#F4C542" />
              <Text style={styles.actionText}>Text location</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={() => void shareLocation()}>
              <Ionicons name="share-outline" size={18} color="#F4C542" />
              <Text style={styles.actionText}>Share</Text>
            </Pressable>
          </View>
          {currentPoint ? <Text style={styles.coordinates}>{currentPoint.latitude.toFixed(6)}, {currentPoint.longitude.toFixed(6)}</Text> : null}
        </View>

        {pack?.announcements.length ? (
          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>SAVED ANNOUNCEMENTS</Text>
            {pack.announcements.slice(0, 5).map((item) => (
              <View key={item.id} style={styles.listItem}>
                <Text style={styles.listTitle}>{item.priority === 'critical' ? '⚠ ' : ''}{item.title}</Text>
                <Text style={styles.subtle}>{item.body}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {pack?.schedule.length ? (
          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>SAVED SCHEDULE</Text>
            {pack.schedule.map((item) => (
              <View key={item.id} style={styles.listItem}>
                <Text style={styles.listTitle}>{formatClock(item.starts_at)} · {item.title}</Text>
                {item.location ? <Text style={styles.subtle}>{item.location}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}

        {pack?.roster.length ? (
          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>HOST SAFETY ROSTER</Text>
            <Text style={styles.body}>{pack.roster.length} attendees saved on this device for field operations.</Text>
            {pack.roster.slice(0, 30).map((person) => {
              const status = sweep[person.attendee_id];
              return (
                <View key={person.attendee_id} style={styles.rosterRow}>
                  <View style={styles.flex}>
                    <Text style={styles.listTitle}>{person.first_name} {person.last_name}</Text>
                    <Text style={styles.subtle}>{status ? status.replace('_', ' ') : person.checked_in_at ? 'checked in' : 'not checked in'}</Text>
                  </View>
                  <Pressable
                    onPress={() => void markSweep(person.attendee_id, status === 'returned' ? 'still_out' : 'returned')}
                    style={[styles.sweepButton, status === 'returned' && styles.sweepButtonActive]}
                  >
                    <Text style={[styles.sweepText, status === 'returned' && styles.sweepTextActive]}>
                      {status === 'returned' ? 'Returned' : 'Mark returned'}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : null}

        <Text style={styles.footerNote}>Safety Mode supports preparedness. It does not replace emergency services, a personal locator beacon, or established backcountry safety practices.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#09120F' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#26342E' },
  headerCopy: { flex: 1, marginLeft: 10 },
  eyebrow: { color: '#76D1B7', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  headerTitle: { color: '#F7F7F4', fontSize: 18, fontWeight: '900', marginTop: 2 },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#14201C' },
  content: { padding: 16, paddingBottom: 48, gap: 14 },
  statusBanner: { flexDirection: 'row', gap: 11, backgroundColor: '#11231D', borderWidth: 1, borderColor: '#245744', borderRadius: 16, padding: 13 },
  statusBannerOffline: { backgroundColor: '#282313', borderColor: '#5C4F1D' },
  statusTitle: { color: '#F7F7F4', fontWeight: '900', fontSize: 13 },
  statusText: { color: '#AEB9B3', fontSize: 11, lineHeight: 16, marginTop: 2 },
  warning: { color: '#F7B3A9', backgroundColor: '#2B1714', borderRadius: 12, padding: 12, fontSize: 12 },
  card: { backgroundColor: '#121A18', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#2A3832', gap: 12 },
  cardEyebrow: { color: '#76D1B7', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  cardTitle: { color: '#F7F7F4', fontSize: 17, lineHeight: 22, fontWeight: '900', marginTop: 3 },
  bigTitle: { color: '#F7F7F4', fontSize: 22, lineHeight: 27, fontWeight: '900', marginTop: 4 },
  body: { color: '#D5DDD9', fontSize: 13, lineHeight: 19 },
  subtle: { color: '#9EA9A4', fontSize: 11, lineHeight: 16, marginTop: 2 },
  microcopy: { color: '#83908A', fontSize: 10, lineHeight: 15 },
  flex: { flex: 1 },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  secondaryButton: { minHeight: 44, backgroundColor: '#76D1B7', borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  secondaryButtonText: { color: '#10231C', fontWeight: '900', fontSize: 13 },
  fieldLabel: { color: '#D5DDD9', fontSize: 12, fontWeight: '800', marginTop: 3 },
  optionRow: { flexDirection: 'row', gap: 8 },
  option: { flex: 1, borderWidth: 1, borderColor: '#405049', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  optionActive: { backgroundColor: '#F4C542', borderColor: '#F4C542' },
  optionText: { color: '#D5DDD9', fontWeight: '800' },
  optionTextActive: { color: '#10231C' },
  primaryButton: { minHeight: 50, backgroundColor: '#F4C542', borderRadius: 14, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#10231C', fontWeight: '900', fontSize: 15 },
  liveDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#76D1B7', marginTop: 8 },
  checkGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  checkButton: { width: '48%', minHeight: 62, borderWidth: 1, borderColor: '#34463E', borderRadius: 14, padding: 11, gap: 5, justifyContent: 'center' },
  helpButton: { borderColor: '#69362F', backgroundColor: '#281715' },
  checkText: { color: '#F7F7F4', fontSize: 12, fontWeight: '800' },
  helpText: { color: '#F7B3A9', fontSize: 12, fontWeight: '900' },
  routeWrap: { height: 196, backgroundColor: '#0B1311', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#25352F' },
  routeEmpty: { height: 120, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, backgroundColor: '#0B1311', borderRadius: 14 },
  routeLegend: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 },
  routeLegendText: { color: '#9EA9A4', fontSize: 10 },
  navigationCard: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, backgroundColor: '#18251F', borderRadius: 12, padding: 12 },
  navigationDistance: { color: '#F4C542', fontSize: 20, fontWeight: '900' },
  navigationBearing: { color: '#D5DDD9', fontSize: 11, fontWeight: '800', flex: 1, textAlign: 'right' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#49564F', borderRadius: 12, paddingHorizontal: 12 },
  emergencyButton: { backgroundColor: '#7C2E27', borderColor: '#A74A40' },
  emergencyText: { color: '#F7F7F4', fontWeight: '900', fontSize: 12 },
  actionText: { color: '#F4C542', fontWeight: '900', fontSize: 12 },
  coordinates: { color: '#D5DDD9', fontFamily: 'monospace', fontSize: 12 },
  listItem: { borderTopWidth: 1, borderTopColor: '#28352F', paddingTop: 10 },
  listTitle: { color: '#F7F7F4', fontSize: 13, fontWeight: '800' },
  rosterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#28352F', paddingTop: 10 },
  sweepButton: { borderWidth: 1, borderColor: '#46554E', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  sweepButtonActive: { backgroundColor: '#1D3C31', borderColor: '#76D1B7' },
  sweepText: { color: '#AEB9B3', fontSize: 10, fontWeight: '800' },
  sweepTextActive: { color: '#76D1B7' },
  footerNote: { color: '#748079', fontSize: 10, lineHeight: 15, textAlign: 'center', paddingHorizontal: 16, paddingTop: 4 },
});
