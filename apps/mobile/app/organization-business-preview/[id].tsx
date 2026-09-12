import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';

import { getActiveOrganization, type OrganizationWorkspace } from '../../src/platform/organizations';
import { AppIcon } from '../../src/ui/AppIcon';

const C = { bg: '#0A0F0C', panel: '#131B16', raised: '#19231C', line: '#2D3A32', cream: '#FFF8E8', muted: '#95A29A', dim: '#6F7D75', gold: '#D7B45A' };

export default function OrganizationBusinessPreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [organization, setOrganization] = useState<OrganizationWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void getActiveOrganization().then((current) => {
      if (!current || current.id !== id) throw new Error('Switch back to the organization you want to preview.');
      if (active) setOrganization(current);
    }).catch((caught) => {
      if (active) setError(caught instanceof Error ? caught.message : 'Unable to open this organization preview.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color={C.gold} /></SafeAreaView>;
  if (error || !organization) return <SafeAreaView style={styles.center}><Text style={styles.error}>{error || 'Organization unavailable.'}</Text></SafeAreaView>;

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => router.back()} style={styles.backRow}><Text style={styles.back}>‹ Back to Host Center</Text></Pressable>
      <View style={styles.hero}>
        {organization.coverImageUrl ? <Image source={{ uri: organization.coverImageUrl }} style={styles.cover} /> : <View style={styles.coverFallback} />}
        <View style={styles.identity}>
          {organization.logoUrl ? <Image source={{ uri: organization.logoUrl }} style={styles.logo} /> : <View style={styles.logoFallback}><AppIcon name="storefront" color={C.gold} size={30} /></View>}
          <View style={styles.flex}>
            <Text style={styles.context}>BUSINESS / ORGANIZATION PAGE</Text>
            <Text style={styles.name}>{organization.name}</Text>
            <Text style={styles.meta}>{organization.kind.charAt(0).toUpperCase() + organization.kind.slice(1)} · {organization.visibility === 'public' ? 'Public' : 'Private'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.previewNote}>
        <AppIcon name="storefront" color={C.gold} size={19} />
        <View style={styles.flex}><Text style={styles.previewTitle}>Business page preview</Text><Text style={styles.previewBody}>This is the organization identity, separate from your personal profile. Add business details, media, contacts, events and team information from Host Center as this organization is configured.</Text></View>
      </View>

      <View style={styles.card}><Text style={styles.label}>PUBLIC EXPERIENCE</Text><Text style={styles.cardTitle}>{organization.name}</Text><Text style={styles.body}>Events and public organization content published from this Host Center belong to this organization.</Text></View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg }, center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }, content: { padding: 18, paddingBottom: 90, maxWidth: 760, width: '100%', alignSelf: 'center' }, flex: { flex: 1 },
  backRow: { alignSelf: 'flex-start', marginBottom: 12 }, back: { color: C.gold, fontSize: 11, fontWeight: '900' }, hero: { borderRadius: 22, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, overflow: 'hidden' }, cover: { width: '100%', height: 170, backgroundColor: C.raised }, coverFallback: { height: 120, backgroundColor: '#17221B' }, identity: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }, logo: { width: 78, height: 78, borderRadius: 21, backgroundColor: C.raised }, logoFallback: { width: 78, height: 78, borderRadius: 21, backgroundColor: '#292516', alignItems: 'center', justifyContent: 'center' },
  context: { color: C.gold, fontSize: 8, fontWeight: '900', letterSpacing: 1 }, name: { color: C.cream, fontSize: 26, fontWeight: '900', marginTop: 4 }, meta: { color: C.muted, fontSize: 10, marginTop: 5 }, previewNote: { flexDirection: 'row', gap: 11, borderRadius: 16, borderWidth: 1, borderColor: '#5E522D', backgroundColor: '#211D11', padding: 14, marginTop: 14 }, previewTitle: { color: C.cream, fontSize: 12, fontWeight: '900' }, previewBody: { color: C.muted, fontSize: 9.5, lineHeight: 15, marginTop: 3 }, card: { borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, padding: 14, marginTop: 12 }, label: { color: C.gold, fontSize: 8, fontWeight: '900', letterSpacing: 1 }, cardTitle: { color: C.cream, fontSize: 15, fontWeight: '900', marginTop: 7 }, body: { color: '#D6DED8', fontSize: 11, lineHeight: 18, marginTop: 6 }, error: { color: '#F0A199', fontSize: 11, textAlign: 'center' },
});
