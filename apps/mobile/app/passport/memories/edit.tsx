import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getAdventureEventPeople,
  getAdventureMemory,
  updateAdventureMemory,
  type AdventureEventPerson,
} from '../../../src/passport/EventHubApi';
import { AppIcon } from '../../../src/ui/AppIcon';

function displayName(person: AdventureEventPerson) {
  return person.display_name?.trim() || person.username?.trim() || 'Adventurer';
}

export default function EditMemoryScreen() {
  const params = useLocalSearchParams<{ memoryId?: string; adventureId?: string }>();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [people, setPeople] = useState<AdventureEventPerson[]>([]);
  const [taggedIds, setTaggedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.memoryId) {
      setError('Memory not found.');
      setLoading(false);
      return;
    }
    let active = true;
    void Promise.all([
      getAdventureMemory(params.memoryId),
      params.adventureId ? getAdventureEventPeople(params.adventureId) : Promise.resolve([]),
    ]).then(([memory, attendees]) => {
      if (!active) return;
      setTitle(memory.title ?? '');
      setBody(memory.body ?? '');
      setRating(memory.rating);
      setVisibility(memory.visibility);
      setTaggedIds(new Set(memory.tags.map((tag) => tag.profile_id)));
      setPeople(attendees.filter((person) => person.relationship_state === 'connected'));
    }).catch((caught) => {
      if (active) setError(caught instanceof Error ? caught.message : 'Unable to load memory.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [params.adventureId, params.memoryId]);

  function toggleTag(profileId: string) {
    setTaggedIds((current) => {
      const next = new Set(current);
      if (next.has(profileId)) next.delete(profileId); else next.add(profileId);
      return next;
    });
  }

  async function save() {
    if (!params.memoryId) return;
    if (!title.trim() && !body.trim() && rating === null) {
      setError('Keep at least a title, reflection, or rating.');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await updateAdventureMemory({
        memoryId: params.memoryId,
        title,
        body,
        rating,
        visibility,
        taggedProfileIds: Array.from(taggedIds),
      });
      router.back();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save changes.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#F5C341" /><Text style={styles.helper}>Opening memory…</Text></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <AppIcon name="chevron-forward" color="#F5C341" size={20} style={{ transform: [{ rotate: '180deg' }] }} />
          <Text style={styles.back}>Memory</Text>
        </Pressable>
        <Text style={styles.eyebrow}>YOUR ADVENTURE JOURNAL</Text>
        <Text style={styles.title}>Edit Memory</Text>
        <Text style={styles.subtitle}>Update the story, rating, tags, or who can see it. Existing photos stay attached.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>Memory</Text>
        <TextInput value={title} onChangeText={setTitle} maxLength={120} placeholder="Give this moment a name" placeholderTextColor="#748078" style={styles.input} />
        <TextInput value={body} onChangeText={setBody} multiline maxLength={2000} placeholder="What do you want to remember?" placeholderTextColor="#748078" style={[styles.input, styles.bodyInput]} />

        <Text style={styles.smallLabel}>RATING (OPTIONAL)</Text>
        <View style={styles.ratingRow}>{[1,2,3,4,5].map((value) => <Pressable key={value} onPress={() => setRating(rating === value ? null : value)}><Text style={[styles.star, rating !== null && value <= rating && styles.starActive]}>★</Text></Pressable>)}</View>

        <Text style={styles.label}>Tag people</Text>
        <Text style={styles.helper}>Only people you are already connected with from this adventure can be tagged.</Text>
        <View style={styles.peopleStack}>
          {people.map((person) => {
            const active = taggedIds.has(person.profile_id);
            return <Pressable key={person.profile_id} style={[styles.personRow, active && styles.personRowActive]} onPress={() => toggleTag(person.profile_id)}>
              {person.avatar_url ? <Image source={{ uri: person.avatar_url }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.avatarInitial}>{displayName(person).slice(0,1).toUpperCase()}</Text></View>}
              <View style={styles.personCopy}><Text style={styles.personName}>{displayName(person)}</Text>{person.username ? <Text style={styles.personHandle}>@{person.username}</Text> : null}</View>
              <View style={[styles.checkCircle, active && styles.checkCircleActive]}>{active ? <Text style={styles.check}>✓</Text> : null}</View>
            </Pressable>;
          })}
        </View>

        <Text style={styles.label}>Visibility</Text>
        <View style={styles.visibilityStack}>
          <Pressable style={[styles.visibilityCard, visibility === 'private' && styles.visibilityCardActive]} onPress={() => setVisibility('private')}><AppIcon name="privacy" color="#67CFC8" size={21} /><View style={styles.visibilityCopy}><Text style={styles.visibilityTitle}>Private</Text><Text style={styles.helper}>Only you can see this memory.</Text></View></Pressable>
          <Pressable style={[styles.visibilityCard, visibility === 'public' && styles.visibilityCardActive]} onPress={() => setVisibility('public')}><AppIcon name="community" color="#F5C341" size={21} /><View style={styles.visibilityCopy}><Text style={styles.visibilityTitle}>Public</Text><Text style={styles.helper}>Appears under Community Moments.</Text></View></Pressable>
        </View>

        <Pressable disabled={saving} onPress={() => void save()} style={[styles.saveButton, saving && styles.disabled]}>{saving ? <ActivityIndicator color="#17211C" /> : null}<Text style={styles.saveText}>{saving ? 'SAVING…' : 'SAVE CHANGES'}</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#111814' }, content: { padding: 18, paddingBottom: 48, gap: 12 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 38, alignSelf: 'flex-start' }, back: { color: '#F5C341', fontWeight: '900', fontSize: 16 },
  eyebrow: { color: '#55D4E0', fontSize: 11, fontWeight: '900', letterSpacing: 1.1 }, title: { color: '#F5F2E8', fontSize: 34, lineHeight: 39, fontWeight: '900' }, subtitle: { color: '#A6B0AA', fontSize: 15, lineHeight: 21 },
  error: { color: '#FFB4A9', backgroundColor: '#341D19', padding: 12, borderRadius: 12 }, label: { color: '#E9E6DD', fontSize: 16, fontWeight: '900', marginTop: 8 }, smallLabel: { color: '#91A098', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  input: { borderWidth: 1, borderColor: '#3A463F', borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, color: '#F2F0E8', backgroundColor: '#18211C', fontSize: 15 }, bodyInput: { minHeight: 130, textAlignVertical: 'top' },
  ratingRow: { flexDirection: 'row', gap: 10 }, star: { color: '#47534C', fontSize: 30 }, starActive: { color: '#F5C341' }, helper: { color: '#8F9B94', fontSize: 12, lineHeight: 17 },
  peopleStack: { gap: 8 }, personRow: { flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: '#354139', borderRadius: 13, padding: 10, backgroundColor: '#17201B' }, personRowActive: { borderColor: '#B89539' },
  avatar: { width: 44, height: 44, borderRadius: 22 }, avatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2D3932', alignItems: 'center', justifyContent: 'center' }, avatarInitial: { color: '#F5C341', fontWeight: '900' }, personCopy: { flex: 1 }, personName: { color: '#F2F0E8', fontWeight: '900' }, personHandle: { color: '#829087', fontSize: 12, marginTop: 2 },
  checkCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#58655D', alignItems: 'center', justifyContent: 'center' }, checkCircleActive: { backgroundColor: '#79D486', borderColor: '#79D486' }, check: { color: '#17211C', fontWeight: '900' },
  visibilityStack: { gap: 8 }, visibilityCard: { flexDirection: 'row', gap: 11, alignItems: 'center', borderWidth: 1, borderColor: '#354139', borderRadius: 14, padding: 13, backgroundColor: '#17201B' }, visibilityCardActive: { borderColor: '#B89539' }, visibilityCopy: { flex: 1, gap: 2 }, visibilityTitle: { color: '#F2F0E8', fontWeight: '900', fontSize: 15 },
  saveButton: { marginTop: 8, minHeight: 52, borderRadius: 14, backgroundColor: '#F5C341', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, saveText: { color: '#17211C', fontWeight: '900', letterSpacing: .6 }, disabled: { opacity: .65 },
});
