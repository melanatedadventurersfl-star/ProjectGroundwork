import Ionicons from '@react-native-vector-icons/ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMemberBasecamp, saveProfilePrivacy } from '../../src/member/api';

const GOLD = '#D7B45A';
const BG = '#0F1713';
const CARD = '#17211C';
const BORDER = '#2A3930';
const TEXT = '#FFF8E8';
const MUTED = '#9EAAA2';

export default function DiscoverySettingsScreen() {
  const [searchable, setSearchable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getMemberBasecamp()
      .then((data) => setSearchable(data.profile?.is_searchable !== false))
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load discovery settings.'))
      .finally(() => setLoading(false));
  }, []);

  async function toggleSearchable(value: boolean) {
    setSearchable(value);
    setSaving(true);
    setError(null);
    try {
      await saveProfilePrivacy({ is_searchable: value });
    } catch (caught) {
      setSearchable(!value);
      setError(caught instanceof Error ? caught.message : 'Unable to update search visibility.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color={GOLD} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Pressable style={styles.backButton} onPress={() => router.back()}><Ionicons name="chevron-back" size={22} color={TEXT} /></Pressable>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>PROFILE SETTINGS</Text>
            <Text style={styles.title}>Discovery</Text>
          </View>
        </View>

        <Text style={styles.intro}>Control whether other members can find your profile when they search Outpost by your name or username.</Text>

        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.iconWrap}><Ionicons name="search" size={22} color={GOLD} /></View>
            <View style={styles.flex}>
              <Text style={styles.settingTitle}>Searchable Profile</Text>
              <Text style={styles.settingCopy}>{searchable ? 'Members can find you by your display name or @username.' : 'Your profile will not appear in member search results.'}</Text>
            </View>
            <Switch
              value={searchable}
              disabled={saving}
              onValueChange={(value) => void toggleSearchable(value)}
              trackColor={{ false: '#435148', true: '#8C763F' }}
              thumbColor={searchable ? '#F0D083' : '#D9DED9'}
            />
          </View>
        </View>

        <View style={styles.note}>
          <Ionicons name="shield-checkmark-outline" size={20} color={MUTED} />
          <Text style={styles.noteText}>Turning search off does not remove existing Trailmates or Crew membership. Those relationships stay intact.</Text>
        </View>

        {saving ? <Text style={styles.status}>Saving…</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  center: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18, gap: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  eyebrow: { color: '#AA9461', fontSize: 10.5, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: TEXT, fontSize: 31, fontWeight: '900' },
  intro: { color: MUTED, fontSize: 14, lineHeight: 21 },
  card: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 18, padding: 15 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1C2A23', borderWidth: 1, borderColor: '#5E5238', alignItems: 'center', justifyContent: 'center' },
  settingTitle: { color: TEXT, fontSize: 16, fontWeight: '900' },
  settingCopy: { color: MUTED, fontSize: 12.5, lineHeight: 18, marginTop: 3 },
  note: { flexDirection: 'row', gap: 10, backgroundColor: '#121B17', borderRadius: 14, padding: 13 },
  noteText: { flex: 1, color: '#8F9B93', fontSize: 12.5, lineHeight: 18 },
  status: { color: '#E4D7B0', textAlign: 'center' },
  error: { color: '#FFB4A9', backgroundColor: '#301A18', borderRadius: 12, padding: 10 },
});
