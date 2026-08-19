import * as Updates from 'expo-updates';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getBuildFingerprint, getBuildInfo } from '../src/updates/buildInfo';
import { currentReleaseNotes } from '../src/updates/releaseNotes';

type CheckState = 'idle' | 'checking' | 'current' | 'available' | 'error';

function formatTimestamp(value: string | null) {
  if (!value) return 'Not embedded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function BuildStatusScreen() {
  const info = useMemo(() => getBuildInfo(), []);
  const fingerprint = useMemo(() => getBuildFingerprint(), []);
  const [checkState, setCheckState] = useState<CheckState>('idle');
  const [message, setMessage] = useState('Tap below to verify this install against the latest published update.');

  async function checkNow() {
    if (!Updates.isEnabled) {
      setCheckState('error');
      setMessage('Expo updates are disabled for this build, so a remote update check is unavailable.');
      return;
    }

    setCheckState('checking');
    setMessage('Checking the update channel…');
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        setCheckState('available');
        setMessage('A newer update is available for this build.');
      } else {
        setCheckState('current');
        setMessage('This install is on the latest update available to its channel.');
      }
    } catch (error) {
      setCheckState('error');
      setMessage(error instanceof Error ? error.message : 'Unable to check for updates right now.');
    }
  }

  async function installUpdate() {
    setCheckState('checking');
    setMessage('Downloading the latest update…');
    try {
      const fetched = await Updates.fetchUpdateAsync();
      if (fetched.isNew) {
        setMessage('Update downloaded. Restarting Melanated…');
        await Updates.reloadAsync();
        return;
      }
      setCheckState('current');
      setMessage('No newer update was downloaded. This install is current.');
    } catch (error) {
      setCheckState('error');
      setMessage(error instanceof Error ? error.message : 'Unable to install the update.');
    }
  }

  const statusLabel =
    checkState === 'current' ? 'LATEST BUILD ✓' :
    checkState === 'available' ? 'UPDATE AVAILABLE' :
    checkState === 'checking' ? 'CHECKING…' :
    checkState === 'error' ? 'CHECK FAILED' :
    'INSTALLED BUILD';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>ADMIN DIAGNOSTICS</Text>
          <Text style={styles.title}>Build Status</Text>
          <Text style={styles.subtitle}>The exact fingerprint of the app currently running on this device.</Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, checkState === 'available' ? styles.statusDotWarn : checkState === 'error' ? styles.statusDotError : null]} />
            <Text style={styles.statusLabel}>{statusLabel}</Text>
          </View>
          <Text style={styles.fingerprint}>{fingerprint}</Text>
          <Text style={styles.statusCopy}>{message}</Text>

          <Pressable disabled={checkState === 'checking'} onPress={checkNow} style={[styles.primaryButton, checkState === 'checking' ? styles.buttonDisabled : null]}>
            {checkState === 'checking' ? <ActivityIndicator color="#0F1713" /> : <Text style={styles.primaryButtonText}>Check for update</Text>}
          </Pressable>
          {checkState === 'available' ? (
            <Pressable onPress={installUpdate} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Download & restart</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>BUILD FINGERPRINT</Text>
        <View style={styles.card}>
          <InfoRow label="App version" value={info.appVersion} />
          <InfoRow label="Native build" value={info.buildNumber} />
          <InfoRow label="Commit" value={info.shortCommit || 'Not embedded'} />
          <InfoRow label="Build time" value={formatTimestamp(info.timestamp)} />
          <InfoRow label="Build profile" value={info.profile || 'Unknown'} />
          <InfoRow label="Update channel" value={info.channel} />
          <InfoRow label="Runtime" value={info.runtimeVersion} />
          <InfoRow label="Update ID" value={info.updateId ? info.updateId.slice(0, 12) : 'Embedded'} last />
        </View>

        <Text style={styles.sectionTitle}>WHAT&apos;S NEW</Text>
        <View style={styles.card}>
          <View style={styles.notesHeader}>
            <Text style={styles.notesTitle}>{currentReleaseNotes.title}</Text>
            <Text style={styles.notesIntro}>{currentReleaseNotes.intro}</Text>
          </View>
          {currentReleaseNotes.items.map((item, index) => (
            <View key={`${index}-${item}`} style={styles.noteRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.noteText}>{item}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>Use the version, build, and commit together when reporting a screen that looks out of date.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, last ? null : styles.divider]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} selectable>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' },
  content: { padding: 20, paddingBottom: 54 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 18 },
  backText: { color: '#D7B45A', fontSize: 16, fontWeight: '800' },
  header: { marginTop: 8, marginBottom: 18, gap: 4 },
  eyebrow: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#FFF8E8', fontSize: 34, lineHeight: 40, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { color: '#A9B4AD', fontSize: 14, lineHeight: 20 },
  heroCard: { borderRadius: 22, borderWidth: 1, borderColor: '#435449', backgroundColor: '#17211C', padding: 18, gap: 12, marginBottom: 24 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#9BE33D' },
  statusDotWarn: { backgroundColor: '#F0C65A' },
  statusDotError: { backgroundColor: '#FF8C7C' },
  statusLabel: { color: '#CDE96D', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  fingerprint: { color: '#FFF8E8', fontSize: 24, lineHeight: 29, fontWeight: '900' },
  statusCopy: { color: '#95A29A', fontSize: 13, lineHeight: 19 },
  primaryButton: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D7B45A', marginTop: 4 },
  primaryButtonText: { color: '#0F1713', fontSize: 14, fontWeight: '900' },
  secondaryButton: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D7B45A' },
  secondaryButtonText: { color: '#D7B45A', fontSize: 14, fontWeight: '900' },
  buttonDisabled: { opacity: 0.65 },
  sectionTitle: { color: '#8F9A93', fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
  card: { backgroundColor: '#17211C', borderRadius: 16, borderWidth: 1, borderColor: '#26332C', overflow: 'hidden', marginBottom: 22 },
  infoRow: { minHeight: 54, paddingHorizontal: 16, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#26332C' },
  infoLabel: { color: '#8F9A93', fontSize: 12, fontWeight: '700' },
  infoValue: { flex: 1, color: '#FFF8E8', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  notesHeader: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#26332C', gap: 5 },
  notesTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' },
  notesIntro: { color: '#8F9A93', fontSize: 12, lineHeight: 18 },
  noteRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  bullet: { color: '#D7B45A', fontSize: 17, lineHeight: 19 },
  noteText: { flex: 1, color: '#C6D0CA', fontSize: 12, lineHeight: 18 },
  footer: { color: '#718078', fontSize: 11, lineHeight: 17, textAlign: 'center' },
});
