import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCommunityFeed, type CommunityPost } from '../../../src/community/api';
import {
  getEventGalleryPhotos,
  getOwnedMemoryPhotos,
  getPassportStamps,
  saveEventGalleryPhoto,
  type MemoryPhoto,
  type PassportStamp,
} from '../../../src/passport/api';
import {
  getAdventureEventPeople,
  getAdventureEventReflection,
  requestAdventureConnection,
  saveAdventureEventReflection,
  type AdventureEventPerson,
  type AdventureEventReflection,
} from '../../../src/passport/EventHubApi';
import { STAMP_CATALOG } from '../../../src/passport/StampCatalog';
import { AppIcon } from '../../../src/ui/AppIcon';

type HubTab = 'memory' | 'event';
type MemoryVisibility = 'private' | 'community';

function personName(person: AdventureEventPerson) {
  return person.display_name?.trim() || person.username?.trim() || 'Adventurer';
}

function personInitial(person: AdventureEventPerson) {
  return personName(person).slice(0, 1).toUpperCase();
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function photoStatus(photo: MemoryPhoto) {
  if (photo.visibility === 'private') return { label: 'PRIVATE', icon: 'privacy' as const, kind: 'private' as const };
  if (photo.moderation_status === 'pending') return { label: 'PENDING', icon: 'photo' as const, kind: 'pending' as const };
  if (photo.moderation_status === 'rejected') return { label: 'NOT APPROVED', icon: 'privacy' as const, kind: 'rejected' as const };
  return { label: 'EVENT GALLERY', icon: 'community' as const, kind: 'shared' as const };
}

export default function StampDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const stamp = useMemo(() => STAMP_CATALOG.find((item) => item.id === params.id), [params.id]);
  const [earnedStamps, setEarnedStamps] = useState<PassportStamp[]>([]);
  const [reflection, setReflection] = useState<AdventureEventReflection | null>(null);
  const [photos, setPhotos] = useState<MemoryPhoto[]>([]);
  const [eventPhotos, setEventPhotos] = useState<MemoryPhoto[]>([]);
  const [eventPeople, setEventPeople] = useState<AdventureEventPerson[]>([]);
  const [communityMoments, setCommunityMoments] = useState<CommunityPost[]>([]);
  const [activeTab, setActiveTab] = useState<HubTab>('memory');
  const [ratingOpen, setRatingOpen] = useState(false);
  const [savingRating, setSavingRating] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [memoryHighlight, setMemoryHighlight] = useState('');
  const [memoryNotes, setMemoryNotes] = useState('');
  const [memoryVisibility, setMemoryVisibility] = useState<MemoryVisibility>('private');
  const [savingMemory, setSavingMemory] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<MemoryPhoto | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const [savingPhotoId, setSavingPhotoId] = useState<string | null>(null);
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

      if (matched?.adventure_id) {
        const id = matched.adventure_id;
        const [memoryPhotos, reflectionResult] = await Promise.all([
          getOwnedMemoryPhotos(id),
          getAdventureEventReflection(id),
        ]);
        setPhotos(memoryPhotos);
        setReflection(reflectionResult);

        const [peopleResult, galleryResult, feedResult] = await Promise.allSettled([
          getAdventureEventPeople(id),
          getEventGalleryPhotos(id),
          getCommunityFeed(id),
        ]);
        setEventPeople(peopleResult.status === 'fulfilled' ? peopleResult.value : []);
        setEventPhotos(galleryResult.status === 'fulfilled' ? galleryResult.value : []);
        setCommunityMoments(feedResult.status === 'fulfilled' ? feedResult.value : []);
      } else {
        setReflection(null);
        setPhotos([]);
        setEventPhotos([]);
        setEventPeople([]);
        setCommunityMoments([]);
      }
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to open this adventure hub.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [stamp]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const rating = reflection?.rating ?? null;
  const hasNotes = Boolean(reflection?.highlight || reflection?.reflection);
  const connectedPeople = useMemo(() => eventPeople.filter((person) => person.is_connected), [eventPeople]);
  const recommendedPeople = useMemo(() => eventPeople.filter((person) => !person.is_connected), [eventPeople]);
  const ownSharedPhotos = useMemo(
    () => photos.filter((photo) => photo.source_kind === 'personal' && photo.visibility !== 'private'),
    [photos],
  );
  const eventDisplayPhotos = useMemo(() => {
    const byId = new Map<string, MemoryPhoto>();
    for (const photo of ownSharedPhotos) byId.set(photo.id, photo);
    for (const photo of eventPhotos) byId.set(photo.id, photo);
    return Array.from(byId.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [eventPhotos, ownSharedPhotos]);
  const pendingCount = ownSharedPhotos.filter((photo) => photo.moderation_status === 'pending').length;

  const savedSourceIds = useMemo(() => {
    const ids = new Set<string>();
    for (const photo of photos) {
      ids.add(photo.id);
      if (photo.source_photo_id) ids.add(photo.source_photo_id);
    }
    return ids;
  }, [photos]);

  const saveRating = useCallback(async (nextRating: number) => {
    if (!adventureId || savingRating) return;
    setSavingRating(true);
    try {
      await saveAdventureEventReflection({
        adventureId,
        rating: nextRating,
        highlight: reflection?.highlight ?? '',
        reflection: reflection?.reflection ?? '',
        visibility: reflection?.visibility ?? 'private',
      });
      setReflection((current) => ({
        rating: nextRating,
        highlight: current?.highlight ?? null,
        reflection: current?.reflection ?? null,
        visibility: current?.visibility ?? 'private',
      }));
      setRatingOpen(false);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save your rating.');
    } finally {
      setSavingRating(false);
    }
  }, [adventureId, reflection, savingRating]);

  const openMemoryEditor = useCallback(() => {
    setMemoryHighlight(reflection?.highlight ?? '');
    setMemoryNotes(reflection?.reflection ?? '');
    setMemoryVisibility(reflection?.visibility ?? 'private');
    setMemoryOpen(true);
  }, [reflection]);

  const saveMemory = useCallback(async () => {
    if (!adventureId || savingMemory) return;
    setSavingMemory(true);
    try {
      await saveAdventureEventReflection({
        adventureId,
        rating,
        highlight: memoryHighlight,
        reflection: memoryNotes,
        visibility: memoryVisibility,
      });
      setReflection({
        rating,
        highlight: memoryHighlight.trim() || null,
        reflection: memoryNotes.trim() || null,
        visibility: memoryVisibility,
      });
      setMemoryOpen(false);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save your memory.');
    } finally {
      setSavingMemory(false);
    }
  }, [adventureId, memoryHighlight, memoryNotes, memoryVisibility, rating, savingMemory]);

  const connect = useCallback(async (person: AdventureEventPerson) => {
    if (person.is_connected || requestedIds.has(person.profile_id) || connectingId) return;
    setConnectingId(person.profile_id);
    try {
      await requestAdventureConnection(person.profile_id);
      setRequestedIds((current) => new Set(current).add(person.profile_id));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to send that connection request.');
    } finally {
      setConnectingId(null);
    }
  }, [connectingId, requestedIds]);

  const saveGalleryPhoto = useCallback(async (photo: MemoryPhoto) => {
    if (!adventureId || savedSourceIds.has(photo.id) || savingPhotoId) return;
    setSavingPhotoId(photo.id);
    try {
      const saved = await saveEventGalleryPhoto({
        adventureId,
        imageUrl: photo.storage_path ?? photo.image_url,
        sourcePhotoId: photo.id,
        caption: photo.caption ?? undefined,
      });
      setPhotos((current) => [saved, ...current]);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save that photo to your memory.');
    } finally {
      setSavingPhotoId(null);
    }
  }, [adventureId, savedSourceIds, savingPhotoId]);

  if (!stamp) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.missing}>
          <AppIcon name="stamp" color="#F5C341" size={42} />
          <Text style={styles.missingTitle}>Stamp not found</Text>
          <Pressable onPress={() => router.back()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Back to Stamps</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color="#F5C341" />
        <Text style={styles.loadingText}>Opening your adventure hub…</Text>
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
          <AppIcon name="chevron-forward" color="#F5C341" size={22} style={{ transform: [{ rotate: '180deg' }] }} />
          <Text style={styles.backText}>Stamps</Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={[styles.heroArt, stamp.year === 2026 && styles.heroArtTall]}><Image source={stamp.source} style={styles.stampImage} resizeMode="contain" /></View>
            <View style={styles.heroInfo}>
              <Text style={styles.title}>{stamp.title}</Text>
              <View style={styles.metaItem}><AppIcon name="adventure" color="#67CFC8" size={14} /><Text style={styles.meta}>{stamp.dateLabel}</Text></View>
              <View style={styles.metaItem}><AppIcon name="location" color="#67CFC8" size={14} /><Text style={styles.meta}>{stamp.location}</Text></View>
              {earned && adventureId ? (
                <View style={styles.ratingArea}>
                  {!ratingOpen ? (
                    <Pressable onPress={() => setRatingOpen(true)} style={({ pressed }) => [styles.rateButton, pressed && styles.pressed]}>
                      <AppIcon name="edit" color="#F5C341" size={13} />
                      <Text style={styles.rateButtonText}>{rating ? `RATED ${rating}/5` : 'RATE'}</Text>
                    </Pressable>
                  ) : (
                    <View style={styles.inlineStars}>
                      {[1, 2, 3, 4, 5].map((value) => (
                        <Pressable key={value} disabled={savingRating} onPress={() => void saveRating(value)} hitSlop={6}>
                          <Text style={[styles.inlineStar, rating !== null && value <= rating ? styles.inlineStarFilled : null]}>★</Text>
                        </Pressable>
                      ))}
                      <Pressable onPress={() => setRatingOpen(false)} hitSlop={8}><Text style={styles.cancelTiny}>CANCEL</Text></Pressable>
                    </View>
                  )}
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.heroStatusRow}>
            <View style={[styles.statusPill, earned ? styles.statusPillEarned : styles.statusPillPreview]}>
              {earned ? <AppIcon name="checkmark" color="#17211C" size={12} /> : null}
              <Text style={[styles.statusText, !earned && styles.statusTextPreview]}>{earned ? 'COLLECTED' : 'PREVIEW'}</Text>
            </View>
            <Text style={styles.statusDot}>•</Text>
            <Text style={styles.collection}>{stamp.year} COLLECTION</Text>
          </View>
        </View>

        {earned && adventureId ? (
          <>
            <View style={styles.tabs}>
              <Pressable onPress={() => setActiveTab('memory')} style={[styles.tab, activeTab === 'memory' && styles.tabActive]} accessibilityRole="tab" accessibilityState={{ selected: activeTab === 'memory' }}>
                <AppIcon name="profile" color={activeTab === 'memory' ? '#F5C341' : '#8D9992'} size={17} />
                <Text style={[styles.tabText, activeTab === 'memory' && styles.tabTextActive]}>My Memory</Text>
              </Pressable>
              <Pressable onPress={() => setActiveTab('event')} style={[styles.tab, activeTab === 'event' && styles.tabActive]} accessibilityRole="tab" accessibilityState={{ selected: activeTab === 'event' }}>
                <AppIcon name="community" color={activeTab === 'event' ? '#F5C341' : '#8D9992'} size={17} />
                <Text style={[styles.tabText, activeTab === 'event' && styles.tabTextActive]}>Event</Text>
              </Pressable>
            </View>

            {activeTab === 'memory' ? (
              <>
                <View style={styles.sectionCard}>
                  <View style={styles.cardHeadingRow}>
                    <View style={styles.headingCopy}><Text style={styles.cardEyebrow}>MY REFLECTION</Text><Text style={styles.cardTitle}>{hasNotes ? 'What I want to remember' : 'Make this stamp yours'}</Text></View>
                    <Pressable onPress={openMemoryEditor} style={({ pressed }) => [styles.editMemoryButton, pressed && styles.pressed]}><Text style={styles.editMemoryText}>{hasNotes ? 'EDIT' : 'ADD MEMORY'}</Text></Pressable>
                  </View>
                  {reflection?.highlight ? <View style={styles.memoryQuote}><Text style={styles.quoteMark}>“</Text><Text style={styles.highlight}>{reflection.highlight}</Text></View> : null}
                  {reflection?.reflection ? <Text style={styles.reflection}>{reflection.reflection}</Text> : null}
                  {!hasNotes ? <Text style={styles.emptyBody}>Save the part of this adventure you want to carry with you.</Text> : null}
                  <View style={styles.privateLine}><AppIcon name={reflection?.visibility === 'community' ? 'community' : 'privacy'} color="#67CFC8" size={13} /><Text style={styles.privateLineText}>{reflection?.visibility === 'community' ? 'Shared reflection' : 'Private reflection'}</Text></View>
                </View>

                <View style={styles.sectionCard}>
                  <View style={styles.cardHeadingRow}>
                    <View style={styles.headingCopy}><Text style={styles.cardEyebrow}>MY PHOTOS</Text><Text style={styles.cardTitle}>{photos.length ? `${photos.length} saved ${photos.length === 1 ? 'moment' : 'moments'}` : 'Build your photo memory'}</Text></View>
                    <Pressable onPress={() => router.push(`/passport/photos/${adventureId}`)} hitSlop={10}><Text style={styles.actionText}>+ ADD PHOTO</Text></Pressable>
                  </View>
                  {photos.length ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip}>
                      {photos.slice(0, 10).map((photo) => <PhotoTile key={photo.id} photo={photo} onPress={() => setSelectedPhoto(photo)} />)}
                      <Pressable onPress={() => router.push(`/passport/photos/${adventureId}`)} style={styles.addPhotoTile}><AppIcon name="add" color="#D7B45A" size={26} /><Text style={styles.addPhotoTileText}>Add Photo</Text></Pressable>
                    </ScrollView>
                  ) : (
                    <Pressable onPress={() => router.push(`/passport/photos/${adventureId}`)} style={({ pressed }) => [styles.photoEmpty, pressed && styles.pressed]}>
                      <AppIcon name="photo" color="#67CFC8" size={25} /><Text style={styles.emptyTitle}>No photos saved yet.</Text><Text style={styles.emptyBody}>Private photos stay here. Shared photos also appear on the Event tab.</Text>
                    </Pressable>
                  )}
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.cardEyebrow}>COMMUNITY MOMENTS</Text>
                  <Text style={styles.cardTitle}>{communityMoments.length ? 'Conversation around this adventure' : 'No conversation yet'}</Text>
                  {communityMoments.length ? communityMoments.slice(0, 3).map((post) => <CommunityMoment key={post.id} post={post} />) : <Text style={styles.emptyBody}>Shared posts and conversation connected to this adventure will appear here.</Text>}
                </View>

                <PeopleSection
                  eventPeople={eventPeople}
                  connectedPeople={connectedPeople}
                  recommendedPeople={recommendedPeople}
                  requestedIds={requestedIds}
                  connectingId={connectingId}
                  onConnect={connect}
                />
              </>
            ) : (
              <>
                <View style={styles.sectionCard}>
                  <View style={styles.cardHeadingRow}>
                    <View style={styles.headingCopy}><Text style={styles.cardEyebrow}>EVENT GALLERY</Text><Text style={styles.cardTitle}>{eventDisplayPhotos.length ? `${eventDisplayPhotos.length} shared ${eventDisplayPhotos.length === 1 ? 'moment' : 'moments'}` : 'Shared moments from the event'}</Text></View>
                    {pendingCount ? <View style={styles.pendingCounter}><Text style={styles.pendingCounterText}>{pendingCount} PENDING</Text></View> : null}
                  </View>
                  {eventDisplayPhotos.length ? (
                    <View style={styles.eventPhotoGrid}>
                      {eventDisplayPhotos.slice(0, 9).map((photo) => {
                        const saved = savedSourceIds.has(photo.id);
                        const saving = savingPhotoId === photo.id;
                        const isOwn = photos.some((owned) => owned.id === photo.id);
                        return (
                          <View key={photo.id} style={styles.eventPhotoCard}>
                            <Pressable onPress={() => setSelectedPhoto(photo)} style={({ pressed }) => pressed && styles.pressed}>
                              <Image source={{ uri: photo.image_url }} style={styles.eventPhoto} />
                              <PhotoStatusBadge photo={photo} compact />
                            </Pressable>
                            {!isOwn && photo.moderation_status === 'approved' ? (
                              <Pressable disabled={saved || saving} onPress={() => void saveGalleryPhoto(photo)} style={[styles.savePhotoButton, saved && styles.savePhotoButtonSaved]}>
                                <Text style={[styles.savePhotoText, saved && styles.savePhotoTextSaved]}>{saved ? 'SAVED' : saving ? 'SAVING…' : 'SAVE TO MEMORY'}</Text>
                              </Pressable>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <View style={styles.inlineEmpty}><AppIcon name="photos" color="#67CFC8" size={24} /><View style={styles.inlineEmptyCopy}><Text style={styles.emptyTitle}>The event gallery is quiet.</Text><Text style={styles.emptyBody}>If you submit a photo, it will appear here immediately with its moderation status.</Text></View></View>
                  )}
                </View>

                {pendingCount ? (
                  <View style={styles.sectionCard}>
                    <Text style={styles.cardEyebrow}>YOUR SUBMITTED PHOTOS</Text>
                    <Text style={styles.cardTitle}>{pendingCount} {pendingCount === 1 ? 'photo is' : 'photos are'} awaiting approval</Text>
                    <Text style={styles.emptyBody}>You can see your submission immediately. Other attendees will only see it after approval.</Text>
                  </View>
                ) : null}

                <View style={styles.sectionCard}>
                  <Text style={styles.cardEyebrow}>ATTENDEES</Text>
                  <Text style={styles.cardTitle}>{eventPeople.length ? `${eventPeople.length} discoverable ${eventPeople.length === 1 ? 'person' : 'people'}` : 'People from this adventure'}</Text>
                  {eventPeople.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.peopleRow}>{eventPeople.map((person) => <PersonTile key={person.profile_id} person={person} connected={person.is_connected} />)}</ScrollView> : <Text style={styles.emptyBody}>No discoverable attendees yet.</Text>}
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.cardEyebrow}>COMMUNITY CONVERSATION</Text>
                  <Text style={styles.cardTitle}>{communityMoments.length ? `${communityMoments.length} from this adventure` : 'The shared story'}</Text>
                  {communityMoments.length ? communityMoments.slice(0, 5).map((post) => <CommunityMoment key={post.id} post={post} />) : <Text style={styles.emptyBody}>Posts tied to this adventure will appear here.</Text>}
                </View>
              </>
            )}
          </>
        ) : (
          <View style={styles.lockedCard}><AppIcon name="stamp" color="#D7B45A" size={25} /><View style={styles.lockedCopy}><Text style={styles.emptyTitle}>This is a collection preview.</Text><Text style={styles.emptyBody}>When the stamp is earned and linked to an adventure, it becomes your memory and connection hub for that event.</Text></View></View>
        )}
      </ScrollView>

      <Modal visible={memoryOpen} transparent animationType="slide" onRequestClose={() => setMemoryOpen(false)}>
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.modalBackdrop} onPress={() => setMemoryOpen(false)} />
          <View style={styles.memorySheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}><View style={styles.headingCopy}><Text style={styles.cardEyebrow}>YOUR MEMORY</Text><Text style={styles.sheetTitle}>What do you want to remember?</Text></View><Pressable onPress={() => setMemoryOpen(false)}><Text style={styles.sheetClose}>CLOSE</Text></Pressable></View>
            <Text style={styles.inputLabel}>Favorite moment</Text>
            <TextInput value={memoryHighlight} onChangeText={setMemoryHighlight} placeholder="The laugh, the view, the first step…" placeholderTextColor="#748078" style={styles.singleInput} maxLength={180} />
            <Text style={styles.inputLabel}>Memory or note</Text>
            <TextInput value={memoryNotes} onChangeText={setMemoryNotes} placeholder="What happened? What do you want to remember later?" placeholderTextColor="#748078" style={styles.notesInput} multiline textAlignVertical="top" maxLength={1800} />
            <Text style={styles.inputLabel}>Who can see this memory?</Text>
            <View style={styles.visibilityRow}>
              <Pressable onPress={() => setMemoryVisibility('private')} style={[styles.visibilityChoice, memoryVisibility === 'private' && styles.visibilityChoiceActive]}><AppIcon name="privacy" color={memoryVisibility === 'private' ? '#17211C' : '#AEB9B2'} size={17} /><View style={styles.visibilityCopy}><Text style={[styles.visibilityTitle, memoryVisibility === 'private' && styles.visibilityTitleActive]}>Only Me</Text><Text style={[styles.visibilityBody, memoryVisibility === 'private' && styles.visibilityBodyActive]}>Keep it in my Passport</Text></View></Pressable>
              <Pressable onPress={() => setMemoryVisibility('community')} style={[styles.visibilityChoice, memoryVisibility === 'community' && styles.visibilityChoiceActive]}><AppIcon name="community" color={memoryVisibility === 'community' ? '#17211C' : '#AEB9B2'} size={17} /><View style={styles.visibilityCopy}><Text style={[styles.visibilityTitle, memoryVisibility === 'community' && styles.visibilityTitleActive]}>Community</Text><Text style={[styles.visibilityBody, memoryVisibility === 'community' && styles.visibilityBodyActive]}>Share this reflection</Text></View></Pressable>
            </View>
            <Pressable disabled={savingMemory} onPress={() => void saveMemory()} style={[styles.saveMemoryButton, savingMemory && styles.buttonDisabled]}><Text style={styles.saveMemoryText}>{savingMemory ? 'SAVING…' : 'SAVE MEMORY'}</Text></Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={Boolean(selectedPhoto)} transparent animationType="fade" onRequestClose={() => setSelectedPhoto(null)}>
        <View style={styles.photoModalRoot}>
          <Pressable style={styles.photoModalBackdrop} onPress={() => setSelectedPhoto(null)} />
          {selectedPhoto ? (
            <View style={styles.photoDetailCard}>
              <Image source={{ uri: selectedPhoto.image_url }} style={styles.photoDetailImage} resizeMode="contain" />
              <View style={styles.photoDetailBody}>
                <View style={styles.photoDetailHeader}><PhotoStatusBadge photo={selectedPhoto} /><Pressable onPress={() => setSelectedPhoto(null)} hitSlop={10}><Text style={styles.sheetClose}>CLOSE</Text></Pressable></View>
                {selectedPhoto.caption ? <Text style={styles.photoCaption}>{selectedPhoto.caption}</Text> : <Text style={styles.emptyBody}>No caption added.</Text>}
                <Text style={styles.photoDate}>{formatDate(selectedPhoto.created_at)}</Text>
                {selectedPhoto.moderation_status === 'pending' && selectedPhoto.visibility !== 'private' ? <Text style={styles.photoStatusNote}>This photo is visible to you now and will appear to other attendees after approval.</Text> : null}
                {selectedPhoto.moderation_status === 'rejected' ? <Text style={styles.photoStatusNote}>This photo was not approved for the Event Gallery. It remains in your personal memory.</Text> : null}
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function PhotoStatusBadge({ photo, compact = false }: { photo: MemoryPhoto; compact?: boolean }) {
  const status = photoStatus(photo);
  return (
    <View style={[styles.photoStatusBadge, compact && styles.photoStatusBadgeCompact, status.kind === 'private' && styles.photoStatusPrivate, status.kind === 'pending' && styles.photoStatusPending, status.kind === 'rejected' && styles.photoStatusRejected, status.kind === 'shared' && styles.photoStatusShared]}>
      <AppIcon name={status.icon} color={status.kind === 'pending' ? '#17211C' : '#F7F8F3'} size={compact ? 10 : 12} />
      <Text style={[styles.photoStatusText, status.kind === 'pending' && styles.photoStatusTextDark]}>{status.label}</Text>
    </View>
  );
}

function PhotoTile({ photo, onPress }: { photo: MemoryPhoto; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.memoryPhotoCard, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Open photo, ${photoStatus(photo).label.toLowerCase()}`}>
      <Image source={{ uri: photo.image_url }} style={styles.memoryPhoto} />
      <PhotoStatusBadge photo={photo} compact />
    </Pressable>
  );
}

function CommunityMoment({ post }: { post: CommunityPost }) {
  return (
    <Pressable onPress={() => router.push({ pathname: '/community/[id]', params: { id: post.id } })} style={({ pressed }) => [styles.momentCard, pressed && styles.pressed]}>
      <View style={styles.momentHeader}>{post.avatar_url ? <Image source={{ uri: post.avatar_url }} style={styles.momentAvatar} /> : <View style={[styles.momentAvatar, styles.avatarFallback]}><Text style={styles.momentAvatarText}>{post.author_name.slice(0, 1).toUpperCase()}</Text></View>}<View style={styles.momentHeaderCopy}><Text style={styles.momentAuthor}>{post.author_name}</Text><Text style={styles.momentDate}>{formatDate(post.created_at)}</Text></View></View>
      <Text style={styles.momentBody} numberOfLines={4}>{post.body}</Text>
      {post.image_url ? <Image source={{ uri: post.image_url }} style={styles.momentImage} /> : null}
      <View style={styles.momentStats}><Text style={styles.momentStat}>♥ {post.reaction_count}</Text><Text style={styles.momentStat}>◌ {post.comment_count}</Text></View>
    </Pressable>
  );
}

function PeopleSection({ eventPeople, connectedPeople, recommendedPeople, requestedIds, connectingId, onConnect }: {
  eventPeople: AdventureEventPerson[];
  connectedPeople: AdventureEventPerson[];
  recommendedPeople: AdventureEventPerson[];
  requestedIds: Set<string>;
  connectingId: string | null;
  onConnect: (person: AdventureEventPerson) => void;
}) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.cardEyebrow}>PEOPLE FROM THIS ADVENTURE</Text>
      <Text style={styles.cardTitle}>{eventPeople.length ? `${eventPeople.length} ${eventPeople.length === 1 ? 'person' : 'people'} from this adventure` : 'People you met here'}</Text>
      {connectedPeople.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.peopleRow}>{connectedPeople.map((person) => <PersonTile key={person.profile_id} person={person} connected />)}</ScrollView> : null}
      {recommendedPeople.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.peopleRow}>
          {recommendedPeople.map((person) => {
            const requested = requestedIds.has(person.profile_id);
            const connecting = connectingId === person.profile_id;
            return (
              <View key={person.profile_id} style={styles.recommendationCard}>
                <Pressable onPress={() => router.push({ pathname: '/community-profile/[id]', params: { id: person.profile_id } })} style={styles.recommendationIdentity}><Avatar person={person} /><Text style={styles.personName} numberOfLines={1}>{personName(person)}</Text>{person.username ? <Text style={styles.personHandle} numberOfLines={1}>@{person.username}</Text> : null}</Pressable>
                <Pressable disabled={requested || connecting} onPress={() => onConnect(person)} style={[styles.connectButton, requested && styles.connectButtonRequested]}><Text style={[styles.connectButtonText, requested && styles.connectButtonTextRequested]}>{requested ? 'REQUESTED' : connecting ? 'SENDING…' : 'CONNECT'}</Text></Pressable>
              </View>
            );
          })}
        </ScrollView>
      ) : null}
      {!eventPeople.length ? <Text style={styles.emptyBody}>No discoverable attendees yet.</Text> : null}
    </View>
  );
}

function Avatar({ person }: { person: AdventureEventPerson }) {
  return person.avatar_url ? <Image source={{ uri: person.avatar_url }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarInitial}>{personInitial(person)}</Text></View>;
}

function PersonTile({ person, connected }: { person: AdventureEventPerson; connected: boolean }) {
  return (
    <Pressable onPress={() => router.push({ pathname: '/community-profile/[id]', params: { id: person.profile_id } })} style={({ pressed }) => [styles.personCard, pressed && styles.pressed]}>
      <View style={styles.avatarWrap}><Avatar person={person} />{connected ? <View style={styles.connectedDot}><AppIcon name="checkmark" color="#08201D" size={12} /></View> : null}</View>
      <Text style={styles.personName} numberOfLines={1}>{personName(person)}</Text>
      <Text style={[styles.personMeta, connected && styles.personMetaConnected]}>{connected ? 'Connected' : 'Met here'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#09110F' },
  loading: { flex: 1, backgroundColor: '#09110F', alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: '#98A59E', fontWeight: '700' },
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 72, gap: 13 },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginLeft: -5 },
  backText: { color: '#F5C341', fontWeight: '800' },
  error: { color: '#FFB4A9', backgroundColor: '#2A1715', borderRadius: 12, padding: 12 },
  heroCard: { backgroundColor: '#111A17', borderWidth: 1, borderColor: '#29342F', borderRadius: 22, padding: 14, gap: 11 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroArt: { width: 122, height: 153, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  heroArtTall: { height: 164 },
  stampImage: { width: '100%', height: '100%' },
  heroInfo: { flex: 1, gap: 8, minWidth: 0 },
  title: { color: '#F7F8F3', fontSize: 22, lineHeight: 26, fontWeight: '900' },
  metaItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  meta: { flex: 1, color: '#B6C1BB', fontSize: 12, lineHeight: 17 },
  ratingArea: { minHeight: 30, justifyContent: 'center', marginTop: 1 },
  rateButton: { alignSelf: 'flex-start', minHeight: 30, borderRadius: 999, borderWidth: 1, borderColor: '#5A5130', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10 },
  rateButtonText: { color: '#F5C341', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.7 },
  inlineStars: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  inlineStar: { color: '#4B5751', fontSize: 25, lineHeight: 29 },
  inlineStarFilled: { color: '#F5C341' },
  cancelTiny: { color: '#929E97', fontSize: 8, fontWeight: '900', marginLeft: 4 },
  heroStatusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusPillEarned: { backgroundColor: '#7EDB80' },
  statusPillPreview: { borderWidth: 1, borderColor: '#45534C' },
  statusText: { color: '#17211C', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 },
  statusTextPreview: { color: '#9AA69F' },
  statusDot: { color: '#5E6A64', fontSize: 10 },
  collection: { color: '#67CFC8', fontSize: 9.5, fontWeight: '900', letterSpacing: 1 },
  tabs: { minHeight: 48, flexDirection: 'row', borderWidth: 1, borderColor: '#33423B', borderRadius: 14, overflow: 'hidden', backgroundColor: '#0D1512' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 12 },
  tabActive: { backgroundColor: '#16231F' },
  tabText: { color: '#8D9992', fontSize: 13.5, fontWeight: '800' },
  tabTextActive: { color: '#F5C341' },
  sectionCard: { backgroundColor: '#111A17', borderWidth: 1, borderColor: '#29342F', borderRadius: 18, padding: 15, gap: 12 },
  cardHeadingRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headingCopy: { flex: 1 },
  cardEyebrow: { color: '#67CFC8', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  cardTitle: { color: '#F7F8F3', fontSize: 16, lineHeight: 20, fontWeight: '900', marginTop: 3 },
  actionText: { color: '#F5C341', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.55, paddingTop: 2 },
  editMemoryButton: { borderRadius: 999, borderWidth: 1, borderColor: '#5A5130', paddingHorizontal: 10, paddingVertical: 7 },
  editMemoryText: { color: '#F5C341', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.5 },
  memoryQuote: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  quoteMark: { color: '#F5C341', fontSize: 35, lineHeight: 31, fontWeight: '900' },
  highlight: { flex: 1, color: '#F7F8F3', fontSize: 17, lineHeight: 23, fontWeight: '900' },
  reflection: { color: '#B8C3BD', fontSize: 13.5, lineHeight: 20 },
  privateLine: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 3 },
  privateLineText: { color: '#829088', fontSize: 10.5, fontWeight: '700' },
  peopleRow: { gap: 13, paddingRight: 4 },
  personCard: { width: 82, alignItems: 'center', gap: 5 },
  avatarWrap: { width: 58, height: 58, position: 'relative' },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#1C2822', borderWidth: 1, borderColor: '#D7B45A' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#F7F8F3', fontSize: 20, fontWeight: '900' },
  connectedDot: { position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#67CFC8', borderWidth: 2, borderColor: '#111A17' },
  personName: { color: '#F7F8F3', width: '100%', textAlign: 'center', fontSize: 11.5, fontWeight: '900' },
  personHandle: { color: '#8B9790', width: '100%', textAlign: 'center', fontSize: 9, marginTop: -2 },
  personMeta: { color: '#8B9790', width: '100%', textAlign: 'center', fontSize: 9.5, lineHeight: 12 },
  personMetaConnected: { color: '#67CFC8' },
  recommendationCard: { width: 116, borderRadius: 14, borderWidth: 1, borderColor: '#2E3B35', backgroundColor: '#0D1512', padding: 9, gap: 8, alignItems: 'center' },
  recommendationIdentity: { alignItems: 'center', gap: 4, width: '100%' },
  connectButton: { width: '100%', minHeight: 30, borderRadius: 999, backgroundColor: '#F5C341', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  connectButtonRequested: { backgroundColor: '#24312B' },
  connectButtonText: { color: '#17211C', fontSize: 8, fontWeight: '900', letterSpacing: 0.4 },
  connectButtonTextRequested: { color: '#8FD4C7' },
  inlineEmpty: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 5 },
  inlineEmptyCopy: { flex: 1, gap: 4 },
  emptyTitle: { color: '#F7F8F3', fontSize: 14, lineHeight: 18, fontWeight: '900' },
  emptyBody: { color: '#929E97', fontSize: 12.5, lineHeight: 18 },
  photoStrip: { gap: 9, paddingRight: 4 },
  memoryPhotoCard: { width: 132, height: 132, borderRadius: 13, overflow: 'hidden', backgroundColor: '#18231E' },
  memoryPhoto: { width: '100%', height: '100%' },
  photoStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  photoStatusBadgeCompact: { position: 'absolute', left: 6, bottom: 6, paddingHorizontal: 6, paddingVertical: 4 },
  photoStatusPrivate: { backgroundColor: 'rgba(7,14,12,0.88)' },
  photoStatusPending: { backgroundColor: '#F5C341' },
  photoStatusRejected: { backgroundColor: '#7C3434' },
  photoStatusShared: { backgroundColor: 'rgba(28,83,70,0.94)' },
  photoStatusText: { color: '#F7F8F3', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.4 },
  photoStatusTextDark: { color: '#17211C' },
  addPhotoTile: { width: 132, height: 132, borderRadius: 13, borderWidth: 1, borderStyle: 'dashed', borderColor: '#48564F', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addPhotoTileText: { color: '#B7C1BB', fontSize: 11, fontWeight: '800' },
  photoEmpty: { minHeight: 112, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#34423B', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 5 },
  eventPhotoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  eventPhotoCard: { width: '31.6%', borderRadius: 12, overflow: 'hidden', backgroundColor: '#18231E' },
  eventPhoto: { width: '100%', aspectRatio: 1, backgroundColor: '#1A2520' },
  savePhotoButton: { minHeight: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5C341', paddingHorizontal: 4 },
  savePhotoButtonSaved: { backgroundColor: '#24312B' },
  savePhotoText: { color: '#17211C', fontSize: 6.8, fontWeight: '900', letterSpacing: 0.35, textAlign: 'center' },
  savePhotoTextSaved: { color: '#8FD4C7' },
  pendingCounter: { backgroundColor: '#F5C341', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  pendingCounterText: { color: '#17211C', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.4 },
  momentCard: { borderTopWidth: 1, borderTopColor: '#25312C', paddingTop: 12, gap: 8 },
  momentHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  momentAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1B2721' },
  momentAvatarText: { color: '#F7F8F3', fontSize: 13, fontWeight: '900' },
  momentHeaderCopy: { flex: 1 },
  momentAuthor: { color: '#F7F8F3', fontSize: 12.5, fontWeight: '900' },
  momentDate: { color: '#7F8B84', fontSize: 9.5, marginTop: 1 },
  momentBody: { color: '#C2CBC5', fontSize: 12.5, lineHeight: 18 },
  momentImage: { width: '100%', height: 142, borderRadius: 12, backgroundColor: '#19241F' },
  momentStats: { flexDirection: 'row', gap: 14 },
  momentStat: { color: '#8F9B94', fontSize: 10.5, fontWeight: '800' },
  lockedCard: { backgroundColor: '#111A17', borderWidth: 1, borderColor: '#29342F', borderRadius: 18, padding: 15, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  lockedCopy: { flex: 1, gap: 5 },
  primaryButton: { minHeight: 50, borderRadius: 15, backgroundColor: '#F5C341', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primaryButtonText: { color: '#17211C', fontSize: 14, fontWeight: '900' },
  pressed: { opacity: 0.72 },
  buttonDisabled: { opacity: 0.55 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  missingTitle: { color: '#F7F8F3', fontSize: 22, fontWeight: '900' },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.58)' },
  memorySheet: { backgroundColor: '#101916', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: '#2D3B34', paddingHorizontal: 18, paddingTop: 10, paddingBottom: 24, gap: 11, maxHeight: '88%' },
  sheetHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#425048', alignSelf: 'center', marginBottom: 3 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  sheetTitle: { color: '#F7F8F3', fontSize: 21, lineHeight: 25, fontWeight: '900', marginTop: 3 },
  sheetClose: { color: '#F5C341', fontSize: 9, fontWeight: '900', paddingTop: 5 },
  inputLabel: { color: '#DCE3DE', fontSize: 11.5, fontWeight: '900', marginTop: 2 },
  singleInput: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: '#36443D', backgroundColor: '#0B1310', color: '#F7F8F3', paddingHorizontal: 13, fontSize: 13.5 },
  notesInput: { minHeight: 112, borderRadius: 13, borderWidth: 1, borderColor: '#36443D', backgroundColor: '#0B1310', color: '#F7F8F3', paddingHorizontal: 13, paddingTop: 12, fontSize: 13.5, lineHeight: 19 },
  visibilityRow: { flexDirection: 'row', gap: 8 },
  visibilityChoice: { flex: 1, minHeight: 62, borderRadius: 13, borderWidth: 1, borderColor: '#36443D', flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  visibilityChoiceActive: { backgroundColor: '#F5C341', borderColor: '#F5C341' },
  visibilityCopy: { flex: 1 },
  visibilityTitle: { color: '#F7F8F3', fontSize: 11, fontWeight: '900' },
  visibilityTitleActive: { color: '#17211C' },
  visibilityBody: { color: '#8D9992', fontSize: 8.5, lineHeight: 12, marginTop: 2 },
  visibilityBodyActive: { color: '#485149' },
  saveMemoryButton: { minHeight: 50, borderRadius: 14, backgroundColor: '#F5C341', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  saveMemoryText: { color: '#17211C', fontSize: 12.5, fontWeight: '900', letterSpacing: 0.7 },
  photoModalRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18 },
  photoModalBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.82)' },
  photoDetailCard: { width: '100%', maxWidth: 560, backgroundColor: '#101916', borderRadius: 20, borderWidth: 1, borderColor: '#34423B', overflow: 'hidden' },
  photoDetailImage: { width: '100%', height: 420, backgroundColor: '#070D0B' },
  photoDetailBody: { padding: 15, gap: 10 },
  photoDetailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  photoCaption: { color: '#F7F8F3', fontSize: 16, lineHeight: 22, fontWeight: '700' },
  photoDate: { color: '#829088', fontSize: 10.5, fontWeight: '700' },
  photoStatusNote: { color: '#B8C3BD', fontSize: 12, lineHeight: 18, backgroundColor: '#17231E', borderRadius: 10, padding: 10 },
});
