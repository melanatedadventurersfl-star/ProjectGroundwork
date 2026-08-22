import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getEventGalleryPhotos,
  getOwnedEventPhotos,
  getOwnedMemoryPhotos,
  getPassportStamps,
  type MemoryPhoto,
  type PassportStamp,
} from '../../../src/passport/api';
import {
  actOnAdventureConnection,
  getAdventureEventPeople,
  getAdventureMemories,
  getCommunityAdventureMemories,
  updateAdventureMemoryVisibility,
  type AdventureEventPerson,
  type AdventureMemory,
  type RelationshipState,
} from '../../../src/passport/EventHubApi';
import { STAMP_CATALOG } from '../../../src/passport/StampCatalog';
import { AppIcon } from '../../../src/ui/AppIcon';

type HubTab = 'memory' | 'event';

function personName(person: AdventureEventPerson) {
  return person.display_name?.trim() || person.username?.trim() || 'Adventurer';
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function photoMapByMemory(photos: MemoryPhoto[]) {
  const result = new Map<string, MemoryPhoto[]>();
  for (const photo of photos) {
    if (!photo.memory_id) continue;
    const current = result.get(photo.memory_id) ?? [];
    current.push(photo);
    result.set(photo.memory_id, current);
  }
  return result;
}

function connectionLabel(state: RelationshipState, busy: boolean) {
  if (busy) return 'WORKING…';
  if (state === 'outgoing_pending') return 'REQUESTED';
  if (state === 'incoming_pending') return 'ACCEPT';
  if (state === 'connected') return 'CONNECTED';
  return 'CONNECT';
}

export default function StampDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const stamp = useMemo(() => STAMP_CATALOG.find((item) => item.id === params.id), [params.id]);

  const [earnedStamps, setEarnedStamps] = useState<PassportStamp[]>([]);
  const [memories, setMemories] = useState<AdventureMemory[]>([]);
  const [memoryPhotos, setMemoryPhotos] = useState<MemoryPhoto[]>([]);
  const [eventPhotos, setEventPhotos] = useState<MemoryPhoto[]>([]);
  const [ownedEventPhotos, setOwnedEventPhotos] = useState<MemoryPhoto[]>([]);
  const [eventPeople, setEventPeople] = useState<AdventureEventPerson[]>([]);
  const [communityMoments, setCommunityMoments] = useState<AdventureMemory[]>([]);
  const [activeTab, setActiveTab] = useState<HubTab>('memory');
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [visibilityId, setVisibilityId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const earned = useMemo(
    () => stamp?.code ? earnedStamps.find((item) => item.code === stamp.code) : undefined,
    [earnedStamps, stamp],
  );
  const adventureId = earned?.adventure_id ?? null;

  const load = useCallback(async () => {
    if (!stamp) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const stamps = await getPassportStamps();
      setEarnedStamps(stamps);
      const matched = stamp.code ? stamps.find((item) => item.code === stamp.code) : undefined;
      const id = matched?.adventure_id ?? null;

      if (!id) {
        setMemories([]);
        setMemoryPhotos([]);
        setEventPhotos([]);
        setOwnedEventPhotos([]);
        setEventPeople([]);
        setCommunityMoments([]);
      } else {
        const [memoryResult, photoResult, peopleResult, galleryResult, ownedEventResult, communityResult] = await Promise.allSettled([
          getAdventureMemories(id),
          getOwnedMemoryPhotos(id),
          getAdventureEventPeople(id),
          getEventGalleryPhotos(id),
          getOwnedEventPhotos(id),
          getCommunityAdventureMemories(id),
        ]);
        setMemories(memoryResult.status === 'fulfilled' ? memoryResult.value : []);
        setMemoryPhotos(photoResult.status === 'fulfilled' ? photoResult.value.filter((photo) => photo.source_kind !== 'event_upload') : []);
        setEventPeople(peopleResult.status === 'fulfilled' ? peopleResult.value : []);
        setEventPhotos(galleryResult.status === 'fulfilled' ? galleryResult.value : []);
        setOwnedEventPhotos(ownedEventResult.status === 'fulfilled' ? ownedEventResult.value : []);
        setCommunityMoments(communityResult.status === 'fulfilled' ? communityResult.value : []);
      }
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to open this stamp.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [stamp]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const connectedPeople = useMemo(
    () => eventPeople.filter((person) => person.relationship_state === 'connected'),
    [eventPeople],
  );
  const connectablePeople = useMemo(
    () => eventPeople.filter((person) => person.relationship_state !== 'connected'),
    [eventPeople],
  );
  const photosByMemory = useMemo(() => photoMapByMemory(memoryPhotos), [memoryPhotos]);

  const visibleEventPhotos = useMemo(() => {
    const approvedIds = new Set(eventPhotos.map((photo) => photo.id));
    const pendingOwn = ownedEventPhotos.filter((photo) => photo.visibility === 'public' && !approvedIds.has(photo.id));
    return [...pendingOwn, ...eventPhotos];
  }, [eventPhotos, ownedEventPhotos]);

  const handleConnection = useCallback(async (person: AdventureEventPerson) => {
    if (person.relationship_state === 'outgoing_pending' || person.relationship_state === 'connected' || connectingId) return;
    setConnectingId(person.profile_id);
    try {
      const state = await actOnAdventureConnection(person.profile_id);
      setEventPeople((current) => current.map((item) => item.profile_id === person.profile_id
        ? { ...item, relationship_state: state, is_connected: state === 'connected' }
        : item));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update that connection.');
    } finally {
      setConnectingId(null);
    }
  }, [connectingId]);

  const toggleVisibility = useCallback(async (memory: AdventureMemory) => {
    if (visibilityId) return;
    const next = memory.visibility === 'public' ? 'private' : 'public';
    setVisibilityId(memory.id);
    try {
      await updateAdventureMemoryVisibility(memory.id, next);
      setMemories((current) => current.map((item) => item.id === memory.id ? { ...item, visibility: next } : item));
      if (next === 'public') {
        setCommunityMoments((current) => [{ ...memory, visibility: 'public' }, ...current.filter((item) => item.id !== memory.id)]);
      } else {
        setCommunityMoments((current) => current.filter((item) => item.id !== memory.id));
      }
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to change memory visibility.');
    } finally {
      setVisibilityId(null);
    }
  }, [visibilityId]);

  if (!stamp) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <AppIcon name="stamp" color="#F5C341" size={42} />
          <Text style={styles.missingTitle}>Stamp not found</Text>
          <Pressable onPress={() => router.back()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Back to Stamps</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color="#F5C341" />
          <Text style={styles.loadingText}>Opening your stamp…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor="#F5C341" />}
      >
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to stamps">
          <AppIcon name="chevron-forward" color="#F5C341" size={21} style={{ transform: [{ rotate: '180deg' }] }} />
          <Text style={styles.backText}>Stamps</Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={styles.heroArt}><Image source={stamp.source} style={styles.stampImage} resizeMode="contain" /></View>
            <View style={styles.heroInfo}>
              <Text style={styles.title}>{stamp.title}</Text>
              <View style={styles.metaItem}><AppIcon name="adventure" color="#67CFC8" size={14} /><Text style={styles.meta}>{stamp.dateLabel}</Text></View>
              <View style={styles.metaItem}><AppIcon name="location" color="#67CFC8" size={14} /><Text style={styles.meta}>{stamp.location}</Text></View>
            </View>
          </View>
          <View style={styles.heroStatusRow}>
            <View style={[styles.statusPill, earned ? styles.statusEarned : styles.statusPreview]}>
              {earned ? <AppIcon name="checkmark" color="#17211C" size={12} /> : null}
              <Text style={[styles.statusText, !earned && styles.statusPreviewText]}>{earned ? 'COLLECTED' : 'PREVIEW'}</Text>
            </View>
            <Text style={styles.statusDot}>•</Text>
            <Text style={styles.collection}>{stamp.year} COLLECTION</Text>
          </View>
        </View>

        {earned && adventureId ? (
          <>
            <View style={styles.tabs}>
              <Pressable onPress={() => setActiveTab('memory')} style={[styles.tab, activeTab === 'memory' && styles.tabActive]}>
                <AppIcon name="profile" color={activeTab === 'memory' ? '#F5C341' : '#8D9992'} size={17} />
                <Text style={[styles.tabText, activeTab === 'memory' && styles.tabTextActive]}>My Memory</Text>
              </Pressable>
              <Pressable onPress={() => setActiveTab('event')} style={[styles.tab, activeTab === 'event' && styles.tabActive]}>
                <AppIcon name="community" color={activeTab === 'event' ? '#F5C341' : '#8D9992'} size={17} />
                <Text style={[styles.tabText, activeTab === 'event' && styles.tabTextActive]}>Event</Text>
              </Pressable>
            </View>

            {activeTab === 'memory' ? (
              <>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderCopy}>
                    <Text style={styles.eyebrow}>YOUR MEMORIES</Text>
                    <Text style={styles.sectionTitle}>{memories.length ? `${memories.length} ${memories.length === 1 ? 'memory' : 'memories'}` : 'Start your memories'}</Text>
                  </View>
                  <Pressable
                    onPress={() => router.push({ pathname: '/passport/memories/add', params: { adventureId, mode: 'memory' } })}
                    style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}
                  >
                    <AppIcon name="add" color="#F5C341" size={15} />
                    <Text style={styles.outlineButtonText}>ADD MEMORY</Text>
                  </Pressable>
                </View>

                {memories.length ? memories.map((memory) => (
                  <MemoryCard
                    key={memory.id}
                    memory={memory}
                    photos={photosByMemory.get(memory.id) ?? []}
                    changingVisibility={visibilityId === memory.id}
                    onToggleVisibility={() => void toggleVisibility(memory)}
                  />
                )) : (
                  <Pressable
                    onPress={() => router.push({ pathname: '/passport/memories/add', params: { adventureId, mode: 'memory' } })}
                    style={({ pressed }) => [styles.emptyCard, pressed && styles.pressed]}
                  >
                    <AppIcon name="photo" color="#67CFC8" size={28} />
                    <Text style={styles.emptyTitle}>Save your first moment</Text>
                    <Text style={styles.emptyBody}>Add a reflection, photos, a rating, and tag connected people from this adventure.</Text>
                  </Pressable>
                )}

                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeaderCompact}>
                    <View style={styles.sectionHeaderCopy}>
                      <Text style={styles.eyebrow}>CONNECTED FROM THIS ADVENTURE</Text>
                      <Text style={styles.cardTitle}>{connectedPeople.length ? 'People in your adventure circle' : 'No connections here yet'}</Text>
                    </View>
                  </View>
                  {connectedPeople.length ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatarStrip}>
                      {connectedPeople.map((person) => <ConnectedAvatar key={person.profile_id} person={person} />)}
                    </ScrollView>
                  ) : <Text style={styles.emptyBody}>When you connect with someone from this event, they will appear here and become available for memory tags.</Text>}
                  <View style={styles.helperLine}><AppIcon name="privacy" color="#67CFC8" size={13} /><Text style={styles.helperText}>Only connected attendees can be tagged in memories.</Text></View>
                </View>
              </>
            ) : (
              <>
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeaderCompact}>
                    <View style={styles.sectionHeaderCopy}>
                      <Text style={styles.eyebrow}>EVENT GALLERY</Text>
                      <Text style={styles.cardTitle}>{visibleEventPhotos.length ? `${visibleEventPhotos.length} shared ${visibleEventPhotos.length === 1 ? 'photo' : 'photos'}` : 'Share the adventure'}</Text>
                    </View>
                    <Pressable
                      onPress={() => router.push({ pathname: '/passport/memories/add', params: { adventureId, mode: 'event' } })}
                      style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}
                    >
                      <AppIcon name="add" color="#F5C341" size={15} />
                      <Text style={styles.outlineButtonText}>ADD PHOTO</Text>
                    </Pressable>
                  </View>

                  {visibleEventPhotos.length ? (
                    <View style={styles.galleryGrid}>
                      {visibleEventPhotos.slice(0, 9).map((photo) => (
                        <View key={photo.id} style={styles.galleryTile}>
                          <Image source={{ uri: photo.image_url }} style={styles.galleryImage} />
                          {photo.moderation_status === 'pending' ? <View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>PENDING</Text></View> : null}
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Pressable onPress={() => router.push({ pathname: '/passport/memories/add', params: { adventureId, mode: 'event' } })} style={styles.inlineEmpty}>
                      <AppIcon name="photos" color="#67CFC8" size={25} />
                      <View style={styles.inlineEmptyCopy}><Text style={styles.emptyTitle}>The gallery is waiting.</Text><Text style={styles.emptyBody}>Public event photos automatically appear here after moderation.</Text></View>
                    </Pressable>
                  )}
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.eyebrow}>PEOPLE YOU CAN CONNECT TO</Text>
                  <Text style={styles.cardTitle}>{connectablePeople.length ? 'People from this adventure' : 'You are caught up'}</Text>
                  {connectablePeople.length ? (
                    <View style={styles.connectionStack}>
                      {connectablePeople.map((person) => {
                        const busy = connectingId === person.profile_id;
                        const state = person.relationship_state;
                        const disabled = busy || state === 'outgoing_pending' || state === 'connected';
                        return (
                          <View key={person.profile_id} style={styles.connectionRow}>
                            <Pressable onPress={() => router.push({ pathname: '/community-profile/[id]', params: { id: person.profile_id } })} style={styles.connectionIdentity}>
                              <PersonAvatar person={person} size={46} />
                              <View style={styles.connectionCopy}>
                                <Text style={styles.personName}>{personName(person)}</Text>
                                {person.username ? <Text style={styles.personHandle}>@{person.username}</Text> : null}
                                {state === 'incoming_pending' ? <Text style={styles.requestedBy}>Requested you</Text> : null}
                              </View>
                            </Pressable>
                            <Pressable
                              disabled={disabled}
                              onPress={() => void handleConnection(person)}
                              style={[
                                styles.connectionButton,
                                state === 'incoming_pending' && styles.acceptButton,
                                state === 'outgoing_pending' && styles.requestedButton,
                              ]}
                            >
                              <Text style={[
                                styles.connectionButtonText,
                                state === 'outgoing_pending' && styles.requestedButtonText,
                              ]}>{connectionLabel(state, busy)}</Text>
                            </Pressable>
                          </View>
                        );
                      })}
                    </View>
                  ) : <Text style={styles.emptyBody}>Accepted connections move to My Memory so you can tag them in future memories.</Text>}
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.eyebrow}>COMMUNITY MOMENTS</Text>
                  <Text style={styles.cardTitle}>{communityMoments.length ? 'Public memories from this adventure' : 'No public memories yet'}</Text>
                  {communityMoments.length ? (
                    <View style={styles.momentStack}>
                      {communityMoments.slice(0, 8).map((memory) => (
                        <View key={memory.id} style={styles.communityMoment}>
                          <View style={styles.communityMomentHeader}>
                            <AppIcon name="community" color="#67CFC8" size={14} />
                            <Text style={styles.communityMomentMeta}>{memory.author_name || 'Community member'} · {formatDate(memory.created_at)}</Text>
                          </View>
                          {memory.title ? <Text style={styles.communityMomentTitle}>{memory.title}</Text> : null}
                          {memory.body ? <Text style={styles.communityMomentBody}>{memory.body}</Text> : null}
                          {memory.tags.length ? <Text style={styles.tagSummary}>With {memory.tags.map((tag) => tag.display_name || tag.username || 'Adventurer').join(', ')}</Text> : null}
                        </View>
                      ))}
                    </View>
                  ) : <Text style={styles.emptyBody}>When a member marks a memory Public, it automatically appears here.</Text>}
                </View>
              </>
            )}
          </>
        ) : (
          <View style={styles.lockedCard}>
            <AppIcon name="stamp" color="#67CFC8" size={26} />
            <Text style={styles.emptyTitle}>Collect this stamp to unlock its adventure hub.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MemoryCard({
  memory,
  photos,
  changingVisibility,
  onToggleVisibility,
}: {
  memory: AdventureMemory;
  photos: MemoryPhoto[];
  changingVisibility: boolean;
  onToggleVisibility: () => void;
}) {
  return (
    <View style={styles.memoryCard}>
      {photos.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.memoryPhotoStrip}>
          {photos.slice(0, 6).map((photo) => <Image key={photo.id} source={{ uri: photo.image_url }} style={styles.memoryPhoto} />)}
        </ScrollView>
      ) : null}
      <View style={styles.memoryContent}>
        <View style={styles.memoryTopRow}>
          <View style={styles.memoryDateWrap}>
            <Text style={styles.memoryDate}>{formatDate(memory.created_at)}</Text>
            {memory.rating ? <Text style={styles.memoryRating}>{'★'.repeat(memory.rating)}<Text style={styles.unfilledStars}>{'★'.repeat(5 - memory.rating)}</Text></Text> : null}
          </View>
          <Pressable onPress={onToggleVisibility} disabled={changingVisibility} style={styles.visibilityPill}>
            <AppIcon name={memory.visibility === 'public' ? 'community' : 'privacy'} color={memory.visibility === 'public' ? '#7BC987' : '#67CFC8'} size={12} />
            <Text style={[styles.visibilityPillText, memory.visibility === 'public' && styles.publicText]}>{changingVisibility ? 'UPDATING…' : memory.visibility.toUpperCase()}</Text>
          </Pressable>
        </View>
        {memory.title ? <Text style={styles.memoryTitle}>{memory.title}</Text> : null}
        {memory.body ? <Text style={styles.memoryBody}>{memory.body}</Text> : null}
        {memory.tags.length ? (
          <View style={styles.tagsLine}>
            <Text style={styles.tagsLabel}>WITH</Text>
            <View style={styles.miniAvatars}>
              {memory.tags.slice(0, 4).map((tag) => tag.avatar_url
                ? <Image key={tag.profile_id} source={{ uri: tag.avatar_url }} style={styles.miniAvatar} />
                : <View key={tag.profile_id} style={[styles.miniAvatar, styles.miniAvatarFallback]}><Text style={styles.miniInitial}>{(tag.display_name || tag.username || 'A').slice(0, 1).toUpperCase()}</Text></View>)}
            </View>
            <Text style={styles.tagNames} numberOfLines={1}>{memory.tags.map((tag) => tag.display_name || tag.username || 'Adventurer').join(', ')}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function ConnectedAvatar({ person }: { person: AdventureEventPerson }) {
  return (
    <Pressable onPress={() => router.push({ pathname: '/community-profile/[id]', params: { id: person.profile_id } })} style={styles.connectedPerson}>
      <PersonAvatar person={person} size={56} />
      <Text style={styles.connectedName} numberOfLines={1}>{personName(person)}</Text>
    </Pressable>
  );
}

function PersonAvatar({ person, size }: { person: AdventureEventPerson; size: number }) {
  return person.avatar_url ? (
    <Image source={{ uri: person.avatar_url }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={styles.avatarFallbackText}>{personName(person).slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#111814' },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 44, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  loadingText: { color: '#9AA69F', fontSize: 14 },
  missingTitle: { color: '#F5F2E8', fontSize: 20, fontWeight: '900' },
  primaryButton: { backgroundColor: '#F5C341', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 },
  primaryButtonText: { color: '#17211C', fontWeight: '900' },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 2, minHeight: 38 },
  backText: { color: '#F5C341', fontWeight: '900', fontSize: 16 },
  error: { color: '#FFB4A9', backgroundColor: '#341D19', borderRadius: 10, padding: 11, fontSize: 13, lineHeight: 18 },
  heroCard: { borderWidth: 1, borderColor: '#39463E', backgroundColor: '#19221D', borderRadius: 18, padding: 14, gap: 13 },
  heroRow: { flexDirection: 'row', gap: 14 },
  heroArt: { width: 116, height: 150, alignItems: 'center', justifyContent: 'center' },
  stampImage: { width: '100%', height: '100%' },
  heroInfo: { flex: 1, gap: 9, paddingTop: 4 },
  title: { color: '#F6F3EA', fontSize: 23, lineHeight: 27, fontWeight: '950' },
  metaItem: { flexDirection: 'row', gap: 7, alignItems: 'flex-start' },
  meta: { color: '#C3CBC6', fontSize: 13, lineHeight: 18, flex: 1 },
  heroStatusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  statusPill: { flexDirection: 'row', gap: 5, alignItems: 'center', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 },
  statusEarned: { backgroundColor: '#79D486' },
  statusPreview: { borderWidth: 1, borderColor: '#58645E' },
  statusText: { color: '#17211C', fontSize: 10, fontWeight: '950', letterSpacing: 1 },
  statusPreviewText: { color: '#A3ADA7' },
  statusDot: { color: '#69756E' },
  collection: { color: '#55D4E0', fontSize: 11, fontWeight: '950', letterSpacing: 1 },
  tabs: { flexDirection: 'row', height: 50, borderWidth: 1, borderColor: '#465149', borderRadius: 13, overflow: 'hidden', backgroundColor: '#171E1A' },
  tab: { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { backgroundColor: '#202721', borderBottomColor: '#F5C341' },
  tabText: { color: '#A0AAA4', fontWeight: '800', fontSize: 14 },
  tabTextActive: { color: '#F5C341' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, paddingHorizontal: 2 },
  sectionHeaderCompact: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionHeaderCopy: { flex: 1 },
  eyebrow: { color: '#55D4E0', fontSize: 11, fontWeight: '950', letterSpacing: 1.1 },
  sectionTitle: { color: '#F3F0E7', fontSize: 20, fontWeight: '950', marginTop: 3 },
  cardTitle: { color: '#F3F0E7', fontSize: 18, lineHeight: 22, fontWeight: '900', marginTop: 3 },
  outlineButton: { minHeight: 38, borderRadius: 99, borderWidth: 1, borderColor: '#B89539', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  outlineButtonText: { color: '#F5C341', fontSize: 11, fontWeight: '950' },
  sectionCard: { borderWidth: 1, borderColor: '#344138', backgroundColor: '#18211C', borderRadius: 16, padding: 14, gap: 12 },
  emptyCard: { borderWidth: 1, borderColor: '#344138', borderStyle: 'dashed', backgroundColor: '#161F1A', borderRadius: 16, minHeight: 150, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 7 },
  emptyTitle: { color: '#ECEAE2', fontWeight: '900', fontSize: 15 },
  emptyBody: { color: '#929F97', fontSize: 13, lineHeight: 18 },
  memoryCard: { borderWidth: 1, borderColor: '#39463E', backgroundColor: '#1A231E', borderRadius: 16, overflow: 'hidden' },
  memoryPhotoStrip: { gap: 4, backgroundColor: '#101712' },
  memoryPhoto: { width: 180, height: 150, backgroundColor: '#263129' },
  memoryContent: { padding: 14, gap: 8 },
  memoryTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  memoryDateWrap: { flex: 1, gap: 3 },
  memoryDate: { color: '#8E9A93', fontSize: 11, fontWeight: '700' },
  memoryRating: { color: '#F5C341', fontSize: 13, letterSpacing: 1 },
  unfilledStars: { color: '#47534C' },
  visibilityPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#46534B', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 99 },
  visibilityPillText: { color: '#67CFC8', fontSize: 9, fontWeight: '950', letterSpacing: 0.7 },
  publicText: { color: '#7BC987' },
  memoryTitle: { color: '#F4F1E8', fontSize: 18, lineHeight: 22, fontWeight: '950' },
  memoryBody: { color: '#C0C8C3', fontSize: 14, lineHeight: 20 },
  tagsLine: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 3 },
  tagsLabel: { color: '#87948D', fontSize: 9, fontWeight: '950', letterSpacing: 1 },
  miniAvatars: { flexDirection: 'row' },
  miniAvatar: { width: 24, height: 24, borderRadius: 12, marginRight: -5, borderWidth: 1, borderColor: '#1A231E' },
  miniAvatarFallback: { backgroundColor: '#2D3932', alignItems: 'center', justifyContent: 'center' },
  miniInitial: { color: '#F5C341', fontSize: 9, fontWeight: '900' },
  tagNames: { color: '#AEB8B2', fontSize: 11, flex: 1 },
  avatarStrip: { gap: 14, paddingVertical: 2 },
  connectedPerson: { width: 70, alignItems: 'center', gap: 6 },
  connectedName: { color: '#DDE2DE', fontSize: 11, width: 70, textAlign: 'center' },
  avatarFallback: { backgroundColor: '#2D3932', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#B89539' },
  avatarFallbackText: { color: '#F5C341', fontWeight: '950' },
  helperLine: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 },
  helperText: { color: '#839087', fontSize: 11, flex: 1 },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  galleryTile: { width: '31.8%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: '#28342C', position: 'relative' },
  galleryImage: { width: '100%', height: '100%' },
  pendingBadge: { position: 'absolute', left: 5, bottom: 5, backgroundColor: 'rgba(17,24,20,0.88)', borderRadius: 99, paddingHorizontal: 6, paddingVertical: 3 },
  pendingBadgeText: { color: '#F5C341', fontSize: 8, fontWeight: '950' },
  inlineEmpty: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#3D4A42', borderRadius: 13, padding: 14 },
  inlineEmptyCopy: { flex: 1, gap: 3 },
  connectionStack: { gap: 8 },
  connectionRow: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: '#354139', borderRadius: 13, padding: 9, backgroundColor: '#151E19' },
  connectionIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  connectionCopy: { flex: 1 },
  personName: { color: '#F0EEE6', fontWeight: '900', fontSize: 14 },
  personHandle: { color: '#829087', fontSize: 11, marginTop: 2 },
  requestedBy: { color: '#F5C341', fontSize: 10, fontWeight: '800', marginTop: 2 },
  connectionButton: { minWidth: 94, minHeight: 36, borderRadius: 99, backgroundColor: '#F5C341', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  acceptButton: { backgroundColor: '#79D486' },
  requestedButton: { backgroundColor: '#202822', borderWidth: 1, borderColor: '#59655E' },
  connectionButtonText: { color: '#17211C', fontSize: 10, fontWeight: '950' },
  requestedButtonText: { color: '#B2BBB5' },
  momentStack: { gap: 8 },
  communityMoment: { borderWidth: 1, borderColor: '#344138', backgroundColor: '#151E19', borderRadius: 12, padding: 12, gap: 6 },
  communityMomentHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  communityMomentMeta: { color: '#829087', fontSize: 10, fontWeight: '700' },
  communityMomentTitle: { color: '#F1EFE7', fontWeight: '900', fontSize: 15 },
  communityMomentBody: { color: '#B8C2BC', fontSize: 13, lineHeight: 18 },
  tagSummary: { color: '#67CFC8', fontSize: 11, fontWeight: '700' },
  lockedCard: { borderWidth: 1, borderColor: '#354139', borderRadius: 16, minHeight: 130, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20 },
  pressed: { opacity: 0.75 },
});
