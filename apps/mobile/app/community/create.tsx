import Ionicons from '@react-native-vector-icons/ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createPost } from '../../src/community/api';

type PostType = 'update' | 'photo' | 'ask' | 'meetup' | 'buddy' | 'recommendation';
type Audience = 'everyone' | 'connections' | 'circle' | 'group';

const GOLD = '#D7B45A';
const BG = '#0F1713';
const CARD = '#17211C';
const BORDER = '#2A3930';
const TEXT = '#FFF8E8';
const MUTED = '#9EAAA2';

const postTypes: Array<{ value: PostType; label: string; helper: string; icon: string }> = [
  { value: 'update', label: 'Update', helper: 'Share a thought, trip note, or outdoor moment.', icon: 'create-outline' },
  { value: 'photo', label: 'Photo', helper: 'Start with a photo and add a caption.', icon: 'images-outline' },
  { value: 'ask', label: 'Ask', helper: 'Ask the community for advice or recommendations.', icon: 'help-circle-outline' },
  { value: 'meetup', label: 'Meetup', helper: 'Plan something people can join.', icon: 'calendar-outline' },
  { value: 'buddy', label: 'Adventure Buddy', helper: 'Find people for a hike, paddle, camp, or trip.', icon: 'people-outline' },
  { value: 'recommendation', label: 'Recommend a Place', helper: 'Share a trail, park, campsite, or hidden gem.', icon: 'trail-sign-outline' },
];

const audiences: Array<{ value: Audience; label: string; helper: string; enabled: boolean }> = [
  { value: 'everyone', label: 'Everyone', helper: 'Visible across Community.', enabled: true },
  { value: 'connections', label: 'My Connections', helper: 'Only people you have connected with.', enabled: false },
  { value: 'circle', label: 'A Circle', helper: 'Share with one of your private Circles.', enabled: false },
  { value: 'group', label: 'A Group', helper: 'Post inside one of your communities.', enabled: false },
];

function placeholderFor(type: PostType) {
  if (type === 'ask') return 'What do you want to ask the community?';
  if (type === 'buddy') return 'What are you hoping to do, where, and when?';
  if (type === 'recommendation') return 'What place are you recommending and why?';
  return 'What’s happening outside?';
}

export default function CreateCommunityPostScreen() {
  const params = useLocalSearchParams<{ type?: string }>();
  const initialType = postTypes.some((item) => item.value === params.type) ? params.type as PostType : 'update';
  const [type, setType] = useState<PostType>(initialType);
  const [audience, setAudience] = useState<Audience>('everyone');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(() => postTypes.find((item) => item.value === type)!, [type]);

  async function submit() {
    if (type === 'meetup') {
      router.replace('/local-events/create');
      return;
    }
    if (type === 'photo') {
      setError('Photo uploads are the next media step. You can still switch to Update and post text now.');
      return;
    }
    if (!body.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const prefix = type === 'ask' ? 'Question: ' : type === 'buddy' ? 'Adventure Buddy: ' : type === 'recommendation' ? 'Recommendation: ' : '';
      await createPost(`${prefix}${body.trim()}`);
      router.back();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to publish this post.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <Pressable style={styles.closeButton} onPress={() => router.back()}><Ionicons name="close" size={23} color={TEXT} /></Pressable>
          <View style={styles.flex}><Text style={styles.eyebrow}>COMMUNITY</Text><Text style={styles.title}>Create Post</Text></View>
          <Pressable disabled={submitting || (!body.trim() && !['meetup', 'photo'].includes(type))} style={[styles.postButton, (submitting || (!body.trim() && !['meetup', 'photo'].includes(type))) && styles.disabled]} onPress={() => void submit()}>
            {submitting ? <ActivityIndicator color="#101510" size="small" /> : <Text style={styles.postButtonText}>{type === 'meetup' ? 'Continue' : 'Post'}</Text>}
          </Pressable>
        </View>

        <View style={styles.audienceCard}>
          <Text style={styles.label}>SHARE WITH</Text>
          <View style={styles.audienceRow}>
            <View style={styles.audienceIcon}><Ionicons name="globe-outline" size={19} color={GOLD} /></View>
            <View style={styles.flex}><Text style={styles.audienceTitle}>{audiences.find((item) => item.value === audience)?.label}</Text><Text style={styles.audienceHelper}>Choose who this is for</Text></View>
          </View>
          <View style={styles.audienceOptions}>
            {audiences.map((item) => (
              <Pressable key={item.value} disabled={!item.enabled} onPress={() => setAudience(item.value)} style={[styles.audienceOption, audience === item.value && styles.audienceOptionActive, !item.enabled && styles.optionDisabled]}>
                <View style={[styles.radio, audience === item.value && styles.radioActive]}>{audience === item.value ? <View style={styles.radioDot} /> : null}</View>
                <View style={styles.flex}><Text style={styles.optionTitle}>{item.label}</Text><Text style={styles.optionHelper}>{item.helper}{!item.enabled ? ' · Coming next' : ''}</Text></View>
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>What are you posting?</Text>
        <View style={styles.typeGrid}>
          {postTypes.map((item) => (
            <Pressable key={item.value} onPress={() => { setType(item.value); setError(null); }} style={[styles.typeCard, type === item.value && styles.typeCardActive]}>
              <Ionicons name={item.icon as never} size={22} color={type === item.value ? GOLD : '#C5CEC8'} />
              <Text style={[styles.typeLabel, type === item.value && styles.typeLabelActive]}>{item.label}</Text>
              <Text style={styles.typeHelper}>{item.helper}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.composerCard}>
          <View style={styles.composerHeading}><View style={styles.typeBadge}><Ionicons name={selected.icon as never} size={16} color={GOLD} /><Text style={styles.typeBadgeText}>{selected.label}</Text></View><Text style={styles.counter}>{body.length}/4000</Text></View>
          {type === 'meetup' ? <Text style={styles.guidance}>Meetups have dates, locations, attendance, and invitations, so this will continue into the Meetup creator.</Text> : type === 'photo' ? <Text style={styles.guidance}>The photo-first composer is staged here. Media upload wiring is the next step before Photo can publish.</Text> : (
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder={placeholderFor(type)}
              placeholderTextColor="#738078"
              multiline
              maxLength={4000}
              autoFocus
              style={styles.input}
            />
          )}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  content: { padding: 18, paddingBottom: 48, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  eyebrow: { color: '#AA9461', fontSize: 10.5, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: TEXT, fontSize: 28, fontWeight: '900', marginTop: 1 },
  postButton: { minWidth: 70, minHeight: 40, borderRadius: 12, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  postButtonText: { color: '#101510', fontWeight: '900' },
  disabled: { opacity: 0.45 },
  audienceCard: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 17, padding: 13, gap: 10 },
  label: { color: '#BBA56E', fontSize: 10.5, fontWeight: '900', letterSpacing: 1 },
  audienceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  audienceIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#1E2C25', alignItems: 'center', justifyContent: 'center' },
  audienceTitle: { color: TEXT, fontWeight: '900', fontSize: 15 },
  audienceHelper: { color: MUTED, fontSize: 11.5, marginTop: 2 },
  audienceOptions: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#38463D' },
  audienceOption: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#324038' },
  audienceOptionActive: { backgroundColor: '#1A251F' },
  optionDisabled: { opacity: 0.48 },
  radio: { width: 19, height: 19, borderRadius: 10, borderWidth: 1.5, borderColor: '#6B776F', alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: GOLD },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: GOLD },
  optionTitle: { color: TEXT, fontWeight: '800', fontSize: 13.5 },
  optionHelper: { color: MUTED, fontSize: 11, lineHeight: 15, marginTop: 2 },
  sectionTitle: { color: TEXT, fontSize: 18, fontWeight: '900', marginTop: 2 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  typeCard: { width: '48.5%', minHeight: 112, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 15, padding: 11, gap: 5 },
  typeCardActive: { borderColor: '#8A764A', backgroundColor: '#1B2721' },
  typeLabel: { color: '#E0E6E2', fontWeight: '900', fontSize: 13 },
  typeLabelActive: { color: GOLD },
  typeHelper: { color: '#87948C', fontSize: 10.5, lineHeight: 14 },
  composerCard: { minHeight: 190, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 17, padding: 13, gap: 10 },
  composerHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: '#1D2B24', borderRadius: 99 },
  typeBadgeText: { color: '#E4D3A2', fontWeight: '800', fontSize: 11.5 },
  counter: { color: '#738078', fontSize: 10.5 },
  input: { minHeight: 140, color: TEXT, fontSize: 16, lineHeight: 23, textAlignVertical: 'top' },
  guidance: { color: '#C5CEC8', fontSize: 14, lineHeight: 21, paddingVertical: 22 },
  error: { color: '#FFB4A9', backgroundColor: '#301A18', padding: 11, borderRadius: 12, lineHeight: 18 },
});
