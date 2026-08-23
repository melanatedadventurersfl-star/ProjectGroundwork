import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
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
  deleteAdventureMemory,
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
type PhotoState = 'private' | 'pending' | 'gallery' | 'rejected';

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

function photoState(photo: MemoryPhoto, memoryVisibility?: 'private' | 'public'): PhotoState {
  const isPublic = memoryVisibility === 'public' || photo.visibility === 'public' || photo.visibility === 'group';
  if (!isPublic) return 'private';
  if (photo.moderation_status === 'rejected') return 'rejected';
  if (photo.moderation_status === 'pending') return 'pending';
  return 'gallery';
}

function photoStateLabel(state: PhotoState) {
  if (state === 'private') return 'PRIVATE';
  if (state === 'pending') return 'PENDING';
  if (state === 'rejected') return 'NOT APPROVED';
  return 'EVENT GALLERY';
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [optionsMemory, setOptionsMemory] = useState<AdventureMemory | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<{ photo: MemoryPhoto; memory?: AdventureMemory } | null>(null);
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

  const connectedPeople = useMemo(() => eventPeople.filter((person) => person.relationship_state === 'connected'), [eventPeople]);
  const connectablePeople = useMemo(() => eventPeople.filter((person) => person.relationship_state !== 'connected'), [eventPeople]);
  const photosByMemory = useMemo(() => photoMapByMemory(memoryPhotos), [memoryPhotos]);
  const ownMemoryIds = useMemo(() => new Set(memories.map((memory) => memory.id)), [memories]);

  const visibleEventPhotos = useMemo(() => {
    const approvedIds = new Set(eventPhotos.map((photo) => photo.id));
    const ownUnapproved = ownedEventPhotos.filter((photo) => photo.visibility === 'public' && !approvedIds.has(photo.id));
    const all = [...ownUnapproved, ...eventPhotos];
    const seen = new Set<string>();
    return all.filter((photo) => {
      if (seen.has(photo.id)) return false;
      seen.add(photo.id);
      return true;
    });
  }, [eventPhotos, ownedEventPhotos]);

  const handleConnection = useCallback(async (person: AdventureEventPerson) => {
    if (person.relationship_state === 'outgoing_pending' || person.relationship_state === 'connected' || connectingId) return;
    setConnectingId(person.profile_id);
    try {
      const state = await actOnAdventureConnection(person.profile_id);
      setEventPeople((current) => current.map((item) => item.profile_id === person.profile_id ? { ...item, relationship_state: state, is_connected: state === 'connected' } : item));
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
      const updated = { ...memory, visibility: next } as AdventureMemory;
      setMemories((current) => current.map((item) => item.id === memory.id ? updated : item));
      if (next === 'public') setCommunityMoments((current) => [updated, ...current.filter((item) => item.id !== memory.id)]);
      else setCommunityMoments((current) => current.filter((item) => item.id !== memory.id));
      setOptionsMemory((current) => current?.id === memory.id ? updated : current);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to change memory visibility.');
    } finally {
      setVisibilityId(null);
    }
  }, [visibilityId]);

  const editMemory = useCallback((memory: AdventureMemory) => {
    setOptionsMemory(null);
    setConfirmingDelete(false);
    router.push({ pathname: '/passport/memories/edit', params: { memoryId: memory.id, adventureId: memory.adventure_id } });
  }, []);

  const deleteMemory = useCallback(async (memory: AdventureMemory) => {
    if (deletingId) return;
    setDeletingId(memory.id);
    try {
      await deleteAdventureMemory(memory.id);
      setMemories((current) => current.filter((item) => item.id !== memory.id));
      setMemoryPhotos((current) => current.filter((photo) => photo.memory_id !== memory.id));
      setCommunityMoments((current) => current.filter((item) => item.id !== memory.id));
      setOptionsMemory(null);
      setConfirmingDelete(false);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to delete memory.');
    } finally {
      setDeletingId(null);
    }
  }, [deletingId]);

  if (!stamp) {
    return <SafeAreaView style={styles.safe}><View style={styles.centered}><AppIcon name="stamp" color="#F5C341" size={42} /><Text style={styles.missingTitle}>Stamp not found</Text><Pressable onPress={() => router.back()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Back to Stamps</Text></Pressable></View></SafeAreaView>;
  }

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.centered}><ActivityIndicator color="#F5C341" /><Text style={styles.loadingText}>Opening your stamp…</Text></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor="#F5C341" />}>
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to stamps"><AppIcon name="chevron-forward" color="#F5C341" size={21} style={{ transform: [{ rotate: '180deg' }] }} /><Text style={styles.backText}>Stamps</Text></Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.heroCard}>
          <View style={styles.heroRow}><View style={styles.heroArt}><Image source={stamp.source} style={styles.stampImage} resizeMode="contain" /></View><View style={styles.heroInfo}><Text style={styles.title}>{stamp.title}</Text><View style={styles.metaItem}><AppIcon name="adventure" color="#67CFC8" size={14} /><Text style={styles.meta}>{stamp.dateLabel}</Text></View><View style={styles.metaItem}><AppIcon name="location" color="#67CFC8" size={14} /><Text style={styles.meta}>{stamp.location}</Text></View></View></View>
          <View style={styles.heroStatusRow}><View style={[styles.statusPill, earned ? styles.statusEarned : styles.statusPreview]}>{earned ? <AppIcon name="checkmark" color="#17211C" size={12} /> : null}<Text style={[styles.statusText, !earned && styles.statusPreviewText]}>{earned ? 'COLLECTED' : 'PREVIEW'}</Text></View><Text style={styles.statusDot}>•</Text><Text style={styles.collection}>{stamp.year} COLLECTION</Text></View>
        </View>

        {earned && adventureId ? <><View style={styles.tabs}><Pressable onPress={() => setActiveTab('memory')} style={[styles.tab, activeTab === 'memory' && styles.tabActive]} accessibilityRole="tab" accessibilityState={{ selected: activeTab === 'memory' }}><AppIcon name="profile" color={activeTab === 'memory' ? '#F5C341' : '#8D9992'} size={17} /><Text style={[styles.tabText, activeTab === 'memory' && styles.tabTextActive]}>My Memory</Text></Pressable><Pressable onPress={() => setActiveTab('event')} style={[styles.tab, activeTab === 'event' && styles.tabActive]} accessibilityRole="tab" accessibilityState={{ selected: activeTab === 'event' }}><AppIcon name="community" color={activeTab === 'event' ? '#F5C341' : '#8D9992'} size={17} /><Text style={[styles.tabText, activeTab === 'event' && styles.tabTextActive]}>Event</Text></Pressable></View>
          {activeTab === 'memory' ? <><View style={styles.sectionHeader}><View style={styles.sectionHeaderCopy}><Text style={styles.eyebrow}>YOUR MEMORIES</Text><Text style={styles.sectionTitle}>{memories.length ? `${memories.length} ${memories.length === 1 ? 'memory' : 'memories'}` : 'Start your memories'}</Text></View><Pressable onPress={() => router.push({ pathname: '/passport/memories/add', params: { adventureId, mode: 'memory' } })} style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}><AppIcon name="add" color="#F5C341" size={15} /><Text style={styles.outlineButtonText}>ADD MEMORY</Text></Pressable></View>
            {memories.length ? memories.map((memory) => <MemoryCard key={memory.id} memory={memory} photos={photosByMemory.get(memory.id) ?? []} changingVisibility={visibilityId === memory.id} deleting={deletingId === memory.id} onToggleVisibility={() => void toggleVisibility(memory)} onManage={() => { setConfirmingDelete(false); setOptionsMemory(memory); }} onPhoto={(photo) => setSelectedPhoto({ photo, memory })} />) : <Pressable onPress={() => router.push({ pathname: '/passport/memories/add', params: { adventureId, mode: 'memory' } })} style={({ pressed }) => [styles.emptyCard, pressed && styles.pressed]}><AppIcon name="photo" color="#67CFC8" size={28} /><Text style={styles.emptyTitle}>Save your first moment</Text><Text style={styles.emptyBody}>Add a reflection, photos, a rating, or people you want to remember from this adventure.</Text></Pressable>}
            <View style={styles.privacyHelper}><View style={styles.privacyHelperIcon}><AppIcon name="privacy" color="#79D486" size={18} /></View><View style={styles.privacyHelperCopy}><Text style={styles.privacyHelperTitle}>Your memories are private by default.</Text><Text style={styles.privacyHelperBody}>Share individual memories or photos when you want them to become part of the event story.</Text></View></View>
            <View style={styles.sectionCard}><Text style={styles.eyebrow}>PEOPLE FROM THIS ADVENTURE</Text><Text style={styles.cardTitle}>{connectedPeople.length ? 'People in your adventure circle' : 'Connections come after the memories'}</Text>{connectedPeople.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatarStrip}>{connectedPeople.map((person) => <ConnectedAvatar key={person.profile_id} person={person} />)}</ScrollView> : <Text style={styles.emptyBody}>Connect with people from the Event tab. Once connected, they can be tagged in your memories.</Text>}</View></> : <><View style={styles.sectionCard}><View style={styles.sectionHeaderCompact}><View style={styles.sectionHeaderCopy}><Text style={styles.eyebrow}>EVENT GALLERY</Text><Text style={styles.cardTitle}>{visibleEventPhotos.length ? `${visibleEventPhotos.length} shared ${visibleEventPhotos.length === 1 ? 'photo' : 'photos'}` : 'Share the adventure'}</Text></View><Pressable onPress={() => router.push({ pathname: '/passport/memories/add', params: { adventureId, mode: 'event' } })} style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}><AppIcon name="add" color="#F5C341" size={15} /><Text style={styles.outlineButtonText}>ADD PHOTO</Text></Pressable></View>{visibleEventPhotos.length ? <View style={styles.galleryGrid}>{visibleEventPhotos.slice(0, 9).map((photo) => { const state = photoState(photo); return <Pressable key={photo.id} onPress={() => setSelectedPhoto({ photo })} style={({ pressed }) => [styles.galleryTile, pressed && styles.pressed]}><Image source={{ uri: photo.image_url }} style={styles.galleryImage} /><PhotoStatusBadge state={state} compact /></Pressable>; })}</View> : <Pressable onPress={() => router.push({ pathname: '/passport/memories/add', params: { adventureId, mode: 'event' } })} style={styles.inlineEmpty}><AppIcon name="photos" color="#67CFC8" size={25} /><View style={styles.inlineEmptyCopy}><Text style={styles.emptyTitle}>The gallery is waiting.</Text><Text style={styles.emptyBody}>Your own pending submissions appear here immediately. Everyone else sees them after approval.</Text></View></Pressable>}</View>
            <View style={styles.sectionCard}><Text style={styles.eyebrow}>COMMUNITY MOMENTS</Text><Text style={styles.cardTitle}>{communityMoments.length ? 'Stories from this adventure' : 'No public memories yet'}</Text>{communityMoments.length ? <View style={styles.momentStack}>{communityMoments.slice(0, 8).map((memory) => { const own = ownMemoryIds.has(memory.id); return <View key={memory.id} style={styles.communityMoment}><View style={styles.communityMomentHeader}>{memory.author_avatar_url ? <Image source={{ uri: memory.author_avatar_url }} style={styles.communityAvatar} /> : <View style={styles.communityAvatarFallback}><Text style={styles.communityAvatarInitial}>{(memory.author_name || 'C').slice(0, 1).toUpperCase()}</Text></View>}<View style={styles.communityHeaderCopy}><Text style={styles.communityAuthor}>{memory.author_name || 'Community member'}</Text><Text style={styles.communityMomentMeta}>{formatDate(memory.created_at)}</Text></View>{own ? <Pressable onPress={() => { setConfirmingDelete(false); setOptionsMemory(memory); }} hitSlop={10} style={styles.moreButton}><Text style={styles.moreText}>•••</Text></Pressable> : null}</View>{memory.rating ? <Text style={styles.memoryRating}>{'★'.repeat(memory.rating)}<Text style={styles.unfilledStars}>{'★'.repeat(5 - memory.rating)}</Text></Text> : null}<Text style={styles.communityMomentTitle}>{memory.title?.trim() || 'Adventure Memory'}</Text>{memory.body ? <Text style={styles.communityMomentBody}>{memory.body}</Text> : null}{memory.tags.length ? <Text style={styles.tagSummary}>With {memory.tags.map((tag) => tag.display_name || tag.username || 'Adventurer').join(', ')}</Text> : null}</View>; })}</View> : <Text style={styles.emptyBody}>Mark a memory Public and it becomes part of the shared event story.</Text>}</View>
            <View style={styles.sectionCard}><Text style={styles.eyebrow}>ATTENDEES</Text><Text style={styles.cardTitle}>{eventPeople.length ? `${eventPeople.length} discoverable ${eventPeople.length === 1 ? 'person' : 'people'}` : 'People you can reconnect with'}</Text>{connectedPeople.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatarStrip}>{connectedPeople.map((person) => <ConnectedAvatar key={person.profile_id} person={person} />)}</ScrollView> : null}{connectablePeople.length ? <View style={styles.connectionStack}>{connectablePeople.map((person) => { const busy = connectingId === person.profile_id; const state = person.relationship_state; const disabled = busy || state === 'outgoing_pending' || state === 'connected'; return <View key={person.profile_id} style={styles.connectionRow}><Pressable onPress={() => router.push({ pathname: '/community-profile/[id]', params: { id: person.profile_id } })} style={styles.connectionIdentity}><PersonAvatar person={person} size={46} /><View style={styles.connectionCopy}><Text style={styles.personName}>{personName(person)}</Text>{person.username ? <Text style={styles.personHandle}>@{person.username}</Text> : null}{state === 'incoming_pending' ? <Text style={styles.requestedBy}>Requested you</Text> : null}</View></Pressable><Pressable disabled={disabled} onPress={() => void handleConnection(person)} style={[styles.connectionButton, state === 'incoming_pending' && styles.acceptButton, state === 'outgoing_pending' && styles.requestedButton]}><Text style={[styles.connectionButtonText, state === 'outgoing_pending' && styles.requestedButtonText]}>{connectionLabel(state, busy)}</Text></Pressable></View>; })}</View> : null}</View></>}</> : <View style={styles.lockedCard}><AppIcon name="stamp" color="#67CFC8" size={26} /><Text style={styles.emptyTitle}>Collect this stamp to unlock its adventure hub.</Text></View>}
      </ScrollView>

      <Modal visible={Boolean(optionsMemory)} transparent animationType="slide" onRequestClose={() => { setOptionsMemory(null); setConfirmingDelete(false); }}><View style={styles.modalRoot}><Pressable style={styles.modalBackdrop} onPress={() => { setOptionsMemory(null); setConfirmingDelete(false); }} />{optionsMemory ? <View style={styles.optionsSheet}><View style={styles.sheetHandle} /><Text style={styles.sheetEyebrow}>MEMORY OPTIONS</Text><Text style={styles.sheetTitle}>{optionsMemory.title?.trim() || 'Adventure Memory'}</Text><Text style={styles.sheetMeta}>{formatDate(optionsMemory.created_at)} · {optionsMemory.visibility === 'public' ? 'Public' : 'Private'}</Text>{!confirmingDelete ? <><SheetAction icon="photo" title="View Memory" body="Return to this journal entry." onPress={() => setOptionsMemory(null)} /><SheetAction icon="edit" title="Edit Memory" body="Update the title, notes, rating, people, or photos." onPress={() => editMemory(optionsMemory)} /><SheetAction icon="photos" title="Manage Photos" body="Add or remove photos attached to this memory." onPress={() => editMemory(optionsMemory)} /><SheetAction icon={optionsMemory.visibility === 'public' ? 'privacy' : 'community'} title={optionsMemory.visibility === 'public' ? 'Make Private' : 'Share Publicly'} body={optionsMemory.visibility === 'public' ? 'Keep this memory in your Passport only.' : 'Add this memory to the shared event story.'} onPress={() => void toggleVisibility(optionsMemory)} busy={visibilityId === optionsMemory.id} /><Pressable onPress={() => setConfirmingDelete(true)} style={styles.deleteAction}><AppIcon name="delete" color="#FF8F86" size={20} /><View style={styles.sheetActionCopy}><Text style={styles.deleteActionTitle}>Delete Memory</Text><Text style={styles.sheetActionBody}>Remove this memory and its personal attached photos.</Text></View></Pressable><Pressable onPress={() => setOptionsMemory(null)} style={styles.cancelButton}><Text style={styles.cancelButtonText}>CANCEL</Text></Pressable></> : <View style={styles.deleteConfirm}><AppIcon name="delete" color="#FF8F86" size={30} /><Text style={styles.deleteConfirmTitle}>Delete this memory?</Text><Text style={styles.deleteConfirmBody}>This removes the memory, its tags, and personal photos attached to it. Event Gallery originals are not deleted.</Text><Pressable disabled={deletingId === optionsMemory.id} onPress={() => void deleteMemory(optionsMemory)} style={[styles.confirmDeleteButton, deletingId === optionsMemory.id && styles.disabled]}><Text style={styles.confirmDeleteText}>{deletingId === optionsMemory.id ? 'DELETING…' : 'DELETE MEMORY'}</Text></Pressable><Pressable onPress={() => setConfirmingDelete(false)} style={styles.cancelButton}><Text style={styles.cancelButtonText}>KEEP MEMORY</Text></Pressable></View>}</View> : null}</View></Modal>

      <Modal visible={Boolean(selectedPhoto)} transparent animationType="fade" onRequestClose={() => setSelectedPhoto(null)}><View style={styles.photoViewerRoot}><Pressable style={styles.photoViewerBackdrop} onPress={() => setSelectedPhoto(null)} />{selectedPhoto ? <SafeAreaView style={styles.photoViewerSafe}><View style={styles.photoViewerTop}><Pressable onPress={() => setSelectedPhoto(null)} style={styles.closeCircle}><Text style={styles.closeText}>×</Text></Pressable><PhotoStatusBadge state={photoState(selectedPhoto.photo, selectedPhoto.memory?.visibility)} /></View><Image source={{ uri: selectedPhoto.photo.image_url }} style={styles.photoViewerImage} resizeMode="contain" /><View style={styles.photoViewerInfo}><Text style={styles.photoViewerTitle}>{selectedPhoto.memory?.title?.trim() || selectedPhoto.photo.caption?.trim() || 'Photo Memory'}</Text>{selectedPhoto.photo.caption ? <Text style={styles.photoViewerCaption}>{selectedPhoto.photo.caption}</Text> : null}<Text style={styles.photoViewerMeta}>{formatDate(selectedPhoto.photo.created_at)}</Text></View></SafeAreaView> : null}</View></Modal>
    </SafeAreaView>
  );
}

function MemoryCard({ memory, photos, changingVisibility, deleting, onToggleVisibility, onManage, onPhoto }: { memory: AdventureMemory; photos: MemoryPhoto[]; changingVisibility: boolean; deleting: boolean; onToggleVisibility: () => void; onManage: () => void; onPhoto: (photo: MemoryPhoto) => void; }) {
  const heroPhoto = photos[0];
  const hasPhoto = Boolean(heroPhoto);
  const fallbackTitle = hasPhoto ? 'Photo Memory' : 'Adventure Memory';
  const edited = memory.updated_at && memory.updated_at !== memory.created_at;
  return <View style={styles.memoryCard}>{heroPhoto ? <Pressable onPress={() => onPhoto(heroPhoto)} style={({ pressed }) => [styles.memoryHeroPhotoWrap, pressed && styles.pressed]}><Image source={{ uri: heroPhoto.image_url }} style={styles.memoryHeroPhoto} /><View style={styles.memoryPhotoBadgeWrap}><PhotoStatusBadge state={photoState(heroPhoto, memory.visibility)} compact /></View>{photos.length > 1 ? <View style={styles.photoCountBadge}><Text style={styles.photoCountText}>+{photos.length - 1}</Text></View> : null}</Pressable> : null}<View style={styles.memoryContent}><View style={styles.memoryTopRow}><View style={styles.memoryDateWrap}><Text style={styles.memoryDate}>{formatDate(memory.created_at)}{edited ? ' · Edited' : ''}</Text>{memory.rating ? <Text style={styles.memoryRating}>{'★'.repeat(memory.rating)}<Text style={styles.unfilledStars}>{'★'.repeat(5 - memory.rating)}</Text></Text> : null}</View><View style={styles.memoryActions}><Pressable onPress={onToggleVisibility} disabled={changingVisibility || deleting} style={styles.visibilityPill}><AppIcon name={memory.visibility === 'public' ? 'community' : 'privacy'} color={memory.visibility === 'public' ? '#7BC987' : '#67CFC8'} size={12} /><Text style={[styles.visibilityPillText, memory.visibility === 'public' && styles.publicText]}>{changingVisibility ? 'UPDATING…' : memory.visibility.toUpperCase()}</Text></Pressable><Pressable onPress={onManage} disabled={deleting} hitSlop={10} style={styles.moreButton}>{deleting ? <ActivityIndicator size="small" color="#F5C341" /> : <Text style={styles.moreText}>•••</Text>}</Pressable></View></View><Text style={styles.memoryTitle}>{memory.title?.trim() || fallbackTitle}</Text>{memory.body ? <Text style={styles.memoryBody}>{memory.body}</Text> : <Text style={styles.memoryEmptyDetail}>No notes added.</Text>}{photos.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.memoryThumbStrip}>{photos.slice(1, 6).map((photo) => <Pressable key={photo.id} onPress={() => onPhoto(photo)}><Image source={{ uri: photo.image_url }} style={styles.memoryThumb} /></Pressable>)}</ScrollView> : null}{memory.tags.length ? <View style={styles.tagsLine}><Text style={styles.tagsLabel}>WITH</Text><View style={styles.miniAvatars}>{memory.tags.slice(0, 3).map((tag) => tag.avatar_url ? <Image key={tag.profile_id} source={{ uri: tag.avatar_url }} style={styles.miniAvatar} /> : <View key={tag.profile_id} style={[styles.miniAvatar, styles.miniAvatarFallback]}><Text style={styles.miniInitial}>{(tag.display_name || tag.username || 'A').slice(0, 1).toUpperCase()}</Text></View>)}</View><Text style={styles.tagNames} numberOfLines={1}>{memory.tags.map((tag) => tag.display_name || tag.username || 'Adventurer').join(', ')}</Text></View> : null}</View></View>;
}

function PhotoStatusBadge({ state, compact = false }: { state: PhotoState; compact?: boolean }) {
  const icon = state === 'private' ? 'privacy' : state === 'pending' ? 'time' : state === 'rejected' ? 'close' : 'community';
  return <View style={[styles.photoStatus, compact && styles.photoStatusCompact, state === 'private' && styles.photoStatusPrivate, state === 'pending' && styles.photoStatusPending, state === 'rejected' && styles.photoStatusRejected, state === 'gallery' && styles.photoStatusGallery]}><AppIcon name={icon} color={state === 'private' ? '#7CC9FF' : state === 'pending' ? '#F5C341' : state === 'rejected' ? '#FF8F86' : '#7EDB80'} size={compact ? 10 : 13} /><Text style={[styles.photoStatusText, compact && styles.photoStatusTextCompact]}>{photoStateLabel(state)}</Text></View>;
}

function SheetAction({ icon, title, body, onPress, busy = false }: { icon: any; title: string; body: string; onPress: () => void; busy?: boolean }) { return <Pressable onPress={onPress} disabled={busy} style={({ pressed }) => [styles.sheetAction, pressed && styles.pressed, busy && styles.disabled]}><AppIcon name={icon} color="#F5C341" size={20} /><View style={styles.sheetActionCopy}><Text style={styles.sheetActionTitle}>{busy ? 'Updating…' : title}</Text><Text style={styles.sheetActionBody}>{body}</Text></View><Text style={styles.sheetChevron}>›</Text></Pressable>; }
function ConnectedAvatar({ person }: { person: AdventureEventPerson }) { return <Pressable onPress={() => router.push({ pathname: '/community-profile/[id]', params: { id: person.profile_id } })} style={styles.connectedPerson}><PersonAvatar person={person} size={56} /><Text style={styles.connectedName} numberOfLines={1}>{personName(person)}</Text></Pressable>; }
function PersonAvatar({ person, size }: { person: AdventureEventPerson; size: number }) { return person.avatar_url ? <Image source={{ uri: person.avatar_url }} style={{ width: size, height: size, borderRadius: size / 2 }} /> : <View style={[styles.personAvatarFallback, { width: size, height: size, borderRadius: size / 2 }]}><Text style={styles.personAvatarInitial}>{personName(person).slice(0, 1).toUpperCase()}</Text></View>; }

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#09110F'},centered:{flex:1,alignItems:'center',justifyContent:'center',gap:12,padding:24},loadingText:{color:'#98A59E',fontWeight:'700'},missingTitle:{color:'#F7F8F3',fontSize:22,fontWeight:'900'},content:{paddingHorizontal:18,paddingTop:8,paddingBottom:84,gap:13},back:{minHeight:44,flexDirection:'row',alignItems:'center',alignSelf:'flex-start',marginLeft:-5,gap:3},backText:{color:'#F5C341',fontWeight:'800'},error:{color:'#FFB4A9',backgroundColor:'#2A1715',borderRadius:12,padding:12},heroCard:{backgroundColor:'#111A17',borderWidth:1,borderColor:'#29342F',borderRadius:22,padding:14,gap:11},heroRow:{flexDirection:'row',alignItems:'center',gap:14},heroArt:{width:108,height:138,alignItems:'center',justifyContent:'center',flexShrink:0},stampImage:{width:'100%',height:'100%'},heroInfo:{flex:1,gap:8,minWidth:0},title:{color:'#F7F8F3',fontSize:22,lineHeight:26,fontWeight:'900'},metaItem:{flexDirection:'row',alignItems:'flex-start',gap:6},meta:{flex:1,color:'#B6C1BB',fontSize:12,lineHeight:17},heroStatusRow:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,flexWrap:'wrap'},statusPill:{flexDirection:'row',alignItems:'center',gap:4,borderRadius:999,paddingHorizontal:9,paddingVertical:5},statusEarned:{backgroundColor:'#7EDB80'},statusPreview:{borderWidth:1,borderColor:'#45534C'},statusText:{color:'#17211C',fontSize:8.5,fontWeight:'900',letterSpacing:.7},statusPreviewText:{color:'#9AA69F'},statusDot:{color:'#5E6A64'},collection:{color:'#67CFC8',fontSize:9.5,fontWeight:'900',letterSpacing:1},tabs:{minHeight:52,flexDirection:'row',borderWidth:1,borderColor:'#33423B',borderRadius:15,overflow:'hidden',backgroundColor:'#0D1512'},tab:{flex:1,minHeight:52,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,borderBottomWidth:3,borderBottomColor:'transparent'},tabActive:{backgroundColor:'#16231F',borderBottomColor:'#F5C341'},tabText:{color:'#8D9992',fontSize:14,fontWeight:'800'},tabTextActive:{color:'#F5C341'},sectionHeader:{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',gap:12,paddingTop:3},sectionHeaderCompact:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:10},sectionHeaderCopy:{flex:1},eyebrow:{color:'#67CFC8',fontSize:9.5,fontWeight:'900',letterSpacing:1},sectionTitle:{color:'#F7F8F3',fontSize:25,lineHeight:30,fontWeight:'900',marginTop:3},cardTitle:{color:'#F7F8F3',fontSize:16,lineHeight:20,fontWeight:'900',marginTop:3},outlineButton:{minHeight:44,borderRadius:999,borderWidth:1,borderColor:'#806C31',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingHorizontal:12},outlineButtonText:{color:'#F5C341',fontSize:9,fontWeight:'900',letterSpacing:.5},memoryCard:{backgroundColor:'#111A17',borderWidth:1,borderColor:'#304038',borderRadius:19,overflow:'hidden'},memoryHeroPhotoWrap:{width:'100%',aspectRatio:1.72,backgroundColor:'#18231E',position:'relative'},memoryHeroPhoto:{width:'100%',height:'100%'},memoryPhotoBadgeWrap:{position:'absolute',left:10,bottom:10},photoCountBadge:{position:'absolute',right:10,bottom:10,minWidth:32,height:28,borderRadius:14,backgroundColor:'rgba(7,14,12,0.86)',alignItems:'center',justifyContent:'center',paddingHorizontal:8},photoCountText:{color:'#F7F8F3',fontWeight:'900',fontSize:11},memoryContent:{padding:15,gap:9},memoryTopRow:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:10},memoryDateWrap:{flex:1,gap:4},memoryDate:{color:'#9EAAA3',fontSize:11,fontWeight:'700'},memoryRating:{color:'#F5C341',fontSize:17,letterSpacing:1},unfilledStars:{color:'#56625B'},memoryActions:{flexDirection:'row',alignItems:'center',gap:8},visibilityPill:{minHeight:36,borderRadius:999,borderWidth:1,borderColor:'#3C625D',flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:9},visibilityPillText:{color:'#67CFC8',fontSize:8.5,fontWeight:'900',letterSpacing:.5},publicText:{color:'#7BC987'},moreButton:{width:44,height:44,alignItems:'center',justifyContent:'center'},moreText:{color:'#C7D1CB',fontSize:18,lineHeight:20,fontWeight:'900',letterSpacing:1},memoryTitle:{color:'#F7F8F3',fontSize:21,lineHeight:26,fontWeight:'900'},memoryBody:{color:'#C2CCC6',fontSize:14,lineHeight:21},memoryEmptyDetail:{color:'#748078',fontSize:12,fontStyle:'italic'},memoryThumbStrip:{gap:8,paddingTop:2},memoryThumb:{width:76,height:76,borderRadius:11,backgroundColor:'#18231E'},tagsLine:{flexDirection:'row',alignItems:'center',gap:7,paddingTop:3},tagsLabel:{color:'#7F8C85',fontSize:8.5,fontWeight:'900',letterSpacing:.8},miniAvatars:{flexDirection:'row',marginLeft:2},miniAvatar:{width:25,height:25,borderRadius:13,borderWidth:2,borderColor:'#111A17',marginLeft:-4,backgroundColor:'#22302A'},miniAvatarFallback:{alignItems:'center',justifyContent:'center'},miniInitial:{color:'#F7F8F3',fontSize:9,fontWeight:'900'},tagNames:{flex:1,color:'#AAB6AF',fontSize:11.5,fontWeight:'700'},privacyHelper:{borderWidth:1,borderColor:'#264B35',backgroundColor:'#0E1914',borderRadius:16,padding:13,flexDirection:'row',alignItems:'flex-start',gap:11},privacyHelperIcon:{width:34,height:34,borderRadius:17,backgroundColor:'#173321',alignItems:'center',justifyContent:'center'},privacyHelperCopy:{flex:1,gap:3},privacyHelperTitle:{color:'#EAF1EC',fontSize:12.5,fontWeight:'900'},privacyHelperBody:{color:'#8F9B94',fontSize:11,lineHeight:16},sectionCard:{backgroundColor:'#111A17',borderWidth:1,borderColor:'#29342F',borderRadius:18,padding:15,gap:12},avatarStrip:{gap:13,paddingRight:4},connectedPerson:{width:74,alignItems:'center',gap:5},connectedName:{color:'#EAF0EC',width:'100%',textAlign:'center',fontSize:10.5,fontWeight:'800'},personAvatarFallback:{backgroundColor:'#22302A',borderWidth:1,borderColor:'#D7B45A',alignItems:'center',justifyContent:'center'},personAvatarInitial:{color:'#F7F8F3',fontWeight:'900',fontSize:16},emptyCard:{minHeight:150,borderRadius:18,borderWidth:1,borderStyle:'dashed',borderColor:'#35443D',alignItems:'center',justifyContent:'center',padding:20,gap:7},emptyTitle:{color:'#F7F8F3',fontSize:14.5,lineHeight:19,fontWeight:'900'},emptyBody:{color:'#929E97',fontSize:12.5,lineHeight:18},galleryGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},galleryTile:{width:'31.7%',aspectRatio:1,borderRadius:12,overflow:'hidden',backgroundColor:'#18231E',position:'relative'},galleryImage:{width:'100%',height:'100%'},inlineEmpty:{minHeight:90,flexDirection:'row',alignItems:'center',gap:12,paddingVertical:8},inlineEmptyCopy:{flex:1,gap:4},photoStatus:{minHeight:34,borderRadius:999,borderWidth:1,flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:10,backgroundColor:'rgba(8,15,13,0.92)'},photoStatusCompact:{position:'absolute',left:5,bottom:5,minHeight:24,paddingHorizontal:6,gap:3,maxWidth:'92%'},photoStatusPrivate:{borderColor:'#3D718C'},photoStatusPending:{borderColor:'#806C31'},photoStatusRejected:{borderColor:'#824C47'},photoStatusGallery:{borderColor:'#416B48'},photoStatusText:{color:'#EAF0EC',fontSize:9,fontWeight:'900',letterSpacing:.45},photoStatusTextCompact:{fontSize:6.6},momentStack:{gap:10},communityMoment:{borderTopWidth:1,borderTopColor:'#25312C',paddingTop:11,gap:7},communityMomentHeader:{flexDirection:'row',alignItems:'center',gap:9},communityAvatar:{width:35,height:35,borderRadius:18,backgroundColor:'#22302A'},communityAvatarFallback:{width:35,height:35,borderRadius:18,backgroundColor:'#22302A',alignItems:'center',justifyContent:'center'},communityAvatarInitial:{color:'#F7F8F3',fontSize:12,fontWeight:'900'},communityHeaderCopy:{flex:1},communityAuthor:{color:'#F7F8F3',fontSize:12.5,fontWeight:'900'},communityMomentMeta:{color:'#7F8B84',fontSize:9.5,marginTop:1},communityMomentTitle:{color:'#F7F8F3',fontSize:15.5,fontWeight:'900'},communityMomentBody:{color:'#C2CBC5',fontSize:12.5,lineHeight:18},tagSummary:{color:'#8FD4C7',fontSize:10.5,fontWeight:'700'},connectionStack:{gap:9},connectionRow:{minHeight:64,borderTopWidth:1,borderTopColor:'#25312C',paddingTop:10,flexDirection:'row',alignItems:'center',gap:9},connectionIdentity:{flex:1,flexDirection:'row',alignItems:'center',gap:10},connectionCopy:{flex:1},personName:{color:'#F7F8F3',fontSize:12.5,fontWeight:'900'},personHandle:{color:'#8B9790',fontSize:9.5,marginTop:1},requestedBy:{color:'#67CFC8',fontSize:9,fontWeight:'800',marginTop:2},connectionButton:{minHeight:38,borderRadius:999,backgroundColor:'#F5C341',alignItems:'center',justifyContent:'center',paddingHorizontal:12},acceptButton:{backgroundColor:'#79D486'},requestedButton:{backgroundColor:'#24312B'},connectionButtonText:{color:'#17211C',fontSize:8,fontWeight:'900',letterSpacing:.4},requestedButtonText:{color:'#8FD4C7'},lockedCard:{minHeight:100,borderRadius:18,borderWidth:1,borderColor:'#29342F',backgroundColor:'#111A17',alignItems:'center',justifyContent:'center',gap:8,padding:18},primaryButton:{minHeight:50,borderRadius:15,backgroundColor:'#F5C341',alignItems:'center',justifyContent:'center',paddingHorizontal:18},primaryButtonText:{color:'#17211C',fontSize:14,fontWeight:'900'},pressed:{opacity:.72},disabled:{opacity:.5},modalRoot:{flex:1,justifyContent:'flex-end'},modalBackdrop:{...StyleSheet.absoluteFill,backgroundColor:'rgba(0,0,0,0.66)'},optionsSheet:{backgroundColor:'#101916',borderTopLeftRadius:26,borderTopRightRadius:26,borderWidth:1,borderColor:'#2D3B34',paddingHorizontal:18,paddingTop:10,paddingBottom:24,gap:10},sheetHandle:{width:42,height:4,borderRadius:2,backgroundColor:'#425048',alignSelf:'center',marginBottom:5},sheetEyebrow:{color:'#67CFC8',fontSize:9,fontWeight:'900',letterSpacing:1},sheetTitle:{color:'#F7F8F3',fontSize:22,lineHeight:27,fontWeight:'900'},sheetMeta:{color:'#8D9992',fontSize:11,marginBottom:3},sheetAction:{minHeight:64,borderTopWidth:1,borderTopColor:'#27332D',flexDirection:'row',alignItems:'center',gap:12,paddingVertical:10},sheetActionCopy:{flex:1,gap:3},sheetActionTitle:{color:'#F7F8F3',fontSize:14,fontWeight:'900'},sheetActionBody:{color:'#8E9A93',fontSize:10.5,lineHeight:15},sheetChevron:{color:'#7E8A83',fontSize:26,fontWeight:'300'},deleteAction:{minHeight:64,borderTopWidth:1,borderTopColor:'#3A2825',flexDirection:'row',alignItems:'center',gap:12,paddingVertical:10},deleteActionTitle:{color:'#FF9B93',fontSize:14,fontWeight:'900'},cancelButton:{minHeight:48,borderRadius:14,borderWidth:1,borderColor:'#3A4841',alignItems:'center',justifyContent:'center',marginTop:3},cancelButtonText:{color:'#B3BDB7',fontSize:10,fontWeight:'900',letterSpacing:.6},deleteConfirm:{alignItems:'center',gap:10,paddingTop:8},deleteConfirmTitle:{color:'#F7F8F3',fontSize:21,fontWeight:'900'},deleteConfirmBody:{color:'#A4AFA8',fontSize:12.5,lineHeight:18,textAlign:'center'},confirmDeleteButton:{width:'100%',minHeight:50,borderRadius:14,backgroundColor:'#A23E38',alignItems:'center',justifyContent:'center',marginTop:5},confirmDeleteText:{color:'#FFF5F3',fontSize:11,fontWeight:'900',letterSpacing:.5},photoViewerRoot:{flex:1,backgroundColor:'rgba(0,0,0,0.96)'},photoViewerBackdrop:{...StyleSheet.absoluteFill},photoViewerSafe:{flex:1,justifyContent:'space-between'},photoViewerTop:{minHeight:64,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16},closeCircle:{width:44,height:44,borderRadius:22,backgroundColor:'rgba(30,40,35,0.88)',alignItems:'center',justifyContent:'center'},closeText:{color:'#F7F8F3',fontSize:30,lineHeight:32,fontWeight:'300'},photoViewerImage:{width:'100%',flex:1},photoViewerInfo:{paddingHorizontal:18,paddingVertical:18,gap:5,backgroundColor:'rgba(9,17,15,0.92)'},photoViewerTitle:{color:'#F7F8F3',fontSize:19,fontWeight:'900'},photoViewerCaption:{color:'#C7D0CA',fontSize:13,lineHeight:19},photoViewerMeta:{color:'#7F8B84',fontSize:10.5}
});
