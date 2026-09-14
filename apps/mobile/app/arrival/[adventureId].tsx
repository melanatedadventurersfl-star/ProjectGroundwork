import Ionicons from '@react-native-vector-icons/ionicons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  extractCredentialCode,
  getArrivalState,
  queueArrivalCheckIn,
  syncArrivalChanges,
  validateCredentialOffline,
} from '../../src/arrival/service';
import type { ArrivalValidationStatus, LocalArrivalScan } from '../../src/arrival/types';
import type { HostFieldSnapshot } from '../../src/field/types';
import { getRosterSweep, setRosterSweepStatus } from '../../src/offline/safetyStore';
import type { RosterSweepStatus } from '../../src/offline/safetyTypes';
import type { RosterEntry } from '../../src/operations/types';

const RESULT_COPY: Record<ArrivalValidationStatus, { title: string; detail: string }> = {
  valid: { title: 'Valid ticket', detail: 'Arrival saved on this device.' },
  already_checked_in: { title: 'Already checked in', detail: 'Do not create a second arrival unless staff confirms it is intentional.' },
  wrong_event: { title: 'Wrong event', detail: 'This credential belongs to another event saved on this device.' },
  invalid_ticket: { title: 'Invalid ticket', detail: 'No matching credential was found in the downloaded roster.' },
};

export default function ArrivalModeScreen() {
  const { adventureId } = useLocalSearchParams<{ adventureId: string }>();
  const [snapshot, setSnapshot] = useState<HostFieldSnapshot | null>(null);
  const [scans, setScans] = useState<LocalArrivalScan[]>([]);
  const [sweep, setSweep] = useState<Record<string, RosterSweepStatus>>({});
  const [pending, setPending] = useState(0);
  const [query, setQuery] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
  const [torch, setTorch] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ status: ArrivalValidationStatus; name?: string } | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const load = useCallback(async () => {
    if (!adventureId) return;
    setLoading(true);
    try {
      const [state, sweepRows] = await Promise.all([
        getArrivalState(adventureId),
        getRosterSweep(adventureId),
      ]);
      setSnapshot(state.snapshot);
      setScans(state.scans);
      setPending(state.pending);
      setSweep(Object.fromEntries(sweepRows.map((row) => [row.attendeeId, row.status])));

      try {
        const synced = await syncArrivalChanges(adventureId);
        setSnapshot(synced.snapshot);
        setScans(synced.scans);
        setPending(synced.pending);
        setError(synced.lastError);
      } catch (caught) {
        if (!state.snapshot) setError(caught instanceof Error ? caught.message : 'Arrival data is not available on this device.');
      }
    } finally {
      setLoading(false);
    }
  }, [adventureId]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => setCameraOpen(false);
  }, [load]));

  const roster = snapshot?.roster ?? [];
  const arrived = roster.filter((entry) => entry.checked_in_at).length;
  const notArrived = Math.max(roster.length - arrived, 0);
  const leftEarly = Object.values(sweep).filter((status) => status === 'left_early').length;
  const duplicateAttendees = new Set(scans.filter((scan) => scan.duplicateCount > 0 || scan.reconciliationStatus === 'duplicate').map((scan) => scan.attendeeId)).size;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return roster;
    return roster.filter((entry) => `${entry.first_name} ${entry.last_name} ${entry.ticket_type_name}`.toLowerCase().includes(needle));
  }, [query, roster]);

  async function refreshState() {
    if (!adventureId) return;
    const state = await getArrivalState(adventureId);
    setSnapshot(state.snapshot);
    setScans(state.scans);
    setPending(state.pending);
  }

  async function processCredential(raw: string) {
    if (!adventureId || scanLocked) return;
    setScanLocked(true);
    try {
      const validation = await validateCredentialOffline(adventureId, raw);
      if (validation.status === 'valid' && validation.attendee) {
        const code = extractCredentialCode(raw);
        await queueArrivalCheckIn({
          adventureId,
          attendee: validation.attendee,
          method: 'qr',
          credentialCode: code,
        });
        setResult({ status: 'valid', name: `${validation.attendee.first_name} ${validation.attendee.last_name}` });
        setManualCode('');
        await refreshState();
      } else {
        setResult({
          status: validation.status,
          name: validation.attendee ? `${validation.attendee.first_name} ${validation.attendee.last_name}` : undefined,
        });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Ticket could not be checked.');
    } finally {
      setTimeout(() => setScanLocked(false), 1100);
    }
  }

  async function manualArrival(attendee: RosterEntry) {
    if (!adventureId) return;
    if (attendee.checked_in_at) {
      setResult({ status: 'already_checked_in', name: `${attendee.first_name} ${attendee.last_name}` });
      return;
    }
    try {
      const queued = await queueArrivalCheckIn({ adventureId, attendee, method: 'manual' });
      setSnapshot(queued.snapshot);
      setResult({ status: queued.alreadyCheckedIn ? 'already_checked_in' : 'valid', name: `${attendee.first_name} ${attendee.last_name}` });
      await refreshState();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Manual check-in could not be saved.');
    }
  }

  async function syncNow() {
    if (!adventureId) return;
    setSyncing(true);
    try {
      const synced = await syncArrivalChanges(adventureId);
      setSnapshot(synced.snapshot);
      setScans(synced.scans);
      setPending(synced.pending);
      setError(synced.lastError);
    } finally {
      setSyncing(false);
    }
  }

  async function markLeftEarly(attendeeId: string) {
    if (!adventureId) return;
    const next: RosterSweepStatus = sweep[attendeeId] === 'left_early' ? 'returned' : 'left_early';
    await setRosterSweepStatus(adventureId, attendeeId, next);
    setSweep((current) => ({ ...current, [attendeeId]: next }));
  }

  async function openCamera() {
    if (!permission?.granted) {
      const next = await requestPermission();
      if (!next.granted) return;
    }
    setCameraOpen(true);
  }

  if (loading && !snapshot) {
    return <SafeAreaView style={styles.center}><ActivityIndicator color="#F4C542" /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name="chevron-back" size={24} color="#FFF8E8" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>ARRIVAL MODE</Text>
          <Text style={styles.headerTitle}>Event check-in</Text>
        </View>
        <Pressable accessibilityLabel="Sync arrivals" onPress={() => void syncNow()} style={styles.iconButton}>
          {syncing ? <ActivityIndicator color="#F4C542" /> : <Ionicons name="sync" size={20} color="#F4C542" />}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.syncBanner, pending > 0 && styles.syncBannerPending]}>
          <Ionicons name={pending > 0 ? 'cloud-offline-outline' : 'checkmark-circle-outline'} size={22} color={pending > 0 ? '#F4C542' : '#76D1B7'} />
          <View style={styles.flex}>
            <Text style={styles.syncTitle}>{pending > 0 ? `${pending} arrival${pending === 1 ? '' : 's'} waiting to sync` : 'Arrival records reconciled'}</Text>
            <Text style={styles.syncText}>{pending > 0 ? 'Check-ins are saved on this device. Safety actions still sync first.' : 'Duplicate scans from connected host devices are reflected here after reconciliation.'}</Text>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.metrics}>
          <View style={styles.metric}><Text style={styles.metricNumber}>{arrived}</Text><Text style={styles.metricLabel}>Arrived</Text></View>
          <View style={styles.metric}><Text style={styles.metricNumber}>{notArrived}</Text><Text style={styles.metricLabel}>Not arrived</Text></View>
          <View style={styles.metric}><Text style={styles.metricNumber}>{leftEarly}</Text><Text style={styles.metricLabel}>Left early</Text></View>
          <View style={styles.metric}><Text style={[styles.metricNumber, duplicateAttendees > 0 && styles.duplicateNumber]}>{duplicateAttendees}</Text><Text style={styles.metricLabel}>Duplicates</Text></View>
        </View>

        {result ? (
          <View style={[styles.resultCard, result.status === 'valid' && styles.resultValid, result.status === 'invalid_ticket' && styles.resultInvalid, result.status === 'wrong_event' && styles.resultInvalid]}>
            <Text style={styles.resultTitle}>{RESULT_COPY[result.status].title}{result.name ? ` · ${result.name}` : ''}</Text>
            <Text style={styles.resultText}>{RESULT_COPY[result.status].detail}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionEyebrow}>SCAN TICKET</Text>
          <Text style={styles.sectionTitle}>Fast QR check-in</Text>
          <Text style={styles.body}>The scanner validates against the roster already saved on this device. No connection is required for the first check.</Text>
          {!cameraOpen ? (
            <Pressable style={styles.primaryButton} onPress={() => void openCamera()}>
              <Ionicons name="qr-code-outline" size={20} color="#10231C" />
              <Text style={styles.primaryText}>Open scanner</Text>
            </Pressable>
          ) : (
            <View style={styles.cameraWrap}>
              <CameraView
                style={styles.camera}
                facing="back"
                enableTorch={torch}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={scanLocked ? undefined : ({ data }) => void processCredential(data)}
              />
              <View style={styles.cameraActions}>
                <Pressable style={styles.cameraButton} onPress={() => setTorch((current) => !current)}><Text style={styles.cameraButtonText}>{torch ? 'Torch off' : 'Torch on'}</Text></Pressable>
                <Pressable style={styles.cameraButton} onPress={() => setCameraOpen(false)}><Text style={styles.cameraButtonText}>Close</Text></Pressable>
              </View>
            </View>
          )}

          <Text style={styles.orText}>or enter the ticket code</Text>
          <View style={styles.codeRow}>
            <TextInput value={manualCode} onChangeText={setManualCode} placeholder="Ticket credential" placeholderTextColor="#7E8A84" autoCapitalize="none" style={[styles.input, styles.flex]} />
            <Pressable style={styles.codeButton} onPress={() => void processCredential(manualCode)}><Text style={styles.codeButtonText}>Check</Text></Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionEyebrow}>MANUAL LOOKUP</Text>
          <Text style={styles.sectionTitle}>Find by name</Text>
          <TextInput value={query} onChangeText={setQuery} placeholder="Search attendee" placeholderTextColor="#7E8A84" style={styles.input} />
          {filtered.slice(0, 40).map((entry) => {
            const left = sweep[entry.attendee_id] === 'left_early';
            return (
              <View key={entry.attendee_id} style={styles.attendeeRow}>
                <View style={styles.flex}>
                  <Text style={styles.attendeeName}>{entry.first_name} {entry.last_name}</Text>
                  <Text style={styles.attendeeMeta}>{entry.ticket_type_name} · {entry.checked_in_at ? 'arrived' : 'not arrived'}{left ? ' · left early' : ''}</Text>
                </View>
                <View style={styles.attendeeActions}>
                  {!entry.checked_in_at ? <Pressable style={styles.smallPrimary} onPress={() => void manualArrival(entry)}><Text style={styles.smallPrimaryText}>Check in</Text></Pressable> : null}
                  {entry.checked_in_at ? <Pressable style={[styles.smallOutline, left && styles.smallOutlineActive]} onPress={() => void markLeftEarly(entry.attendee_id)}><Text style={styles.smallOutlineText}>{left ? 'Returned' : 'Left early'}</Text></Pressable> : null}
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionEyebrow}>RECENT ARRIVALS</Text>
          {scans.length === 0 ? <Text style={styles.body}>No arrivals recorded on this device yet.</Text> : scans.slice(0, 20).map((scan) => (
            <View key={scan.id} style={styles.scanRow}>
              <View style={styles.flex}>
                <Text style={styles.attendeeName}>{scan.attendeeName}</Text>
                <Text style={styles.attendeeMeta}>{scan.method.toUpperCase()} · {new Date(scan.scannedAt).toLocaleTimeString()}</Text>
              </View>
              <Text style={[styles.scanStatus, scan.reconciliationStatus === 'duplicate' && styles.scanDuplicate, scan.reconciliationStatus === 'failed' && styles.scanFailed]}>
                {scan.reconciliationStatus === 'pending' ? 'QUEUED' : scan.reconciliationStatus.toUpperCase()}
              </Text>
            </View>
          ))}
        </View>

        <Pressable style={styles.hostFieldLink} onPress={() => router.push({ pathname: '/host/[id]', params: { id: adventureId } })}>
          <Ionicons name="clipboard-outline" size={18} color="#76D1B7" />
          <Text style={styles.hostFieldText}>Open full Host Field Mode</Text>
        </Pressable>

        <Text style={styles.footer}>Offline validation proves that the credential matches the roster saved on this device. Cross-device duplicate detection requires reconciliation after a network connection returns.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0D1512' },
  center: { flex: 1, backgroundColor: '#0D1512', alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#28352F' },
  headerCopy: { flex: 1, marginHorizontal: 10 },
  eyebrow: { color: '#F4C542', fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  headerTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900', marginTop: 2 },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#17231E' },
  content: { padding: 16, paddingBottom: 48, gap: 14 },
  flex: { flex: 1 },
  syncBanner: { flexDirection: 'row', gap: 10, borderRadius: 16, padding: 13, borderWidth: 1, borderColor: '#245744', backgroundColor: '#11231D' },
  syncBannerPending: { borderColor: '#5C4F1D', backgroundColor: '#282313' },
  syncTitle: { color: '#FFF8E8', fontSize: 13, fontWeight: '900' },
  syncText: { color: '#A8B3AD', fontSize: 11, lineHeight: 16, marginTop: 2 },
  error: { color: '#F7B3A9', backgroundColor: '#2B1714', borderRadius: 12, padding: 12, fontSize: 12 },
  metrics: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, minWidth: 0, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 7, backgroundColor: '#151F1B', borderWidth: 1, borderColor: '#2B3933', alignItems: 'center' },
  metricNumber: { color: '#FFF8E8', fontSize: 22, fontWeight: '900' },
  duplicateNumber: { color: '#F7B3A9' },
  metricLabel: { color: '#8E9B94', fontSize: 9, marginTop: 3, textAlign: 'center' },
  resultCard: { padding: 14, borderRadius: 15, borderWidth: 1, borderColor: '#A77B2F', backgroundColor: '#2B2516' },
  resultValid: { borderColor: '#2B765B', backgroundColor: '#123126' },
  resultInvalid: { borderColor: '#80443D', backgroundColor: '#301A17' },
  resultTitle: { color: '#FFF8E8', fontWeight: '900', fontSize: 14 },
  resultText: { color: '#C8D0CC', fontSize: 11, lineHeight: 16, marginTop: 3 },
  card: { backgroundColor: '#131C18', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#2B3933', gap: 11 },
  sectionEyebrow: { color: '#76D1B7', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  sectionTitle: { color: '#FFF8E8', fontSize: 19, fontWeight: '900' },
  body: { color: '#C3CCC7', fontSize: 12, lineHeight: 18 },
  primaryButton: { minHeight: 50, borderRadius: 14, backgroundColor: '#F4C542', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryText: { color: '#10231C', fontWeight: '900', fontSize: 14 },
  cameraWrap: { borderRadius: 16, overflow: 'hidden', backgroundColor: '#050807' },
  camera: { height: 300 },
  cameraActions: { flexDirection: 'row', gap: 8, padding: 10, backgroundColor: '#0A100D' },
  cameraButton: { flex: 1, minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: '#435149', alignItems: 'center', justifyContent: 'center' },
  cameraButtonText: { color: '#FFF8E8', fontSize: 11, fontWeight: '800' },
  orText: { color: '#7F8C85', fontSize: 10, textAlign: 'center' },
  codeRow: { flexDirection: 'row', gap: 8 },
  input: { minHeight: 45, borderRadius: 12, borderWidth: 1, borderColor: '#3C4943', color: '#FFF8E8', paddingHorizontal: 12, backgroundColor: '#0D1512' },
  codeButton: { minWidth: 72, borderRadius: 12, backgroundColor: '#76D1B7', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  codeButtonText: { color: '#10231C', fontWeight: '900', fontSize: 12 },
  attendeeRow: { flexDirection: 'row', gap: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#29352F', paddingTop: 10 },
  attendeeName: { color: '#FFF8E8', fontSize: 13, fontWeight: '900' },
  attendeeMeta: { color: '#909D96', fontSize: 10, marginTop: 3 },
  attendeeActions: { alignItems: 'flex-end', gap: 6 },
  smallPrimary: { backgroundColor: '#76D1B7', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  smallPrimaryText: { color: '#10231C', fontWeight: '900', fontSize: 10 },
  smallOutline: { borderWidth: 1, borderColor: '#59665F', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  smallOutlineActive: { borderColor: '#F4C542', backgroundColor: '#2B2516' },
  smallOutlineText: { color: '#D9E0DC', fontWeight: '800', fontSize: 9 },
  scanRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#29352F', paddingTop: 10 },
  scanStatus: { color: '#76D1B7', fontSize: 9, fontWeight: '900' },
  scanDuplicate: { color: '#F4C542' },
  scanFailed: { color: '#F7B3A9' },
  hostFieldLink: { minHeight: 48, borderWidth: 1, borderColor: '#36564A', borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#15251F' },
  hostFieldText: { color: '#76D1B7', fontWeight: '900', fontSize: 12 },
  footer: { color: '#75817A', fontSize: 10, lineHeight: 15, textAlign: 'center', paddingHorizontal: 12 },
});
