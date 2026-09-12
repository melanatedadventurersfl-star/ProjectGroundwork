import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../src/lib/supabase';
import { getActiveOrganization, organizationRoleLabel, type OrganizationWorkspace } from '../../src/platform/organizations';
import { AppIcon } from '../../src/ui/AppIcon';

type ProfileRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  home_city: string | null;
  home_state: string | null;
};

const C = { bg: '#0A0F0C', panel: '#131B16', raised: '#19231C', line: '#2D3A32', cream: '#FFF8E8', muted: '#95A29A', dim: '#6F7D75', gold: '#D7B45A' };

export default function OrganizationMemberProfileScreen() {
  const { id, organizationId } = useLocalSearchParams<{ id: string; organizationId?: string }>();
  const [organization, setOrganization] = useState<OrganizationWorkspace | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [{ data: auth }, activeOrganization] = await Promise.all([
          supabase.auth.getUser(),
          getActiveOrganization(),
        ]);
        if (!auth.user || !id || auth.user.id !== id) throw new Error('This preview is only available for your own profile.');
        if (!activeOrganization) throw new Error('No active organization is available.');
        if (organizationId && activeOrganization.id !== organizationId) throw new Error('Switch back to the organization you want to preview.');

        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('id,display_name,username,avatar_url,cover_url,bio,home_city,home_state')
          .eq('id', id)
          .single();
        if (profileError) throw profileError;
        if (!active) return;
        setOrganization(activeOrganization);
        setProfile(data as ProfileRow);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Unable to open this profile preview.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id, organizationId]);

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color={C.gold} /></SafeAreaView>;
  if (error || !organization || !profile) return <SafeAreaView style={styles.center}><Text style={styles.error}>{error || 'Profile unavailable.'}</Text></SafeAreaView>;

  const location = [profile.home_city, profile.home_state].filter(Boolean).join(', ');
  const roles = organization.roles.map(organizationRoleLabel).join(' · ');

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => router.back()} style={styles.backRow}><Text style={styles.back}>‹ Back to Host Center</Text></Pressable>
      <View style={styles.hero}>
        {profile.cover_url ? <Image source={{ uri: profile.cover_url }} style={styles.cover} /> : <View style={styles.coverFallback} />}
        <View style={styles.identity}>
          {profile.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={styles.avatar} /> : <View style={styles.avatarFallback}><AppIcon name="profile" color={C.gold} size={28} /></View>}
          <View style={styles.flex}>
            <Text style={styles.context}>{organization.name.toUpperCase()}</Text>
            <Text style={styles.name}>{profile.display_name || 'Member'}</Text>
            {profile.username ? <Text style={styles.handle}>@{profile.username}</Text> : null}
            {location ? <Text style={styles.location}>{location}</Text> : null}
          </View>
        </View>
      </View>

      <View style={styles.previewNote}>
        <AppIcon name="profile" color={C.gold} size={19} />
        <View style={styles.flex}><Text style={styles.previewTitle}>Personal profile preview</Text><Text style={styles.previewBody}>This is how your personal identity is represented inside {organization.name}. Business information lives on the separate organization page.</Text></View>
      </View>

      {profile.bio ? <View style={styles.card}><Text style={styles.label}>ABOUT</Text><Text style={styles.body}>{profile.bio}</Text></View> : null}
      <View style={styles.card}><Text style={styles.label}>ORGANIZATION ROLE</Text><Text style={styles.role}>{roles || 'Member'}</Text></View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg }, center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }, content: { padding: 18, paddingBottom: 90, maxWidth: 760, width: '100%', alignSelf: 'center' },
  flex: { flex: 1 }, backRow: { alignSelf: 'flex-start', marginBottom: 12 }, back: { color: C.gold, fontSize: 11, fontWeight: '900' },
  hero: { borderRadius: 22, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, overflow: 'hidden' }, cover: { width: '100%', height: 150, backgroundColor: C.raised }, coverFallback: { height: 110, backgroundColor: '#17221B' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }, avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: C.raised }, avatarFallback: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#292516', alignItems: 'center', justifyContent: 'center' },
  context: { color: C.gold, fontSize: 8, fontWeight: '900', letterSpacing: 1 }, name: { color: C.cream, fontSize: 25, fontWeight: '900', marginTop: 3 }, handle: { color: C.muted, fontSize: 10, marginTop: 2 }, location: { color: C.dim, fontSize: 10, marginTop: 5 },
  previewNote: { flexDirection: 'row', gap: 11, borderRadius: 16, borderWidth: 1, borderColor: '#5E522D', backgroundColor: '#211D11', padding: 14, marginTop: 14 }, previewTitle: { color: C.cream, fontSize: 12, fontWeight: '900' }, previewBody: { color: C.muted, fontSize: 9.5, lineHeight: 15, marginTop: 3 },
  card: { borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, padding: 14, marginTop: 12 }, label: { color: C.gold, fontSize: 8, fontWeight: '900', letterSpacing: 1 }, body: { color: '#D6DED8', fontSize: 12, lineHeight: 19, marginTop: 7 }, role: { color: C.cream, fontSize: 13, fontWeight: '900', marginTop: 7 }, error: { color: '#F0A199', fontSize: 11, textAlign: 'center' },
});
