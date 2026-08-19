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
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCommunityFeed, type CommunityPost } from '../../../src/community/api';
import {
  getEventGalleryPhotos,
  getJourney,
  getOwnedMemoryPhotos,
  getPassportStamps,
  saveEventGalleryPhoto,
  saveReflection,
  type JourneyItem,
  type MemoryPhoto,
  type PassportStamp,
} from '../../../src/passport/api';
import {
  getAdventureEventPeople,
  type AdventureEventPerson,
} from '../../../src/passport/EventHubApi';
import { requestConnection } from '../../../src/social/api';
import { STAMP_CATALOG } from '../../../src/passport/StampCatalog';
import { AppIcon } from '../../../src/ui/AppIcon';

type HubTab = 'memory' | 'event';
type ReflectionVisibility = 'private' | 'community';

function personName(person: AdventureEventPerson) {
  return person.display_name?.trim() || person.username?.trim() || 'Adventurer';
}

function personInitial(person: AdventureEventPerson) {
  return personName(person).slice(0, 1).toUpperCase();
}

function formatPostDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function StampDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const stamp = useMemo(() => STAMP_CATALOG.find((item) => item.id === params.id), [params.id]);
  const [earnedStamps, setEarnedStamps] = useState<PassportStamp[]>([]);
  const [journeyItem, setJourneyItem] = useState<JourneyItem | null>(null);
  const [photos, setPhotos] = useState<MemoryPhoto[]>([]);
  const [eventPhotos, setEventPhotos] = useState<MemoryPhoto[]>([]);
  const [eventPeople, setEventPeople] = useState<AdventureEventPerson[]>([]);
  const [communityMoments, setCommunityMoments] = useState<CommunityPost[]>([]);
  const [activeTab, setActiveTab] = useState<HubTab>('memory');
  const [ratingEditing, setRatingEditing] = useState(false);
  const [savingRating, setSavingRating] = useState(false);
  const [memoryEditing, setMemoryEditing] = useState(false);
  const [draftHighlight, setDraftHighlight] = useState('');
  const [draftReflection, setDraftReflection] = useState('');
  const [draftVisibility, setDraftVisibility] = useState<ReflectionVisibility>('private');
  const [savingMemory, setSavingMemory] = useState(false);
  const [requestedPeople, setRequestedPeople] = useState<Set<string>>(new Set());
  const [savingPhotoId, setSavingPhotoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        const adventureId = matched.adventure_id;
        const [journey, memoryPhotos] = await Promise.all([
          getJourney(),
          getOwnedMemoryPhotos(adventureId),
        ]);
        const nextJourney = journey.find((item) => item.adventure_id === adventureId) ?? null;
        setJourneyItem(nextJourney);
        setDraftHighlight(nextJourney?.highlight ?? '');
        setDraftReflection(nextJourney?.reflection ?? '');
        setDraftVisibility(nextJourney?.visibility ?? 'private');
        setPhotos(memoryPhotos);

        const [peopleResult, galleryResult, feedResult] = await Promise.allSettled([
          getAdventureEventPeople(adventureId),
          getEventGalleryPhotos(adventureId),
          getCommunityFeed(adventureId),
        ]);
        setEventPeople(peopleResult.status === 'fulfilled' ? peopleResult.value : []);
        setEventPhotos(galleryResult.status === 'fulfilled' ? galleryResult.value : []);
        setCommunityMoments(feedResult.status === 'fulfilled' ? feedResult.value : []);
      } else {
        setJourneyItem(null);
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

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const earned = useMemo(
    () => stamp?.code ? earnedStamps.find((item) => item.code === stamp.code) : undefined,
    [earnedStamps, stamp],
  );
  const adventureId = earned?.adventure_id ?? null;
  const rating = journeyItem?.rating ?? 0;
  const hasNotes = Boolean(journeyItem?.highlight || journeyItem?.reflection);
  const visibility = journeyItem?.visibility ?? 'private';

  const savedSourceIds = useMemo(() => {
    const ids = new Set<string>();
    for (const photo of photos) {
      ids.add(photo.id);
      if (photo.source_photo_id) ids.add(photo.source_photo_id);
    }
    return ids;
  }, [photos]);

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

  const chooseRating = useCallback(async (value: number) => {
    if (!adventureId || savingRating) return;
    setSavingRating(true);
    try {
      await saveReflection({
        adventureId,
        rating: value,
        highlight: journeyItem?.highlight ?? '',
        reflection: journeyItem?.reflection ?? '',
        visibility,
      });
      setJourneyItem((current) => current ? { ...current, rating: value } : current);
      setRatingEditing(false);
      setError(null);
      if (!journeyItem) void load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save your rating.');
    } finally {
      setSavingRating(false);
    }
  }, [adventureId, journeyItem, load, savingRating, visibility]);

  const beginMemoryEdit = useCallback(() => {
    setDraftHighlight(journeyItem?.highlight ?? '');
    setDraftReflection(journeyItem?.reflection ?? '');
    setDraftVisibility(journeyItem?.visibility ?? 'private');
    setMemoryEditing(true);
  }, [journeyItem]);

  const saveMemory = useCallback(async () => {
    if (!adventureId || savingMemory) return;
    setSavingMemory(true);
    try {
      await saveReflection({
        adventureId,
        rating: journeyItem?.rating ?? null,
        highlight: draftHighlight,
        reflection: draftReflection,
        visibility: draftVisibility,
      });
      setJourneyItem((current) => current ? {
        ...current,
        highlight: draftHighlight.trim() || null,
        reflection: draftReflection.trim() || null,
        visibility: draftVisibility,
      } : current);
      setMemoryEditing(false);
      setError(null);
      if (!journeyItem) void load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save your memory.');
    } finally {
      setSavingMemory(false);
    }
  }, [adventureId, draftHighlight, draftReflection, draftVisibility, journeyItem, load, savingMemory]);

  const addConnection = useCallback(async (profileId: string) => {
    if (requestedPeople.has(profileId)) return;
    try {
      await requestConnection(profileId);
      setRequestedPeople((current) => new Set(current).add(profileId));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to send that connection request.');
    }
  }, [requestedPeople]);

  if (!stamp) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.missing}>
          <AppIcon name="stamp" color="#F5C341" size={42} />
          <Text style={styles.missingTitle}>Stamp not found</Text>
          <Pressable onPress={() => router.back()} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Back to Stamps</Text>
          </Pressable>
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
        keyboardShouldPersistTaps="handled"
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void load(); }}
            tintColor="#F5C341"
          />
        )}
      >
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to stamps">
          <AppIcon name="chevron-forward" color="#F5C341" size={22} style={{ transform: [{ rotate: '180deg' }] }} />
          <Text style={styles.backText}>Stamps</Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={[styles.heroArt, stamp.year === 2026 && styles.heroArtTall]}>
              <Image source={stamp.source} style={styles.stampImage} resizeMode="contain" />
            </View>

            <View style={styles.heroInfo}>
              <Text style={styles.title}>{stamp.title}</Text>
              <View style={styles.metaItem}>
                <AppIcon name="adventure" color="#67CFC8" size={14} />
                <Text style={styles.meta}>{stamp.dateLabel}</Text>
              </View>
              <View style={styles.metaItem}>
                <AppIcon name="location" color="#67CFC8" size={14} />
                <Text style={styles.meta}>{stamp.location}</Text>
              </View>

              {earned && adventureId ? (
                <View style={styles.ratingArea}>
                  <View style={styles.ratingSummaryRow}>
                    {rating ? (
                      <View style={styles.currentRating}>
                        <Text style={styles.currentRatingStar}>★</Text>
                        <Text style={styles.currentRatingText}>{rating}/5</Text>
                      </View>
                    ) : null}
                    <Pressable
                      onPress={() => setRatingEditing((current) => !current)}
                      style={({ pressed }) => [styles.rateButton, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel="Rate this adventure"
                    >
                      <Text style={styles.rateButtonText}>RATE</Text>
                    </Pressable>
                  </View>
                  {ratingEditing ? (
                    <View style={styles.inlineRatingPicker}>
                      {[1, 2, 3, 4, 5].map((value) => (
                        <Pressable
                          key={value}
                          disabled={savingRating}
                          onPress={() => void chooseRating(value)}
                          style={styles.ratingStarButton}
                          accessibilityRole="button"
                          accessibilityLabel={`${value} star${value === 1 ? '' : 's'}`}
                        >
                          <Text style={[styles.ratingPickerStar, value <= rating && styles.ratingPickerStarSelected]}>★</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
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
              <Pressable
                onPress={() => setActiveTab('memory')}
                style={[styles.tab, activeTab === 'memory' && styles.tabActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'memory' }}
              >
                <AppIcon name="profile" color={activeTab === 'memory' ? '#F5C341' : '#8D9992'} size={17} />
                <Text style={[styles.tabText, activeTab === 'memory' && styles.tabTextActive]}>My Memory</Text>
              </Pressable>
              <Pressable
                onPress={() => setActiveTab('event')}
                style={[styles.tab, activeTab === 'event' && styles.tabActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'event' }}
              >
                <AppIcon name="community" color={activeTab === 'event' ? '#F5C341' : '#8D9992'} size={17} />
                <Text style={[styles.tabText, activeTab === 'event' && styles.tabTextActive]}>Event</Text>
              </Pressable>
            </View>

            {activeTab === 'memory' ? (
              <>
                <View style={styles.sectionCard}>
                  <View style={styles.cardHeadingRow}>
                    <View style={styles.headingCopy}>
                      <Text style={styles.cardEyebrow}>YOUR MEMORY</Text>
                      <Text style={styles.cardTitle}>{hasNotes ? 'What you want to remember' : 'Make this stamp yours'}</Text>
                    </View>
                    <Pressable onPress={memoryEditing ? () => setMemoryEditing(false) : beginMemoryEdit} hitSlop={10}>
                      <Text style={styles.actionText}>{memoryEditing ? 'CANCEL' : 'EDIT'}</Text>
                    </Pressable>
                  </View>

                  {memoryEditing ? (
                    <View style={styles.memoryEditor}>
                      <Text style={styles.fieldLabel}>Favorite moment</Text>
                      <TextInput
                        value={draftHighlight}
                        onChangeText={setDraftHighlight}
                        maxLength={180}
                        placeholder="One moment you want to keep…"
                        placeholderTextColor="#6F7D75"
                        style={styles.input}
                      />
                      <Text style={styles.fieldLabel}>Your memory</Text>
                      <TextInput
                        value={draftReflection}
                        onChangeText={setDraftReflection}
                        multiline
                        maxLength={5000}
                        placeholder="What do you want to remember about this adventure?"
                        placeholderTextColor="#6F7D75"
                        style={[styles.input, styles.memoryInput]}
                      />
                      <Text style={styles.fieldLabel}>Who can see it?</Text>
                      <View style={styles.visibilityRow}>
                        <Pressable
                          onPress={() => setDraftVisibility('private')}
                          style={[styles.visibilityChoice, draftVisibility === 'private' && styles.visibilityChoiceActive]}
                        >
                          <AppIcon name="privacy" color={draftVisibility === 'private' ? '#17211C' : '#9BA69F'} size={15} />
                          <Text style={[styles.visibilityChoiceText, draftVisibility === 'private' && styles.visibilityChoiceTextActive]}>Private</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setDraftVisibility('community')}
                          style={[styles.visibilityChoice, draftVisibility === 'community' && styles.visibilityChoiceActive]}
                        >
                          <AppIcon name="community" color={draftVisibility === 'community' ? '#17211C' : '#9BA69F'} size={15} />
                          <Text style={[styles.visibilityChoiceText, draftVisibility === 'community' && styles.visibilityChoiceTextActive]}>Public</Text>
                        </Pressable>
                      </View>
                      <Pressable
                        disabled={savingMemory}
                        onPress={() => void saveMemory()}
                        style={[styles.saveMemoryButton, savingMemory && styles.disabled]}
                      >
                        <Text style={styles.saveMemoryButtonText}>{savingMemory ? 'SAVING…' : 'SAVE MEMORY'}</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <>
                      {journeyItem?.highlight ? (
                        <View style={styles.memoryQuote}>
                          <Text style={styles.quoteMark}>“</Text>
                          <Text style={styles.highlight}>{journeyItem.highlight}</Text>
                        </View>
                      ) : null}
                      {journeyItem?.reflection ? <Text style={styles.reflection}>{journeyItem.reflection}</Text> : null}
                      {!hasNotes ? (
                        <Text style={styles.emptyBody}>Add a favorite moment or reflection, then choose whether it stays private or is shared publicly.</Text>
                      ) : null}
                      <View style={styles.privateLine}>
                        <AppIcon name={visibility === 'private' ? 'privacy' : 'community'} color="#67CFC8" size={13} />
                        <Text style={styles.privateLineText}>{visibility === 'private' ? 'Private memory' : 'Public memory'}</Text>
                      </View>
                    </>
                  )}
                </View>

                <View style={styles.sectionCard}>
                  <View style={styles.cardHeadingRow}>
                    <View style={styles.headingCopy}>
                      <Text style={styles.cardEyebrow}>PEOPLE FROM THIS ADVENTURE</Text>
                      <Text style={styles.cardTitle}>{eventPeople.length ? 'Reconnect with people who were there' : 'Suggested connections'}</Text>
                    </View>
                  </View>

                  {eventPeople.length ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.peopleRow}>
                      {eventPeople.map((person) => {
                        const requested = requestedPeople.has(person.profile_id);
                        return (
                          <View key={person.profile_id} style={styles.personCard}>
                            <Pressable
                              onPress={() => router.push({ pathname: '/community-profile/[id]', params: { id: person.profile_id } })}
                              style={({ pressed }) => [styles.personProfile, pressed && styles.pressed]}
                            >
                              <View style={styles.avatarWrap}>
                                {person.avatar_url ? (
                                  <Image source={{ uri: person.avatar_url }} style={styles.avatar} />
                                ) : (
                                  <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarInitial}>{personInitial(person)}</Text></View>
                                )}
                                {person.is_connected ? <View style={styles.connectedDot}><AppIcon name="checkmark" color="#08201D" size={12} /></View> : null}
                              </View>
                              <Text style={styles.personName} numberOfLines={1}>{personName(person)}</Text>
                            </Pressable>
                            {person.is_connected ? (
                              <Text style={styles.connectedLabel}>CONNECTED</Text>
                            ) : (
                              <Pressable
                                disabled={requested}
                                onPress={() => void addConnection(person.profile_id)}
                                style={[styles.connectButton, requested && styles.connectButtonRequested]}
                              >
                                <Text style={[styles.connectButtonText, requested && styles.connectButtonTextRequested]}>{requested ? 'REQUESTED' : 'ADD'}</Text>
                              </Pressable>
                            )}
                          </View>
                        );
                      })}
                    </ScrollView>
                  ) : (
                    <View style={styles.inlineEmpty}>
                      <AppIcon name="connections" color="#67CFC8" size={23} />
                      <View style={styles.inlineEmptyCopy}>
                        <Text style={styles.emptyTitle}>No people available to recommend yet.</Text>
                        <Text style={styles.emptyBody}>As discoverable attendees are linked to this event, they’ll appear here with an option to connect.</Text>
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.sectionCard}>
                  <View style={styles.cardHeadingRow}>
                    <View style={styles.headingCopy}>
                      <Text style={styles.cardEyebrow}>PHOTO MEMORY</Text>
                      <Text style={styles.cardTitle}>{photos.length ? `${photos.length} saved ${photos.length === 1 ? 'moment' : 'moments'}` : 'Build your photo memory'}</Text>
                    </View>
                    <Pressable onPress={() => router.push(`/passport/photos/${adventureId}`)} hitSlop={10}>
                      <Text style={styles.actionText}>ADD PHOTO</Text>
                    </Pressable>
                  </View>

                  {photos.length ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip}>
                      {photos.slice(0, 8).map((photo) => (
                        <View key={photo.id} style={styles.memoryPhotoCard}>
                          <Image source={{ uri: photo.image_url }} style={styles.memoryPhoto} />
                          <View style={styles.photoSourceBadge}>
                            <Text style={styles.photoSourceText}>{photo.source_kind === 'event_gallery' ? 'SAVED FROM EVENT' : 'YOUR PHOTO'}</Text>
                          </View>
                        </View>
                      ))}
                      <Pressable onPress={() => router.push(`/passport/photos/${adventureId}`)} style={styles.addPhotoTile}>
                        <AppIcon name="add" color="#D7B45A" size={26} />
                        <Text style={styles.addPhotoTileText}>Add Photos</Text>
                      </Pressable>
                    </ScrollView>
                  ) : (
                    <Pressable onPress={() => router.push(`/passport/photos/${adventureId}`)} style={({ pressed }) => [styles.photoEmpty, pressed && styles.pressed]}>
                      <AppIcon name="photo" color="#67CFC8" size={25} />
                      <Text style={styles.emptyTitle}>No photos saved yet.</Text>
                      <Text style={styles.emptyBody}>Add your own or save shared event photos into this personal memory.</Text>
                    </Pressable>
                  )}
                </View>
              </>
            ) : (
              <>
                <View style={styles.sectionCard}>
                  <View style={styles.cardHeadingRow}>
                    <View style={styles.headingCopy}>
                      <Text style={styles.cardEyebrow}>EVENT GALLERY</Text>
                      <Text style={styles.cardTitle}>{eventPhotos.length ? `${eventPhotos.length} shared ${eventPhotos.length === 1 ? 'photo' : 'photos'}` : 'Shared moments from the event'}</Text>
                    </View>
                  </View>

                  {eventPhotos.length ? (
                    <View style={styles.eventPhotoGrid}>
                      {eventPhotos.slice(0, 6).map((photo) => {
                        const saved = savedSourceIds.has(photo.id);
                        const saving = savingPhotoId === photo.id;
                        return (
                          <View key={photo.id} style={styles.eventPhotoCard}>
                            <Image source={{ uri: photo.image_url }} style={styles.eventPhoto} />
                            <Pressable
                              disabled={saved || saving}
                              onPress={() => void saveGalleryPhoto(photo)}
                              style={[styles.savePhotoButton, saved && styles.savePhotoButtonSaved]}
                            >
                              <Text style={[styles.savePhotoText, saved && styles.savePhotoTextSaved]}>{saved ? 'SAVED' : saving ? 'SAVING…' : 'SAVE TO MEMORY'}</Text>
                            </Pressable>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <View style={styles.inlineEmpty}>
                      <AppIcon name="photos" color="#67CFC8" size={24} />
                      <View style={styles.inlineEmptyCopy}>
                        <Text style={styles.emptyTitle}>The event gallery is quiet.</Text>
                        <Text style={styles.emptyBody}>Approved attendee photos will collect here as the shared visual record of the adventure.</Text>
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.sectionCard}>
                  <View style={styles.cardHeadingRow}>
                    <View style={styles.headingCopy}>
                      <Text style={styles.cardEyebrow}>PEOPLE FROM THIS ADVENTURE</Text>
                      <Text style={styles.cardTitle}>{eventPeople.length ? `${eventPeople.length} discoverable ${eventPeople.length === 1 ? 'person' : 'people'}` : 'People you can reconnect with'}</Text>
                    </View>
                  </View>

                  {eventPeople.length ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.peopleRow}>
                      {eventPeople.map((person) => (
                        <Pressable
                          key={person.profile_id}
                          onPress={() => router.push({ pathname: '/community-profile/[id]', params: { id: person.profile_id } })}
                          style={({ pressed }) => [styles.personCard, pressed && styles.pressed]}
                        >
                          <View style={styles.avatarWrap}>
                            {person.avatar_url ? (
                              <Image source={{ uri: person.avatar_url }} style={styles.avatar} />
                            ) : (
                              <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarInitial}>{personInitial(person)}</Text></View>
                            )}
                            {person.is_connected ? <View style={styles.connectedDot}><AppIcon name="checkmark" color="#08201D" size={12} /></View> : null}
                          </View>
                          <Text style={styles.personName} numberOfLines={1}>{personName(person)}</Text>
                          <Text style={[styles.personMeta, person.is_connected && styles.personMetaConnected]}>{person.is_connected ? 'Connected' : 'Met here'}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : (
                    <View style={styles.inlineEmpty}>
                      <AppIcon name="community" color="#67CFC8" size={24} />
                      <View style={styles.inlineEmptyCopy}>
                        <Text style={styles.emptyTitle}>No discoverable attendees yet.</Text>
                        <Text style={styles.emptyBody}>Only people who allow event discovery, plus your accepted connections, appear here.</Text>
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.sectionCard}>
                  <View style={styles.cardHeadingRow}>
                    <View style={styles.headingCopy}>
                      <Text style={styles.cardEyebrow}>COMMUNITY MOMENTS</Text>
                      <Text style={styles.cardTitle}>{communityMoments.length ? `${communityMoments.length} from this adventure` : 'The shared story'}</Text>
                    </View>
                  </View>

                  {communityMoments.length ? communityMoments.slice(0, 5).map((post) => (
                    <Pressable
                      key={post.id}
                      onPress={() => router.push({ pathname: '/community/[id]', params: { id: post.id } })}
                      style={({ pressed }) => [styles.momentCard, pressed && styles.pressed]}
                    >
                      <View style={styles.momentHeader}>
                        {post.avatar_url ? <Image source={{ uri: post.avatar_url }} style={styles.momentAvatar} /> : <View style={[styles.momentAvatar, styles.avatarFallback]}><Text style={styles.momentAvatarText}>{post.author_name.slice(0, 1).toUpperCase()}</Text></View>}
                        <View style={styles.momentHeaderCopy}>
                          <Text style={styles.momentAuthor}>{post.author_name}</Text>
                          <Text style={styles.momentDate}>{formatPostDate(post.created_at)}</Text>
                        </View>
                      </View>
                      <Text style={styles.momentBody} numberOfLines={4}>{post.body}</Text>
                      {post.image_url ? <Image source={{ uri: post.image_url }} style={styles.momentImage} /> : null}
                      <View style={styles.momentStats}>
                        <Text style={styles.momentStat}>♥ {post.reaction_count}</Text>
                        <Text style={styles.momentStat}>◌ {post.comment_count}</Text>
                      </View>
                    </Pressable>
                  )) : (
                    <View style={styles.inlineEmpty}>
                      <AppIcon name="community" color="#67CFC8" size={24} />
                      <View style={styles.inlineEmptyCopy}>
                        <Text style={styles.emptyTitle}>No community moments yet.</Text>
                        <Text style={styles.emptyBody}>Posts tied to this adventure will appear here as part of the shared event record.</Text>
                      </View>
                    </View>
                  )}
                </View>
              </>
            )}
          </>
        ) : (
          <View style={styles.lockedCard}>
            <AppIcon name="stamp" color="#D7B45A" size={25} />
            <View style={styles.lockedCopy}>
              <Text style={styles.emptyTitle}>This is a collection preview.</Text>
              <Text style={styles.emptyBody}>When the stamp is earned and linked to an adventure, it becomes your memory and connection hub for that event.</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
  ratingArea: { gap: 5, marginTop: 1 },
  ratingSummaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  currentRating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  currentRatingStar: { color: '#F5C341', fontSize: 17, lineHeight: 19 },
  currentRatingText: { color: '#F7F8F3', fontSize: 11.5, fontWeight: '900' },
  rateButton: { borderWidth: 1, borderColor: '#D7B45A', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  rateButtonText: { color: '#F5C341', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  inlineRatingPicker: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingStarButton: { width: 31, height: 31, alignItems: 'center', justifyContent: 'center' },
  ratingPickerStar: { color: '#46524C', fontSize: 25, lineHeight: 28 },
  ratingPickerStarSelected: { color: '#F5C341' },
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
  tabActive: { backgroundColor: '#16231F', borderColor: '#F5C341' },
  tabText: { color: '#8D9992', fontSize: 13.5, fontWeight: '800' },
  tabTextActive: { color: '#F5C341' },
  sectionCard: { backgroundColor: '#111A17', borderWidth: 1, borderColor: '#29342F', borderRadius: 18, padding: 15, gap: 12 },
  cardHeadingRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headingCopy: { flex: 1 },
  cardEyebrow: { color: '#67CFC8', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  cardTitle: { color: '#F7F8F3', fontSize: 16, lineHeight: 20, fontWeight: '900', marginTop: 3 },
  actionText: { color: '#F5C341', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.55, paddingTop: 2 },
  memoryEditor: { gap: 8 },
  fieldLabel: { color: '#A8B3AC', fontSize: 10.5, fontWeight: '900', marginTop: 2 },
  input: { backgroundColor: '#0D1512', borderWidth: 1, borderColor: '#33423B', borderRadius: 12, color: '#F7F8F3', paddingHorizontal: 12, paddingVertical: 11, fontSize: 13.5 },
  memoryInput: { minHeight: 110, textAlignVertical: 'top' },
  visibilityRow: { flexDirection: 'row', gap: 8 },
  visibilityChoice: { flex: 1, minHeight: 40, borderRadius: 11, borderWidth: 1, borderColor: '#3B4942', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  visibilityChoiceActive: { backgroundColor: '#F5C341', borderColor: '#F5C341' },
  visibilityChoiceText: { color: '#A0ACA5', fontSize: 11, fontWeight: '900' },
  visibilityChoiceTextActive: { color: '#17211C' },
  saveMemoryButton: { minHeight: 44, borderRadius: 12, backgroundColor: '#F5C341', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  saveMemoryButtonText: { color: '#17211C', fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  memoryQuote: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  quoteMark: { color: '#F5C341', fontSize: 35, lineHeight: 31, fontWeight: '900' },
  highlight: { flex: 1, color: '#F7F8F3', fontSize: 17, lineHeight: 23, fontWeight: '900' },
  reflection: { color: '#B8C3BD', fontSize: 13.5, lineHeight: 20 },
  privateLine: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 3 },
  privateLineText: { color: '#829088', fontSize: 10.5, fontWeight: '700' },
  peopleRow: { gap: 13, paddingRight: 4 },
  personCard: { width: 92, alignItems: 'center', gap: 6 },
  personProfile: { width: '100%', alignItems: 'center', gap: 5 },
  avatarWrap: { width: 58, height: 58, position: 'relative' },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#1C2822', borderWidth: 1, borderColor: '#D7B45A' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#F7F8F3', fontSize: 20, fontWeight: '900' },
  connectedDot: { position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#67CFC8', borderWidth: 2, borderColor: '#111A17' },
  personName: { color: '#F7F8F3', width: '100%', textAlign: 'center', fontSize: 11.5, fontWeight: '900' },
  personMeta: { color: '#8B9790', width: '100%', textAlign: 'center', fontSize: 9.5, lineHeight: 12 },
  personMetaConnected: { color: '#67CFC8' },
  connectedLabel: { color: '#67CFC8', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.45 },
  connectButton: { minWidth: 64, minHeight: 27, borderRadius: 999, backgroundColor: '#F5C341', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9 },
  connectButtonRequested: { backgroundColor: '#24312B' },
  connectButtonText: { color: '#17211C', fontSize: 8, fontWeight: '900', letterSpacing: 0.4 },
  connectButtonTextRequested: { color: '#8FD4C7' },
  inlineEmpty: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 5 },
  inlineEmptyCopy: { flex: 1, gap: 4 },
  emptyTitle: { color: '#F7F8F3', fontSize: 14, lineHeight: 18, fontWeight: '900' },
  emptyBody: { color: '#929E97', fontSize: 12.5, lineHeight: 18 },
  photoStrip: { gap: 9, paddingRight: 4 },
  memoryPhotoCard: { width: 118, height: 118, borderRadius: 13, overflow: 'hidden', backgroundColor: '#18231E' },
  memoryPhoto: { width: '100%', height: '100%' },
  photoSourceBadge: { position: 'absolute', left: 5, bottom: 5, right: 5, backgroundColor: 'rgba(7,14,12,0.82)', borderRadius: 7, paddingHorizontal: 6, paddingVertical: 4 },
  photoSourceText: { color: '#E8EEE9', fontSize: 6.8, fontWeight: '900', letterSpacing: 0.4, textAlign: 'center' },
  addPhotoTile: { width: 118, height: 118, borderRadius: 13, borderWidth: 1, borderStyle: 'dashed', borderColor: '#48564F', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addPhotoTileText: { color: '#B7C1BB', fontSize: 11, fontWeight: '800' },
  photoEmpty: { minHeight: 112, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#34423B', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 5 },
  eventPhotoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  eventPhotoCard: { width: '31.6%', borderRadius: 12, overflow: 'hidden', backgroundColor: '#18231E' },
  eventPhoto: { width: '100%', aspectRatio: 1, backgroundColor: '#1A2520' },
  savePhotoButton: { minHeight: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5C341', paddingHorizontal: 4 },
  savePhotoButtonSaved: { backgroundColor: '#24312B' },
  savePhotoText: { color: '#17211C', fontSize: 6.8, fontWeight: '900', letterSpacing: 0.35, textAlign: 'center' },
  savePhotoTextSaved: { color: '#8FD4C7' },
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
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.72 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  missingTitle: { color: '#F7F8F3', fontSize: 22, fontWeight: '900' },
});
