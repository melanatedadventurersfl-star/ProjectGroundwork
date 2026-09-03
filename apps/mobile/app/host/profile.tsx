import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '../../src/ui/AppIcon';
import {
  createHostOrganization,
  getMyHostProfile,
  listMyHostFollowers,
  listMyHostHistory,
  listMyHostOrganizations,
  updateMyHostProfile,
  uploadHostHistoryPhoto,
  type HostFollower,
  type HostHistoryItem,
  type HostOrganization,
  type HostProfileView,
} from '../../src/hosting/hostProfiles';

const C = { bg: '#0A0F0C', panel: '#131B16', raised: '#19231C', line: '#2D3A32', cream: '#FFF8E8', muted: '#95A29A', dim: '#6F7D75', gold: '#D7B45A' };

export default function HostProfileScreen() {
  const [profile, setProfile] = useState<HostProfileView | null>(null);
  const [followers, setFollowers] = useState<HostFollower[]>([]);
  const [organizations, setOrganizations] = useState<HostOrganization[]>([]);
  const [history, setHistory] = useState<HostHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [showFollowers, setShowFollowers] = useState(false);
  const [title, setTitle] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgDescription, setNewOrgDescription] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [p, f, o, h] = await Promise.all([getMyHostProfile(), listMyHostFollowers(), listMyHostOrganizations(), listMyHostHistory()]);
      setProfile(p); setFollowers(f); setOrganizations(o); setHistory(h);
      setTitle(p.publicTitle || ''); setBusinessName(p.businessName || ''); setBio(p.bio || ''); setWebsite(p.websiteUrl || '');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load host profile.'); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const completed = useMemo(() => history.filter((item) => item.status === 'completed' || new Date(item.ends_at) < new Date()), [history]);
  const upcoming = useMemo(() => history.filter((item) => item.status !== 'completed' && new Date(item.ends_at) >= new Date()), [history]);

  async function saveProfile() {
    setSaving(true); setError('');
    try { await updateMyHostProfile({ publicTitle: title, businessName, bio, websiteUrl: website, isPublic: true }); setEditing(false); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to save profile.'); }
    finally { setSaving(false); }
  }

  async function addOrganization() {
    setSaving(true); setError('');
    try { await createHostOrganization({ name: newOrgName, description: newOrgDescription, city: profile?.homeCity || undefined, state: profile?.homeState || undefined }); setNewOrgName(''); setNewOrgDescription(''); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to add organization.'); }
    finally { setSaving(false); }
  }

  async function chooseHistoryPhoto(adventureId: string) {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Photo access needed', 'Allow photo access to add a photo to your hosting history.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 0.9, exif: false });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const asset = result.assets[0];
    Alert.prompt?.('Photo caption', 'Add an optional caption.', async (caption) => {
      setSaving(true);
      try { await uploadHostHistoryPhoto({ adventureId, localUri: asset.uri, caption }); await load(); }
      catch (caught) { Alert.alert('Unable to add photo', caught instanceof Error ? caught.message : 'Please try again.'); }
      finally { setSaving(false); }
    });
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color={C.gold} size="large" /><Text style={styles.muted}>Loading host profile…</Text></SafeAreaView>;

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Host Center</Text></Pressable>
    {error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text></View> : null}

    <View style={styles.hero}>
      <View style={styles.identityRow}>
        {profile?.avatarUrl ? <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} /> : <View style={styles.avatarFallback}><AppIcon name="profile" color={C.gold} size={30} /></View>}
        <View style={styles.flex}><Text style={styles.eyebrow}>HOST PROFILE</Text><Text style={styles.name}>{profile?.displayName || 'Host'}</Text><Text style={styles.role}>{profile?.publicTitle || 'Host'}{profile?.businessName ? ` · ${profile.businessName}` : ''}</Text><Text style={styles.location}>{[profile?.homeCity, profile?.homeState].filter(Boolean).join(', ')}</Text></View>
        <Pressable style={styles.iconButton} onPress={() => setEditing((value) => !value)}><AppIcon name="edit" color={C.gold} size={18} /></Pressable>
      </View>
      {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : <Text style={styles.bioEmpty}>Add a short public introduction so members know who is hosting.</Text>}
      <View style={styles.stats}>
        <Pressable style={styles.stat} onPress={() => setShowFollowers((value) => !value)}><Text style={styles.statValue}>{profile?.followerCount ?? 0}</Text><Text style={styles.statLabel}>Followers</Text></Pressable>
        <Stat value={String(completed.length)} label="Hosted" /><Stat value={String(upcoming.length)} label="Upcoming" /><Stat value={String(organizations.length)} label="Organizations" />
      </View>
    </View>

    {showFollowers ? <View style={styles.card}><Text style={styles.cardTitle}>Followers</Text>{followers.length ? followers.map((follower) => <View key={follower.profileId} style={styles.followerRow}>{follower.avatarUrl ? <Image source={{ uri: follower.avatarUrl }} style={styles.followerAvatar} /> : <View style={styles.followerFallback}><AppIcon name="profile" color={C.gold} size={16} /></View>}<View style={styles.flex}><Text style={styles.followerName}>{follower.displayName}</Text><Text style={styles.followerMeta}>{[follower.homeCity, follower.homeState].filter(Boolean).join(', ') || 'Go Melanated member'}</Text></View></View>) : <Text style={styles.muted}>No followers yet.</Text>}</View> : null}

    {editing ? <View style={styles.card}><Text style={styles.cardTitle}>Edit public host profile</Text><Field label="Host title" value={title} onChangeText={setTitle} placeholder="Trip Leader" /><Field label="Business name" value={businessName} onChangeText={setBusinessName} placeholder="Melanated Adventurers" /><Field label="Bio" value={bio} onChangeText={setBio} placeholder="What do you host and what should members know?" multiline /><Field label="Website" value={website} onChangeText={setWebsite} placeholder="https://" /><Pressable disabled={saving} style={styles.primary} onPress={() => void saveProfile()}>{saving ? <ActivityIndicator color="#172017" /> : <Text style={styles.primaryText}>Save Profile</Text>}</Pressable></View> : null}

    <SectionHeader title="Organizations & businesses" meta="Hosting does not require a community group. Add a business or organization when you want events presented under a shared identity." />
    {organizations.map((org) => <View key={org.id} style={styles.orgCard}><View style={styles.orgLogo}><AppIcon name="storefront" color={C.gold} size={22} /></View><View style={styles.flex}><Text style={styles.orgName}>{org.name}</Text><Text style={styles.orgMeta}>{[org.city, org.state].filter(Boolean).join(', ') || 'Public host organization'}</Text>{org.description ? <Text style={styles.orgDescription}>{org.description}</Text> : null}</View></View>)}
    <View style={styles.card}><Text style={styles.cardTitle}>Add an organization</Text><Field label="Business or organization name" value={newOrgName} onChangeText={setNewOrgName} placeholder="Melanated Adventurers" /><Field label="Short description" value={newOrgDescription} onChangeText={setNewOrgDescription} placeholder="Outdoor community and event host" multiline /><Pressable disabled={saving || !newOrgName.trim()} style={[styles.secondary, (!newOrgName.trim() || saving) && styles.disabled]} onPress={() => void addOrganization()}><Text style={styles.secondaryText}>Create Organization</Text></Pressable></View>

    <SectionHeader title="Hosting history" meta="Past events become your hosting story. Add photos directly from your device to each event." />
    {completed.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No completed events yet</Text><Text style={styles.muted}>Completed host events will appear here automatically.</Text></View> : completed.map((item) => <HistoryCard key={item.id} item={item} onAddPhoto={() => void chooseHistoryPhoto(item.id)} />)}

    <SectionHeader title="Upcoming events" meta="Events can be public, unlisted, private, or limited to selected communities." />
    {upcoming.map((item) => <View key={item.id} style={styles.upcomingCard}><View style={styles.flex}><Text style={styles.eventTitle}>{item.title}</Text><Text style={styles.eventMeta}>{formatDate(item.starts_at)} · {item.city}, {item.state}</Text></View><View style={styles.visibilityPill}><Text style={styles.visibilityText}>{item.visibility.toUpperCase()}</Text></View></View>)}
  </ScrollView></SafeAreaView>;
}

function HistoryCard({ item, onAddPhoto }: { item: HostHistoryItem; onAddPhoto: () => void }) {
  return <View style={styles.historyCard}><View style={styles.historyTop}><View style={styles.flex}><Text style={styles.eventTitle}>{item.title}</Text><Text style={styles.eventMeta}>{formatDate(item.starts_at)} · {item.city}, {item.state}</Text></View><Pressable style={styles.photoButton} onPress={onAddPhoto}><AppIcon name="camera" color={C.gold} size={16} /><Text style={styles.photoButtonText}>Add photo</Text></Pressable></View>{item.host_media?.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>{item.host_media.map((photo) => <View key={photo.id} style={styles.photoWrap}><Image source={{ uri: photo.image_url }} style={styles.photo} />{photo.caption ? <Text style={styles.photoCaption} numberOfLines={2}>{photo.caption}</Text> : null}</View>)}</ScrollView> : <Text style={styles.noPhotos}>No photos added yet.</Text>}</View>;
}

function SectionHeader({ title, meta }: { title: string; meta: string }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionMeta}>{meta}</Text></View>; }
function Stat({ value, label }: { value: string; label: string }) { return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
function Field({ label, multiline = false, ...props }: any) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} placeholderTextColor="#657269" style={[styles.input, multiline && styles.multiline]} /></View>; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg }, center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 10 }, content: { padding: 18, paddingBottom: 90 }, flex: { flex: 1 }, back: { color: C.gold, fontWeight: '900', marginBottom: 14 }, muted: { color: C.muted, fontSize: 11, lineHeight: 17 }, errorCard: { backgroundColor: '#251614', borderColor: '#6A3E38', borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 12 }, error: { color: '#F0A199', fontSize: 11 }, hero: { borderRadius: 22, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, padding: 16 }, identityRow: { flexDirection: 'row', gap: 12, alignItems: 'center' }, avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.raised }, avatarFallback: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.raised, alignItems: 'center', justifyContent: 'center' }, eyebrow: { color: C.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, name: { color: C.cream, fontSize: 24, fontWeight: '900', marginTop: 2 }, role: { color: C.muted, fontSize: 10, marginTop: 2 }, location: { color: C.dim, fontSize: 9, marginTop: 3 }, iconButton: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }, bio: { color: '#CBD4CE', fontSize: 12, lineHeight: 18, marginTop: 14 }, bioEmpty: { color: C.dim, fontSize: 11, lineHeight: 17, marginTop: 14 }, stats: { flexDirection: 'row', gap: 7, marginTop: 15 }, stat: { flex: 1, backgroundColor: C.raised, borderRadius: 12, padding: 9 }, statValue: { color: C.cream, fontSize: 17, fontWeight: '900' }, statLabel: { color: C.dim, fontSize: 8, marginTop: 2 }, section: { marginTop: 24, marginBottom: 9 }, sectionTitle: { color: C.cream, fontSize: 18, fontWeight: '900' }, sectionMeta: { color: C.dim, fontSize: 10, lineHeight: 15, marginTop: 3 }, card: { borderRadius: 17, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, padding: 14, marginTop: 9 }, cardTitle: { color: C.cream, fontSize: 14, fontWeight: '900', marginBottom: 4 }, followerRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line }, followerAvatar: { width: 36, height: 36, borderRadius: 18 }, followerFallback: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.raised, alignItems: 'center', justifyContent: 'center' }, followerName: { color: C.cream, fontSize: 11, fontWeight: '900' }, followerMeta: { color: C.dim, fontSize: 9, marginTop: 2 }, field: { marginTop: 12 }, label: { color: '#D4DAD6', fontSize: 10, fontWeight: '800', marginBottom: 6 }, input: { minHeight: 46, borderWidth: 1, borderColor: '#344039', backgroundColor: '#101611', color: C.cream, borderRadius: 12, paddingHorizontal: 12, fontSize: 12 }, multiline: { minHeight: 92, paddingTop: 11 }, primary: { minHeight: 46, borderRadius: 12, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', marginTop: 14 }, primaryText: { color: '#172017', fontSize: 11, fontWeight: '900' }, secondary: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#806927', backgroundColor: '#2D2514', alignItems: 'center', justifyContent: 'center', marginTop: 14 }, secondaryText: { color: '#E7C464', fontSize: 11, fontWeight: '900' }, disabled: { opacity: .45 }, orgCard: { minHeight: 86, borderRadius: 16, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, padding: 13, flexDirection: 'row', gap: 11, marginBottom: 8 }, orgLogo: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#2A2415', alignItems: 'center', justifyContent: 'center' }, orgName: { color: C.cream, fontSize: 14, fontWeight: '900' }, orgMeta: { color: C.muted, fontSize: 9, marginTop: 3 }, orgDescription: { color: C.dim, fontSize: 10, lineHeight: 14, marginTop: 5 }, historyCard: { borderRadius: 17, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, padding: 13, marginBottom: 9 }, historyTop: { flexDirection: 'row', gap: 10, alignItems: 'center' }, eventTitle: { color: C.cream, fontSize: 13, fontWeight: '900' }, eventMeta: { color: C.muted, fontSize: 9, marginTop: 3 }, photoButton: { borderRadius: 10, borderWidth: 1, borderColor: '#5D4B1D', backgroundColor: '#251F12', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, minHeight: 34 }, photoButtonText: { color: C.gold, fontSize: 9, fontWeight: '900' }, photoRow: { gap: 8, paddingTop: 11 }, photoWrap: { width: 132 }, photo: { width: 132, height: 92, borderRadius: 11, backgroundColor: C.raised }, photoCaption: { color: C.muted, fontSize: 8, lineHeight: 11, marginTop: 4 }, noPhotos: { color: C.dim, fontSize: 9, marginTop: 10 }, empty: { borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, padding: 16 }, emptyTitle: { color: C.cream, fontSize: 13, fontWeight: '900', marginBottom: 4 }, upcomingCard: { borderRadius: 15, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }, visibilityPill: { borderRadius: 9, backgroundColor: '#252014', borderWidth: 1, borderColor: '#5D4B1D', paddingHorizontal: 8, paddingVertical: 5 }, visibilityText: { color: C.gold, fontSize: 7, fontWeight: '900' }
});
