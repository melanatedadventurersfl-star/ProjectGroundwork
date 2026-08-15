import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMemberBasecamp, saveProfilePrivacy } from '../../src/member/api';
import { AppIcon } from '../../src/ui/AppIcon';

const privacy = [
  ['profile_is_private', 'Private account', 'Only approved members can view the parts of your profile that are not public by default.'],
  ['city_visible', 'Show city & state', 'Display your home city and state on your profile.'],
  ['badges_visible', 'Show badges', 'Let other members see the achievement badges you have earned.'],
  ['adventures_visible', 'Show completed adventures', 'Show completed official adventures on your profile.'],
  ['interests_visible', 'Show interests', 'Display your outdoor interests in the About section.'],
  ['trail_family_visible', 'Show Trail Family summary', 'Allow your Trail Family summary to appear on your profile.'],
] as const;

export default function ProfilePrivacyScreen() {
  const [profile, setProfile] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const base = await getMemberBasecamp();
      setProfile(base.profile ?? {});
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load privacy settings.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function toggle(key: string, value: boolean) {
    if (!profile) return;
    const previous = Boolean(profile[key]);
    setProfile((current) => ({ ...(current ?? {}), [key]: value }));
    setSavingKey(key);
    setError('');
    try {
      await saveProfilePrivacy({ [key]: value });
    } catch (caught) {
      setProfile((current) => ({ ...(current ?? {}), [key]: previous }));
      setError(caught instanceof Error ? caught.message : 'Unable to save this setting.');
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} style={styles.back} hitSlop={10}>
            <AppIcon name="chevron-forward" color="#F5C341" size={25} style={{ transform: [{ rotate: '180deg' }] }} />
            <Text style={styles.backText}>Menu</Text>
          </Pressable>
        </View>

        <Text style={styles.eyebrow}>ACCOUNT</Text>
        <Text style={styles.title}>Profile & Privacy</Text>
        <Text style={styles.intro}>Choose what other members can see. Exact address, phone, email, payment details, emergency information, and dependent details are never public.</Text>

        {loading ? <ActivityIndicator color="#F5C341" style={styles.loader} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!loading && profile ? <View style={styles.card}>
          {privacy.map(([key, label, description], index) => (
            <View key={key} style={[styles.row, index > 0 && styles.divider]}>
              <View style={styles.copy}>
                <Text style={styles.rowTitle}>{label}</Text>
                <Text style={styles.rowDescription}>{description}</Text>
              </View>
              <View style={styles.switchWrap}>
                {savingKey === key ? <ActivityIndicator size="small" color="#D7B45A" /> : null}
                <Switch
                  value={Boolean(profile[key])}
                  disabled={savingKey === key}
                  onValueChange={(value) => void toggle(key, value)}
                  trackColor={{ false: '#435148', true: '#8C763F' }}
                  thumbColor={profile[key] ? '#F0D083' : '#D9DED9'}
                />
              </View>
            </View>
          ))}
        </View> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' },
  content: { padding: 20, paddingBottom: 70 },
  topRow: { minHeight: 34, justifyContent: 'center', marginBottom: 12 },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  backText: { color: '#F5C341', fontWeight: '800' },
  eyebrow: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#FFF8E8', fontSize: 31, lineHeight: 36, fontWeight: '900', marginTop: 4 },
  intro: { color: '#96A39B', fontSize: 13, lineHeight: 19, marginTop: 8, marginBottom: 18 },
  loader: { marginVertical: 24 },
  error: { color: '#FFB4A9', backgroundColor: '#301A18', borderRadius: 12, padding: 11, marginBottom: 12 },
  card: { backgroundColor: '#17211C', borderWidth: 1, borderColor: '#28362E', borderRadius: 18, overflow: 'hidden' },
  row: { minHeight: 78, paddingHorizontal: 15, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#344139' },
  copy: { flex: 1 },
  rowTitle: { color: '#FFF8E8', fontSize: 15, fontWeight: '800' },
  rowDescription: { color: '#8F9B93', fontSize: 11.5, lineHeight: 16, marginTop: 3 },
  switchWrap: { minWidth: 52, alignItems: 'flex-end', gap: 4 },
});
