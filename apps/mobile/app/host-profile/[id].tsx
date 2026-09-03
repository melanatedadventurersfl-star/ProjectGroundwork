import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getPublicHostProfile,
  sendHostInquiry,
  setPublicHostFollow,
  type PublicHostEvent,
  type PublicHostProfile,
} from '../../src/hosts/publicProfileApi';
import { AppIcon } from '../../src/ui/AppIcon';

function eventDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function titleCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function EventCard({ event }: { event: PublicHostEvent }) {
  return (
    <Pressable style={styles.eventCard} onPress={() => router.push(`/adventures/${event.id}`)}>
      {event.hero_image_url
        ? <Image source={{ uri: event.hero_image_url }} style={styles.eventImage} />
        : <View style={styles.eventImageFallback}><AppIcon name="adventure" color="#D7B45A" size={28} /></View>}
      <View style={styles.eventCopy}>
        <Text style={styles.eventDate}>{eventDate(event.starts_at)}</Text>
        <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
        <Text style={styles.eventMeta}>{event.city}, {event.state} · {titleCase(event.category)}</Text>
        {event.spots_remaining != null && event.status !== 'completed'
          ? <Text style={styles.spots}>{event.spots_remaining > 0 ? `${event.spots_remaining} spots left` : 'Sold out'}</Text>
          : null}
      </View>
      <AppIcon name="chevron-forward" color="#7F8C85" size={20} />
    </Pressable>
  );
}

export default function PublicHostProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<PublicHostProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageOpen, setMessageOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messageSent, setMessageSent] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const next = await getPublicHostProfile(id);
      setProfile(next);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load this host.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const location = useMemo(() => {
    if (!profile) return '';
    return profile.location_summary || [profile.home_city, profile.home_state].filter(Boolean).join(', ');
  }, [profile]);

  async function toggleFollow() {
    if (!profile || working) return;
    const next = !profile.viewer_follows;
    setWorking(true);
    setProfile({
      ...profile,
      viewer_follows: next,
      follower_count: Math.max(0, profile.follower_count + (next ? 1 : -1)),
    });
    try {
      await setPublicHostFollow(profile.id, next);
    } catch (caught) {
      setProfile(profile);
      setError(caught instanceof Error ? caught.message : 'Unable to update follow status.');
    } finally {
      setWorking(false);
    }
  }

  async function shareProfile() {
    if (!profile) return;
    const name = profile.organization_name || profile.display_name || 'Go Melanated host';
    const detail = profile.tagline || profile.bio || 'View this host on Go Melanated.';
    await Share.share({ message: `${name}\n${detail}` });
  }

  async function submitMessage() {
    if (!profile || !message.trim() || working) return;
    setWorking(true);
    try {
      await sendHostInquiry(profile.id, message.trim());
      setMessage('');
      setMessageSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to send your message.');
    } finally {
      setWorking(false);
    }
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#F5C341" /></SafeAreaView>;
  if (!profile) return <SafeAreaView style={styles.center}><Text style={styles.error}>{error ?? 'Host not found.'}</Text></SafeAreaView>;

  const name = profile.organization_name || profile.display_name || 'Host';
  const hostBadge = profile.host_type === 'official' ? 'GO MELANATED OFFICIAL' : profile.host_type === 'organization' ? 'VERIFIED ORGANIZATION' : 'APPROVED HOST';
  const gallery = profile.past_events.filter((event) => Boolean(event.hero_image_url)).slice(0, 6);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {profile.cover_url
            ? <Image source={{ uri: profile.cover_url }} style={styles.cover} />
            : <View style={styles.coverFallback}><AppIcon name="adventure" color="#D7B45A" size={38} /></View>}
          <View style={styles.heroShade} />
          <Pressable style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Back">
            <AppIcon name="chevron-back" color="#FFF" size={23} />
          </Pressable>
        </View>

        <View style={styles.identityRow}>
          {profile.avatar_url
            ? <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            : <View style={styles.avatarFallback}><Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text></View>}
          <View style={styles.identityCopy}>
            <Text style={styles.hostBadge}>{hostBadge}</Text>
            <Text style={styles.name}>{name}</Text>
            {profile.tagline ? <Text style={styles.tagline}>{profile.tagline}</Text> : null}
            {location ? <View style={styles.locationRow}><AppIcon name="location" color="#AEB9B4" size={15} /><Text style={styles.location}>{location}</Text></View> : null}
          </View>
        </View>

        <View style={styles.actionRow}>
          <Pressable style={[styles.actionButton, profile.viewer_follows && styles.actionButtonActive]} onPress={() => void toggleFollow()}>
            <AppIcon name={profile.viewer_follows ? 'checkmark' : 'add'} color={profile.viewer_follows ? '#17211C' : '#F5C341'} size={18} />
            <Text style={[styles.actionText, profile.viewer_follows && styles.actionTextActive]}>{profile.viewer_follows ? 'Following' : 'Follow'}</Text>
          </Pressable>
          {profile.accepting_messages ? <Pressable style={styles.actionButton} onPress={() => { setMessageSent(false); setMessageOpen(true); }}>
            <AppIcon name="message" color="#F5C341" size={18} />
            <Text style={styles.actionText}>Message</Text>
          </Pressable> : null}
          <Pressable style={styles.iconAction} onPress={() => void shareProfile()} accessibilityLabel="Share host profile">
            <AppIcon name="share" color="#F5C341" size={20} />
          </Pressable>
        </View>

        {profile.availability_status ? <View style={styles.statusCard}><View style={styles.statusDot} /><Text style={styles.statusText}>{profile.availability_status}</Text></View> : null}

        <View style={styles.statsRow}>
          <View style={styles.stat}><Text style={styles.statValue}>{profile.events_hosted}</Text><Text style={styles.statLabel}>Events hosted</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.stat}><Text style={styles.statValue}>{profile.follower_count}</Text><Text style={styles.statLabel}>Followers</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.stat}><Text style={styles.statValue}>{profile.upcoming_event_count}</Text><Text style={styles.statLabel}>Upcoming</Text></View>
        </View>

        {(profile.bio || profile.specialties.length) ? <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          {profile.bio ? <Text style={styles.body}>{profile.bio}</Text> : null}
          {profile.specialties.length ? <View style={styles.chips}>{profile.specialties.map((item) => <View key={item} style={styles.chip}><Text style={styles.chipText}>{item}</Text></View>)}</View> : null}
        </View> : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Upcoming events</Text><Text style={styles.sectionCount}>{profile.upcoming_events.length}</Text></View>
          {profile.upcoming_events.length
            ? profile.upcoming_events.slice(0, 6).map((event) => <EventCard key={event.id} event={event} />)
            : <Text style={styles.muted}>No public events are scheduled right now.</Text>}
        </View>

        {gallery.length ? <View style={styles.section}>
          <Text style={styles.sectionTitle}>From past events</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRow}>
            {gallery.map((event) => <Pressable key={event.id} onPress={() => router.push(`/adventures/${event.id}`)}>
              <Image source={{ uri: event.hero_image_url! }} style={styles.galleryImage} />
            </Pressable>)}
          </ScrollView>
        </View> : null}

        {profile.past_events.length ? <View style={styles.section}>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Past events</Text><Text style={styles.sectionCount}>{profile.past_events.length}</Text></View>
          {profile.past_events.slice(0, 5).map((event) => <EventCard key={event.id} event={event} />)}
        </View> : null}

        {(profile.website_url || profile.instagram_url || profile.facebook_url || profile.contact_email) ? <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact</Text>
          {profile.website_url ? <Pressable style={styles.contactRow} onPress={() => void Linking.openURL(profile.website_url!)}><AppIcon name="open" color="#F5C341" size={18} /><Text style={styles.contactText}>Website</Text></Pressable> : null}
          {profile.instagram_url ? <Pressable style={styles.contactRow} onPress={() => void Linking.openURL(profile.instagram_url!)}><AppIcon name="photos" color="#F5C341" size={18} /><Text style={styles.contactText}>Instagram</Text></Pressable> : null}
          {profile.facebook_url ? <Pressable style={styles.contactRow} onPress={() => void Linking.openURL(profile.facebook_url!)}><AppIcon name="community" color="#F5C341" size={18} /><Text style={styles.contactText}>Facebook</Text></Pressable> : null}
          {profile.contact_email ? <Pressable style={styles.contactRow} onPress={() => void Linking.openURL(`mailto:${profile.contact_email}`)}><AppIcon name="message" color="#F5C341" size={18} /><Text style={styles.contactText}>Email</Text></Pressable> : null}
        </View> : null}

        {profile.faq.length ? <View style={styles.section}>
          <Text style={styles.sectionTitle}>Common questions</Text>
          {profile.faq.map((item, index) => <View key={`${item.question}-${index}`} style={styles.faqItem}><Text style={styles.faqQuestion}>{item.question}</Text><Text style={styles.body}>{item.answer}</Text></View>)}
        </View> : null}

        {profile.policies.length ? <View style={styles.section}>
          <Text style={styles.sectionTitle}>Policies</Text>
          {profile.policies.map((item, index) => <Pressable key={`${item.label}-${index}`} style={styles.policyRow} disabled={!item.url} onPress={() => item.url ? void Linking.openURL(item.url) : undefined}>
            <Text style={styles.policyText}>{item.label || item.text}</Text>
            {item.url ? <AppIcon name="chevron-forward" color="#7F8C85" size={18} /> : null}
          </Pressable>)}
        </View> : null}
      </ScrollView>

      <Modal transparent animationType="slide" visible={messageOpen} onRequestClose={() => setMessageOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.messageSheet}>
            <View style={styles.sheetHeader}>
              <View><Text style={styles.sheetEyebrow}>CONTACT HOST</Text><Text style={styles.sheetTitle}>Message {name}</Text></View>
              <Pressable onPress={() => setMessageOpen(false)}><AppIcon name="close" color="#D8DEDA" size={27} /></Pressable>
            </View>
            {messageSent ? <View style={styles.sentCard}><AppIcon name="checkmark" color="#A8D879" size={24} /><Text style={styles.sentTitle}>Message sent</Text><Text style={styles.muted}>The host can view your inquiry inside Go Melanated.</Text></View> : <>
              <TextInput
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={2000}
                placeholder="Ask about an event, accessibility, gear, or anything else you need to know."
                placeholderTextColor="#758179"
                style={styles.messageInput}
                textAlignVertical="top"
              />
              <View style={styles.messageFooter}><Text style={styles.counter}>{message.length}/2000</Text><Pressable disabled={!message.trim() || working} style={[styles.sendButton, (!message.trim() || working) && styles.disabled]} onPress={() => void submitMessage()}><Text style={styles.sendText}>{working ? 'Sending…' : 'Send message'}</Text></Pressable></View>
            </>}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B120F' },
  center: { flex: 1, backgroundColor: '#0B120F', alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { paddingBottom: 80 },
  error: { color: '#FFB4A9', paddingHorizontal: 18 },
  hero: { height: 210, backgroundColor: '#24342B' },
  cover: { width: '100%', height: '100%' },
  coverFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,8,6,0.18)' },
  backButton: { position: 'absolute', top: 14, left: 14, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(8,14,11,0.82)', alignItems: 'center', justifyContent: 'center' },
  identityRow: { paddingHorizontal: 18, marginTop: -38, flexDirection: 'row', alignItems: 'flex-end', gap: 14 },
  avatar: { width: 92, height: 92, borderRadius: 46, borderWidth: 4, borderColor: '#0B120F', backgroundColor: '#1D2C24' },
  avatarFallback: { width: 92, height: 92, borderRadius: 46, borderWidth: 4, borderColor: '#0B120F', backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#17211C', fontSize: 34, fontWeight: '900' },
  identityCopy: { flex: 1, paddingBottom: 3 },
  hostBadge: { color: '#F5C341', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  name: { color: '#FFFFFF', fontSize: 26, lineHeight: 31, fontWeight: '900', marginTop: 3 },
  tagline: { color: '#CDD5D0', fontSize: 13, lineHeight: 18, marginTop: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  location: { color: '#AEB9B4', fontSize: 12 },
  actionRow: { flexDirection: 'row', gap: 9, paddingHorizontal: 18, marginTop: 18 },
  actionButton: { flex: 1, minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: '#4B5A52', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, backgroundColor: '#111A16' },
  actionButtonActive: { backgroundColor: '#F5C341', borderColor: '#F5C341' },
  actionText: { color: '#F7F8F3', fontWeight: '900', fontSize: 13 },
  actionTextActive: { color: '#17211C' },
  iconAction: { width: 48, height: 46, borderRadius: 13, borderWidth: 1, borderColor: '#4B5A52', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111A16' },
  statusCard: { marginHorizontal: 18, marginTop: 12, borderRadius: 12, padding: 11, backgroundColor: '#14221A', flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#8CC456' },
  statusText: { color: '#CFE0D4', fontSize: 12, fontWeight: '700' },
  statsRow: { marginHorizontal: 18, marginTop: 16, borderRadius: 16, borderWidth: 1, borderColor: '#223028', backgroundColor: '#111A16', flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: '#FFFFFF', fontSize: 21, fontWeight: '900' },
  statLabel: { color: '#8F9A94', fontSize: 10.5, marginTop: 3 },
  statDivider: { width: 1, height: 34, backgroundColor: '#28362E' },
  section: { marginHorizontal: 18, marginTop: 24, gap: 11 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  sectionCount: { color: '#F5C341', fontSize: 12, fontWeight: '900' },
  body: { color: '#CAD2CD', fontSize: 13.5, lineHeight: 21 },
  muted: { color: '#89958E', fontSize: 12.5, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#18251E', borderWidth: 1, borderColor: '#304137' },
  chipText: { color: '#D9E2DC', fontSize: 11.5, fontWeight: '700' },
  eventCard: { minHeight: 90, borderRadius: 15, borderWidth: 1, borderColor: '#223028', backgroundColor: '#111A16', padding: 9, flexDirection: 'row', alignItems: 'center', gap: 10 },
  eventImage: { width: 74, height: 72, borderRadius: 11, backgroundColor: '#223028' },
  eventImageFallback: { width: 74, height: 72, borderRadius: 11, backgroundColor: '#1D2B24', alignItems: 'center', justifyContent: 'center' },
  eventCopy: { flex: 1 },
  eventDate: { color: '#F5C341', fontSize: 10.5, fontWeight: '900', textTransform: 'uppercase' },
  eventTitle: { color: '#FFFFFF', fontSize: 14.5, lineHeight: 19, fontWeight: '900', marginTop: 2 },
  eventMeta: { color: '#89958E', fontSize: 10.5, marginTop: 3 },
  spots: { color: '#A8D879', fontSize: 10.5, fontWeight: '800', marginTop: 3 },
  galleryRow: { gap: 9 },
  galleryImage: { width: 148, height: 112, borderRadius: 14, backgroundColor: '#1D2B24' },
  contactRow: { height: 46, borderRadius: 12, backgroundColor: '#111A16', borderWidth: 1, borderColor: '#223028', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9 },
  contactText: { color: '#E6ECE8', fontSize: 13, fontWeight: '800' },
  faqItem: { borderRadius: 14, backgroundColor: '#111A16', borderWidth: 1, borderColor: '#223028', padding: 13, gap: 6 },
  faqQuestion: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '900' },
  policyRow: { minHeight: 44, borderBottomWidth: 1, borderBottomColor: '#223028', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  policyText: { color: '#DCE3DF', fontSize: 13, flex: 1 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  messageSheet: { backgroundColor: '#101813', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 34, borderWidth: 1, borderColor: '#2A3A31', gap: 16 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  sheetEyebrow: { color: '#F5C341', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  sheetTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '900', marginTop: 3 },
  messageInput: { minHeight: 150, borderRadius: 15, borderWidth: 1, borderColor: '#34463B', backgroundColor: '#0B120F', color: '#F3F5F3', padding: 13, fontSize: 14, lineHeight: 20 },
  messageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  counter: { color: '#758179', fontSize: 11 },
  sendButton: { minWidth: 136, height: 46, borderRadius: 13, backgroundColor: '#F5C341', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15 },
  sendText: { color: '#17211C', fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  sentCard: { minHeight: 130, alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 16, backgroundColor: '#132018' },
  sentTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
});
