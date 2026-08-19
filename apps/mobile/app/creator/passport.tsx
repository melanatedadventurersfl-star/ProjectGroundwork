import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../src/auth/AuthProvider';
import { supabase } from '../../src/lib/supabase';
import { BadgeArt, hasBadgeArt } from '../../src/passport/BadgeArt';
import { RankEmblem, rankLadder, type RankName } from '../../src/passport/RankEmblem';
import { isLegacyStampCode, StampArt } from '../../src/passport/StampArt';
import { AppIcon } from '../../src/ui/AppIcon';

type MemberSummary = {
  profile_id: string;
  display_name: string | null;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  platform_role: string | null;
  completed_adventures: number;
  badge_count: number;
  stamp_count: number;
  calculated_rank: RankName;
  rank_override: RankName | null;
  effective_rank: RankName;
};

type BadgeRow = {
  badge_id: string;
  code: string | null;
  title: string;
  description: string | null;
  icon_name: string | null;
  category: string | null;
  earned: boolean;
  member_badge_id: string | null;
  earned_at: string | null;
  evidence: Record<string, unknown>;
};

type StampAcquisition = {
  member_stamp_id: string;
  earned_at: string;
  adventure_id: string | null;
  evidence: Record<string, unknown>;
};

type StampRow = {
  stamp_id: string;
  code: string | null;
  title: string;
  description: string | null;
  icon_name: string | null;
  category: string | null;
  earned_count: number;
  acquisitions: StampAcquisition[];
};

type AuditRow = {
  id: string;
  action: string;
  subject_type: 'rank' | 'badge' | 'stamp';
  subject_id: string | null;
  reason: string;
  created_at: string;
};

type Recognition = {
  member: {
    profile_id: string;
    display_name: string | null;
    username: string | null;
    email: string | null;
    avatar_url: string | null;
    platform_role: string | null;
  };
  rank: {
    completed_adventures: number;
    calculated_rank: RankName;
    rank_override: RankName | null;
    effective_rank: RankName;
    override_reason: string | null;
    override_set_at: string | null;
  };
  badges: BadgeRow[];
  stamps: StampRow[];
  history: AuditRow[];
};

type TabName = 'rank' | 'badges' | 'stamps' | 'history';
type FilterName = 'all' | 'earned' | 'available';
type PendingAction =
  | { kind: 'set-rank'; rank: RankName; title: string; defaultReason: string }
  | { kind: 'clear-rank'; title: string; defaultReason: string }
  | { kind: 'grant-badge'; badgeId: string; title: string; defaultReason: string }
  | { kind: 'revoke-badge'; badgeId: string; title: string; defaultReason: string }
  | { kind: 'grant-stamp'; stampId: string; title: string; defaultReason: string }
  | { kind: 'revoke-stamp'; memberStampId: string; title: string; defaultReason: string };

const tabs: { key: TabName; label: string }[] = [
  { key: 'rank', label: 'Rank' },
  { key: 'badges', label: 'Badges' },
  { key: 'stamps', label: 'Stamps' },
  { key: 'history', label: 'History' },
];

function memberName(member: Pick<MemberSummary, 'display_name' | 'username' | 'email'>) {
  return member.display_name?.trim() || member.username?.trim() || member.email?.split('@')[0] || 'Member';
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : parts[0]?.[1] ?? '';
  return `${first}${last}`.toUpperCase() || 'MA';
}

function friendlyAction(action: string) {
  switch (action) {
    case 'rank_override_set': return 'Rank override changed';
    case 'rank_override_cleared': return 'Returned to calculated rank';
    case 'badge_granted': return 'Badge granted';
    case 'badge_revoked': return 'Badge removed';
    case 'stamp_granted': return 'Stamp granted';
    case 'stamp_revoked': return 'Stamp removed';
    default: return action.replaceAll('_', ' ');
  }
}

export default function CreatorPassportScreen() {
  const { session } = useAuth();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [memberQuery, setMemberQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recognition, setRecognition] = useState<Recognition | null>(null);
  const [loadingRecognition, setLoadingRecognition] = useState(false);
  const [tab, setTab] = useState<TabName>('rank');
  const [collectionQuery, setCollectionQuery] = useState('');
  const [filter, setFilter] = useState<FilterName>('all');
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadMembers = useCallback(async (query: string) => {
    setSearching(true);
    const { data, error: searchError } = await supabase.rpc('creator_search_passport_members', {
      p_query: query,
      p_limit: 30,
    });
    if (searchError) {
      setAuthorized(false);
      setError(searchError.message);
      setMembers([]);
    } else {
      setAuthorized(true);
      setMembers((data ?? []) as MemberSummary[]);
      setError('');
    }
    setSearching(false);
  }, []);

  const loadRecognition = useCallback(async (profileId: string) => {
    setLoadingRecognition(true);
    setError('');
    const { data, error: detailError } = await supabase.rpc('creator_get_passport_recognition', {
      p_profile_id: profileId,
    });
    if (detailError) {
      setError(detailError.message);
      setRecognition(null);
    } else {
      setRecognition(data as Recognition);
    }
    setLoadingRecognition(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void loadMembers(memberQuery); }, 220);
    return () => clearTimeout(timer);
  }, [loadMembers, memberQuery]);

  useEffect(() => {
    if (selectedId) void loadRecognition(selectedId);
  }, [loadRecognition, selectedId]);

  function selectMember(profileId: string) {
    setSelectedId(profileId);
    setTab('rank');
    setCollectionQuery('');
    setFilter('all');
  }

  function openAction(action: PendingAction) {
    setPendingAction(action);
    setReason(action.defaultReason);
  }

  async function confirmAction() {
    if (!pendingAction || !recognition || saving || reason.trim().length < 2) return;
    setSaving(true);
    setError('');
    try {
      const profileId = recognition.member.profile_id;
      let result: { error: { message: string } | null };
      if (pendingAction.kind === 'set-rank') {
        result = await supabase.rpc('creator_set_rank_override', {
          p_profile_id: profileId,
          p_rank_name: pendingAction.rank,
          p_reason: reason.trim(),
        });
      } else if (pendingAction.kind === 'clear-rank') {
        result = await supabase.rpc('creator_clear_rank_override', {
          p_profile_id: profileId,
          p_reason: reason.trim(),
        });
      } else if (pendingAction.kind === 'grant-badge') {
        result = await supabase.rpc('creator_grant_badge', {
          p_profile_id: profileId,
          p_badge_id: pendingAction.badgeId,
          p_reason: reason.trim(),
        });
      } else if (pendingAction.kind === 'revoke-badge') {
        result = await supabase.rpc('creator_revoke_badge', {
          p_profile_id: profileId,
          p_badge_id: pendingAction.badgeId,
          p_reason: reason.trim(),
        });
      } else if (pendingAction.kind === 'grant-stamp') {
        result = await supabase.rpc('creator_grant_stamp', {
          p_profile_id: profileId,
          p_stamp_id: pendingAction.stampId,
          p_reason: reason.trim(),
        });
      } else {
        result = await supabase.rpc('creator_revoke_stamp', {
          p_profile_id: profileId,
          p_member_stamp_id: pendingAction.memberStampId,
          p_reason: reason.trim(),
        });
      }
      if (result.error) throw new Error(result.error.message);
      setPendingAction(null);
      setReason('');
      await Promise.all([loadRecognition(profileId), loadMembers(memberQuery)]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save that Passport change.');
    } finally {
      setSaving(false);
    }
  }

  const filteredBadges = useMemo(() => {
    const query = collectionQuery.trim().toLowerCase();
    return (recognition?.badges ?? []).filter((badge) => {
      const matchesText = !query || `${badge.title} ${badge.category ?? ''} ${badge.description ?? ''}`.toLowerCase().includes(query);
      const matchesFilter = filter === 'all' || (filter === 'earned' ? badge.earned : !badge.earned);
      return matchesText && matchesFilter;
    });
  }, [collectionQuery, filter, recognition?.badges]);

  const filteredStamps = useMemo(() => {
    const query = collectionQuery.trim().toLowerCase();
    return (recognition?.stamps ?? []).filter((stamp) => {
      const earned = stamp.earned_count > 0;
      const matchesText = !query || `${stamp.title} ${stamp.category ?? ''} ${stamp.description ?? ''}`.toLowerCase().includes(query);
      const matchesFilter = filter === 'all' || (filter === 'earned' ? earned : !earned);
      return matchesText && matchesFilter;
    });
  }, [collectionQuery, filter, recognition?.stamps]);

  if (authorized === null) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#F5C341" size="large" /><Text style={styles.muted}>Opening Passport controls…</Text></View></SafeAreaView>;
  }

  if (!authorized) {
    return <SafeAreaView style={styles.safe}><View style={styles.denied}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable><View style={styles.deniedCard}><Text style={styles.eyebrow}>FOUNDER ONLY</Text><Text style={styles.title}>Passport control is protected</Text><Text style={styles.muted}>Only the private Master/Founder account can change member ranks, badges, and stamps.</Text>{error ? <Text style={styles.error}>{error}</Text> : null}</View></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.back}>‹ Creator Console</Text></Pressable>
        <View style={styles.hero}>
          <View style={styles.founderBadge}><Text style={styles.founderBadgeText}>FOUNDER CONTROL</Text></View>
          <Text style={styles.title}>Passport & Recognition</Text>
          <Text style={styles.subtitle}>Change displayed rank, badges, and stamps without rewriting a member’s real adventure history.</Text>
        </View>

        <View style={styles.guardCard}>
          <AppIcon name="badge" color="#F5C341" size={21} />
          <View style={styles.guardCopy}><Text style={styles.guardTitle}>Every change is recorded</Text><Text style={styles.muted}>Manual awards, removals, and rank overrides create a Founder audit entry with the reason.</Text></View>
        </View>

        <View style={styles.searchCard}>
          <View style={styles.searchHeadingRow}>
            <View><Text style={styles.sectionEyebrow}>MEMBER</Text><Text style={styles.sectionTitle}>{recognition ? 'Managing Passport' : 'Choose a member'}</Text></View>
            {recognition ? <Pressable onPress={() => { setSelectedId(null); setRecognition(null); }}><Text style={styles.changeMember}>Change</Text></Pressable> : null}
          </View>

          {!recognition ? (
            <>
              <Pressable style={styles.selfButton} onPress={() => session?.user.id && selectMember(session.user.id)}>
                <AppIcon name="profile" color="#111A17" size={19} />
                <Text style={styles.selfButtonText}>Manage My Passport</Text>
              </Pressable>
              <View style={styles.searchInputWrap}>
                <AppIcon name="search" color="#829087" size={18} />
                <TextInput
                  value={memberQuery}
                  onChangeText={setMemberQuery}
                  placeholder="Search name, username, or email"
                  placeholderTextColor="#6F7D75"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.searchInput}
                />
                {searching ? <ActivityIndicator size="small" color="#D7B45A" /> : null}
              </View>
              <View style={styles.memberList}>
                {members.map((member) => {
                  const name = memberName(member);
                  const isSelf = member.profile_id === session?.user.id;
                  return (
                    <Pressable key={member.profile_id} style={styles.memberRow} onPress={() => selectMember(member.profile_id)}>
                      <Avatar uri={member.avatar_url} name={name} size={46} />
                      <View style={styles.memberCopy}>
                        <View style={styles.memberNameRow}><Text style={styles.memberName} numberOfLines={1}>{name}</Text>{isSelf ? <Text style={styles.youPill}>YOU</Text> : null}</View>
                        <Text style={styles.memberMeta} numberOfLines={1}>{member.username ? `@${member.username}` : member.email ?? 'Member'}</Text>
                        <View style={styles.memberStats}><Text style={styles.statPill}>{member.effective_rank}</Text><Text style={styles.statText}>{member.badge_count} badges</Text><Text style={styles.statText}>{member.stamp_count} stamps</Text></View>
                      </View>
                      <AppIcon name="chevron-forward" color="#D7B45A" size={20} />
                    </Pressable>
                  );
                })}
                {!searching && !members.length ? <Text style={styles.empty}>No matching members.</Text> : null}
              </View>
            </>
          ) : (
            <SelectedMemberCard recognition={recognition} />
          )}
        </View>

        {loadingRecognition ? <ActivityIndicator color="#F5C341" style={{ marginVertical: 24 }} /> : null}

        {recognition && !loadingRecognition ? (
          <>
            <View style={styles.tabs}>
              {tabs.map((item) => (
                <Pressable key={item.key} style={[styles.tab, tab === item.key && styles.tabActive]} onPress={() => { setTab(item.key); setCollectionQuery(''); setFilter('all'); }}>
                  <Text style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>

            {tab === 'rank' ? (
              <RankPanel recognition={recognition} onAction={openAction} />
            ) : null}

            {tab === 'badges' ? (
              <CollectionPanel
                title="Badges"
                query={collectionQuery}
                setQuery={setCollectionQuery}
                filter={filter}
                setFilter={setFilter}
              >
                {filteredBadges.map((badge) => (
                  <View key={badge.badge_id} style={styles.collectionRow}>
                    <View style={styles.artShell}>
                      {hasBadgeArt(badge.title) ? <BadgeArt title={badge.title} size={62} /> : <View style={styles.fallbackArt}><Text style={styles.fallbackArtText}>MA</Text></View>}
                    </View>
                    <View style={styles.collectionCopy}>
                      <View style={styles.collectionTitleRow}><Text style={styles.collectionTitle}>{badge.title}</Text>{badge.earned ? <Text style={styles.earnedPill}>EARNED</Text> : null}</View>
                      <Text style={styles.collectionMeta}>{badge.category || 'milestone'}{badge.earned_at ? ` · ${new Date(badge.earned_at).toLocaleDateString()}` : ''}</Text>
                      {badge.description ? <Text style={styles.collectionDescription} numberOfLines={2}>{badge.description}</Text> : null}
                      {badge.earned && badge.evidence?.source === 'founder_manual' ? <Text style={styles.manualLabel}>Founder awarded</Text> : null}
                    </View>
                    <Pressable
                      style={[styles.smallAction, badge.earned && styles.removeAction]}
                      onPress={() => openAction(badge.earned
                        ? { kind: 'revoke-badge', badgeId: badge.badge_id, title: `Remove ${badge.title}?`, defaultReason: 'Founder manual badge removal' }
                        : { kind: 'grant-badge', badgeId: badge.badge_id, title: `Grant ${badge.title}?`, defaultReason: 'Founder manual badge grant' })}
                    >
                      <Text style={[styles.smallActionText, badge.earned && styles.removeActionText]}>{badge.earned ? 'Remove' : 'Grant'}</Text>
                    </Pressable>
                  </View>
                ))}
              </CollectionPanel>
            ) : null}

            {tab === 'stamps' ? (
              <CollectionPanel
                title="Stamps"
                query={collectionQuery}
                setQuery={setCollectionQuery}
                filter={filter}
                setFilter={setFilter}
              >
                {filteredStamps.map((stamp) => {
                  const earned = stamp.earned_count > 0;
                  return (
                    <View key={stamp.stamp_id} style={styles.collectionRowWrap}>
                      <View style={styles.collectionRow}>
                        <View style={styles.artShell}>
                          {isLegacyStampCode(stamp.code) ? <StampArt code={stamp.code} width={62} /> : <View style={styles.fallbackArt}><Text style={styles.fallbackArtText}>MA</Text></View>}
                        </View>
                        <View style={styles.collectionCopy}>
                          <View style={styles.collectionTitleRow}><Text style={styles.collectionTitle}>{stamp.title}</Text>{earned ? <Text style={styles.earnedPill}>{stamp.earned_count > 1 ? `${stamp.earned_count}×` : 'EARNED'}</Text> : null}</View>
                          <Text style={styles.collectionMeta}>{stamp.category || 'passport'}</Text>
                          {stamp.description ? <Text style={styles.collectionDescription} numberOfLines={2}>{stamp.description}</Text> : null}
                        </View>
                        {!earned ? (
                          <Pressable style={styles.smallAction} onPress={() => openAction({ kind: 'grant-stamp', stampId: stamp.stamp_id, title: `Grant ${stamp.title}?`, defaultReason: 'Founder manual stamp grant' })}>
                            <Text style={styles.smallActionText}>Grant</Text>
                          </Pressable>
                        ) : null}
                      </View>
                      {earned ? (
                        <View style={styles.acquisitions}>
                          {stamp.acquisitions.map((acquisition) => (
                            <View key={acquisition.member_stamp_id} style={styles.acquisitionRow}>
                              <View style={styles.acquisitionCopy}>
                                <Text style={styles.acquisitionTitle}>Earned {new Date(acquisition.earned_at).toLocaleDateString()}</Text>
                                <Text style={styles.acquisitionMeta}>{acquisition.evidence?.source === 'founder_manual' ? 'Founder awarded' : acquisition.adventure_id ? 'Adventure earned' : 'Passport earned'}</Text>
                              </View>
                              <Pressable style={[styles.smallAction, styles.removeAction]} onPress={() => openAction({ kind: 'revoke-stamp', memberStampId: acquisition.member_stamp_id, title: `Remove ${stamp.title}?`, defaultReason: 'Founder manual stamp removal' })}>
                                <Text style={[styles.smallActionText, styles.removeActionText]}>Remove</Text>
                              </Pressable>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </CollectionPanel>
            ) : null}

            {tab === 'history' ? (
              <View style={styles.panel}>
                <View style={styles.panelHeader}><Text style={styles.sectionEyebrow}>AUDIT TRAIL</Text><Text style={styles.panelTitle}>Founder changes</Text><Text style={styles.panelBody}>Recognition earned automatically is not rewritten here. This history records manual Founder actions.</Text></View>
                {recognition.history.length ? recognition.history.map((item) => (
                  <View key={item.id} style={styles.historyRow}>
                    <View style={styles.historyDot} />
                    <View style={styles.historyCopy}>
                      <Text style={styles.historyTitle}>{friendlyAction(item.action)}</Text>
                      <Text style={styles.historyReason}>{item.reason}</Text>
                      <Text style={styles.historyDate}>{new Date(item.created_at).toLocaleString()}</Text>
                    </View>
                  </View>
                )) : <Text style={styles.empty}>No manual Passport changes yet.</Text>}
              </View>
            ) : null}
          </>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <ActionModal
        action={pendingAction}
        reason={reason}
        setReason={setReason}
        saving={saving}
        onClose={() => !saving && setPendingAction(null)}
        onConfirm={() => void confirmAction()}
      />
    </SafeAreaView>
  );
}

function Avatar({ uri, name, size }: { uri: string | null; name: string; size: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri ? <Image source={{ uri }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{initials(name)}</Text>}
    </View>
  );
}

function SelectedMemberCard({ recognition }: { recognition: Recognition }) {
  const name = memberName(recognition.member);
  return (
    <View style={styles.selectedCard}>
      <Avatar uri={recognition.member.avatar_url} name={name} size={64} />
      <View style={styles.selectedCopy}>
        <View style={styles.memberNameRow}><Text style={styles.selectedName} numberOfLines={1}>{name}</Text>{recognition.member.platform_role === 'founder' ? <Text style={styles.founderMini}>FOUNDER</Text> : null}</View>
        <Text style={styles.memberMeta} numberOfLines={1}>{recognition.member.username ? `@${recognition.member.username}` : recognition.member.email ?? 'Member'}</Text>
        <View style={styles.selectedStats}>
          <Text style={styles.statPill}>{recognition.rank.effective_rank}</Text>
          <Text style={styles.statText}>{recognition.badges.filter((badge) => badge.earned).length} badges</Text>
          <Text style={styles.statText}>{recognition.stamps.reduce((sum, stamp) => sum + stamp.earned_count, 0)} stamps</Text>
        </View>
      </View>
      <RankEmblem rank={recognition.rank.effective_rank} size={64} />
    </View>
  );
}

function RankPanel({ recognition, onAction }: { recognition: Recognition; onAction: (action: PendingAction) => void }) {
  const rank = recognition.rank;
  return (
    <View style={styles.panel}>
      <View style={styles.rankHero}>
        <RankEmblem rank={rank.effective_rank} size={98} />
        <View style={styles.rankHeroCopy}>
          <Text style={styles.sectionEyebrow}>{rank.rank_override ? 'DISPLAYED RANK · OVERRIDE' : 'DISPLAYED RANK'}</Text>
          <Text style={styles.rankName}>{rank.effective_rank}</Text>
          <Text style={styles.panelBody}>Calculated from {rank.completed_adventures} completed adventure{rank.completed_adventures === 1 ? '' : 's'}: <Text style={styles.gold}>{rank.calculated_rank}</Text></Text>
        </View>
      </View>

      {rank.rank_override ? (
        <View style={styles.overrideCard}>
          <View style={styles.overrideCopy}><Text style={styles.overrideTitle}>Manual override active</Text><Text style={styles.overrideReason}>{rank.override_reason || 'Founder override'}</Text></View>
          <Pressable style={styles.useCalculated} onPress={() => onAction({ kind: 'clear-rank', title: 'Use calculated rank again?', defaultReason: 'Return to calculated Passport rank' })}><Text style={styles.useCalculatedText}>Reset</Text></Pressable>
        </View>
      ) : null}

      <View style={styles.panelHeader}><Text style={styles.panelTitle}>Choose displayed rank</Text><Text style={styles.panelBody}>This changes what the member sees without inventing completed adventures.</Text></View>
      <View style={styles.rankGrid}>
        {rankLadder.map(([name, minimum]) => {
          const current = rank.effective_rank === name;
          const calculated = rank.calculated_rank === name;
          return (
            <Pressable
              key={name}
              style={[styles.rankChoice, current && styles.rankChoiceCurrent]}
              onPress={() => onAction({ kind: 'set-rank', rank: name, title: `Display ${name}?`, defaultReason: recognition.member.platform_role === 'founder' ? 'Founder rank override for testing' : 'Founder manual rank override' })}
            >
              <RankEmblem rank={name} size={54} />
              <Text style={[styles.rankChoiceName, current && styles.rankChoiceNameCurrent]}>{name}</Text>
              <Text style={styles.rankChoiceMeta}>{minimum === 0 ? 'Starting rank' : `${minimum}+ adventures`}</Text>
              {calculated ? <Text style={styles.calculatedPill}>CALCULATED</Text> : current ? <Text style={styles.overridePill}>DISPLAYED</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function CollectionPanel({
  title,
  query,
  setQuery,
  filter,
  setFilter,
  children,
}: {
  title: string;
  query: string;
  setQuery: (value: string) => void;
  filter: FilterName;
  setFilter: (value: FilterName) => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}><Text style={styles.sectionEyebrow}>PASSPORT COLLECTION</Text><Text style={styles.panelTitle}>{title}</Text><Text style={styles.panelBody}>Earned items stay at the top. Search or filter the catalog, then grant or remove directly.</Text></View>
      <View style={styles.collectionSearch}><AppIcon name="search" color="#829087" size={17} /><TextInput value={query} onChangeText={setQuery} placeholder={`Search ${title.toLowerCase()}`} placeholderTextColor="#6F7D75" style={styles.collectionSearchInput} /></View>
      <View style={styles.filterRow}>
        {(['all', 'earned', 'available'] as FilterName[]).map((item) => (
          <Pressable key={item} style={[styles.filterChip, filter === item && styles.filterChipActive]} onPress={() => setFilter(item)}>
            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item === 'all' ? 'All' : item === 'earned' ? 'Earned' : 'Not earned'}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.collectionList}>{children}</View>
    </View>
  );
}

function ActionModal({
  action,
  reason,
  setReason,
  saving,
  onClose,
  onConfirm,
}: {
  action: PendingAction | null;
  reason: string;
  setReason: (value: string) => void;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={Boolean(action)} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalShade} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.modalCard}>
          <View style={styles.modalHandle} />
          <Text style={styles.sectionEyebrow}>CONFIRM FOUNDER CHANGE</Text>
          <Text style={styles.modalTitle}>{action?.title ?? 'Confirm change'}</Text>
          <Text style={styles.modalBody}>Reason is saved to the Passport audit trail. You can edit the suggested reason below.</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Reason for this change"
            placeholderTextColor="#69776F"
            multiline
            style={styles.reasonInput}
          />
          <View style={styles.modalActions}>
            <Pressable disabled={saving} style={styles.cancelButton} onPress={onClose}><Text style={styles.cancelText}>Cancel</Text></Pressable>
            <Pressable disabled={saving || reason.trim().length < 2} style={[styles.confirmButton, (saving || reason.trim().length < 2) && styles.disabled]} onPress={onConfirm}><Text style={styles.confirmText}>{saving ? 'Saving…' : 'Confirm'}</Text></Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' },
  content: { padding: 18, paddingBottom: 72, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  denied: { flex: 1, padding: 20 },
  deniedCard: { marginTop: 32, borderRadius: 20, borderWidth: 1, borderColor: '#5A3C35', backgroundColor: '#211817', padding: 20, gap: 8 },
  backButton: { alignSelf: 'flex-start', minHeight: 38, justifyContent: 'center' },
  back: { color: '#D7B45A', fontSize: 15, fontWeight: '900' },
  hero: { gap: 5, marginBottom: 2 },
  founderBadge: { alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, borderColor: '#8D7133', backgroundColor: '#3A311B', paddingHorizontal: 10, paddingVertical: 5 },
  founderBadgeText: { color: '#F5C341', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  eyebrow: { color: '#F5C341', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#FFF8E8', fontSize: 31, lineHeight: 36, fontWeight: '900' },
  subtitle: { color: '#A2AFA7', fontSize: 14, lineHeight: 20 },
  muted: { color: '#8C9A92', fontSize: 12, lineHeight: 17 },
  error: { color: '#FFB4A9', backgroundColor: '#2A1716', borderRadius: 12, padding: 11, fontSize: 12, lineHeight: 17 },
  guardCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 16, borderWidth: 1, borderColor: '#415039', backgroundColor: '#192018', padding: 13 },
  guardCopy: { flex: 1, gap: 2 },
  guardTitle: { color: '#F6F1DE', fontSize: 13, fontWeight: '900' },
  searchCard: { borderRadius: 20, borderWidth: 1, borderColor: '#2C3B33', backgroundColor: '#151F1A', padding: 14, gap: 12 },
  searchHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionEyebrow: { color: '#67CFC8', fontSize: 9.5, fontWeight: '900', letterSpacing: 1 },
  sectionTitle: { color: '#FFF8E8', fontSize: 20, fontWeight: '900', marginTop: 2 },
  changeMember: { color: '#F5C341', fontSize: 13, fontWeight: '900' },
  selfButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 13, backgroundColor: '#F5C341' },
  selfButtonText: { color: '#111A17', fontSize: 14, fontWeight: '900' },
  searchInputWrap: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, borderWidth: 1, borderColor: '#34443B', backgroundColor: '#0F1713', paddingHorizontal: 12 },
  searchInput: { flex: 1, minHeight: 46, color: '#F6F7F2', fontSize: 14 },
  memberList: { gap: 8 },
  memberRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 15, borderWidth: 1, borderColor: '#25352D', backgroundColor: '#111A16', paddingHorizontal: 11, paddingVertical: 9 },
  avatar: { backgroundColor: '#25352D', borderWidth: 1, borderColor: '#617267', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: '#FFF8E8', fontWeight: '900', fontSize: 14 },
  memberCopy: { flex: 1, minWidth: 0, gap: 2 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  memberName: { color: '#F7F8F3', fontSize: 14.5, fontWeight: '900', flexShrink: 1 },
  memberMeta: { color: '#7F8D85', fontSize: 11.5 },
  memberStats: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 3 },
  statPill: { color: '#F5C341', fontSize: 9.5, fontWeight: '900', borderRadius: 999, borderWidth: 1, borderColor: '#66542A', backgroundColor: '#2A2417', paddingHorizontal: 7, paddingVertical: 3 },
  statText: { color: '#8E9C94', fontSize: 10.5, fontWeight: '700' },
  youPill: { color: '#111A17', backgroundColor: '#67CFC8', borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2, fontSize: 8, fontWeight: '900' },
  empty: { color: '#7D8A83', textAlign: 'center', paddingVertical: 20, fontSize: 13 },
  selectedCard: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 16, backgroundColor: '#101814', padding: 12 },
  selectedCopy: { flex: 1, minWidth: 0 },
  selectedName: { color: '#FFF8E8', fontSize: 19, fontWeight: '900', flexShrink: 1 },
  founderMini: { color: '#F5C341', fontSize: 8, fontWeight: '900', letterSpacing: .7, borderRadius: 999, borderWidth: 1, borderColor: '#6C5728', paddingHorizontal: 6, paddingVertical: 3 },
  selectedStats: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 7 },
  tabs: { flexDirection: 'row', gap: 6, borderRadius: 15, backgroundColor: '#101814', padding: 5 },
  tab: { flex: 1, minHeight: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: '#26372E' },
  tabText: { color: '#7F8D85', fontSize: 12, fontWeight: '900' },
  tabTextActive: { color: '#F5C341' },
  panel: { borderRadius: 20, borderWidth: 1, borderColor: '#293A31', backgroundColor: '#151F1A', padding: 14, gap: 13 },
  panelHeader: { gap: 3 },
  panelTitle: { color: '#FFF8E8', fontSize: 20, fontWeight: '900' },
  panelBody: { color: '#8F9D95', fontSize: 12.5, lineHeight: 18 },
  rankHero: { flexDirection: 'row', alignItems: 'center', gap: 15, borderRadius: 18, backgroundColor: '#101814', padding: 13 },
  rankHeroCopy: { flex: 1, gap: 3 },
  rankName: { color: '#FFF8E8', fontSize: 25, fontWeight: '900' },
  gold: { color: '#F5C341', fontWeight: '900' },
  overrideCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, borderColor: '#6C5728', backgroundColor: '#262014', padding: 11 },
  overrideCopy: { flex: 1 },
  overrideTitle: { color: '#F5C341', fontSize: 12, fontWeight: '900' },
  overrideReason: { color: '#B6A984', fontSize: 11.5, marginTop: 2 },
  useCalculated: { borderRadius: 10, borderWidth: 1, borderColor: '#8D7133', paddingHorizontal: 11, paddingVertical: 8 },
  useCalculatedText: { color: '#F5C341', fontSize: 11, fontWeight: '900' },
  rankGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rankChoice: { width: '48.5%', minHeight: 132, borderRadius: 16, borderWidth: 1, borderColor: '#2B3A32', backgroundColor: '#101814', alignItems: 'center', justifyContent: 'center', padding: 9 },
  rankChoiceCurrent: { borderColor: '#F5C341', backgroundColor: '#202219' },
  rankChoiceName: { color: '#CDD6D1', fontSize: 12.5, fontWeight: '900', textAlign: 'center', marginTop: 2 },
  rankChoiceNameCurrent: { color: '#FFF8E8' },
  rankChoiceMeta: { color: '#75827B', fontSize: 9.5, marginTop: 2 },
  calculatedPill: { color: '#111A17', backgroundColor: '#67CFC8', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, fontSize: 7.5, fontWeight: '900', marginTop: 6 },
  overridePill: { color: '#F5C341', borderRadius: 999, borderWidth: 1, borderColor: '#6C5728', paddingHorizontal: 7, paddingVertical: 3, fontSize: 7.5, fontWeight: '900', marginTop: 6 },
  collectionSearch: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: '#304139', backgroundColor: '#0F1713', paddingHorizontal: 11 },
  collectionSearchInput: { flex: 1, color: '#F6F7F2', minHeight: 42, fontSize: 13 },
  filterRow: { flexDirection: 'row', gap: 7 },
  filterChip: { minHeight: 36, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: '#34443B', paddingHorizontal: 12 },
  filterChipActive: { backgroundColor: '#26372E', borderColor: '#5D7669' },
  filterText: { color: '#829087', fontSize: 10.5, fontWeight: '900' },
  filterTextActive: { color: '#F5C341' },
  collectionList: { gap: 8 },
  collectionRowWrap: { borderRadius: 16, borderWidth: 1, borderColor: '#26362E', backgroundColor: '#101814', overflow: 'hidden' },
  collectionRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, borderColor: '#26362E', backgroundColor: '#101814', padding: 10 },
  collectionRowWrap: { borderRadius: 16, borderWidth: 1, borderColor: '#26362E', backgroundColor: '#101814', overflow: 'hidden' },
  artShell: { width: 66, height: 66, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  fallbackArt: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: '#D7B45A', backgroundColor: '#25352D', alignItems: 'center', justifyContent: 'center' },
  fallbackArtText: { color: '#F5C341', fontSize: 13, fontWeight: '900' },
  collectionCopy: { flex: 1, minWidth: 0 },
  collectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  collectionTitle: { flex: 1, color: '#F6F7F2', fontSize: 13.5, fontWeight: '900' },
  collectionMeta: { color: '#67CFC8', fontSize: 9.5, fontWeight: '800', marginTop: 2, textTransform: 'uppercase' },
  collectionDescription: { color: '#7F8D85', fontSize: 10.5, lineHeight: 15, marginTop: 3 },
  earnedPill: { color: '#111A17', backgroundColor: '#67CFC8', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 3, fontSize: 7.5, fontWeight: '900' },
  manualLabel: { color: '#F5C341', fontSize: 9.5, fontWeight: '800', marginTop: 4 },
  smallAction: { minWidth: 58, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#F5C341', paddingHorizontal: 9 },
  smallActionText: { color: '#111A17', fontSize: 10.5, fontWeight: '900' },
  removeAction: { backgroundColor: '#2A1716', borderWidth: 1, borderColor: '#6A413C' },
  removeActionText: { color: '#FFB4A9' },
  acquisitions: { borderTopWidth: 1, borderTopColor: '#26362E', paddingHorizontal: 10, paddingBottom: 8 },
  acquisitionRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#1D2B24', paddingVertical: 7 },
  acquisitionCopy: { flex: 1 },
  acquisitionTitle: { color: '#CAD4CF', fontSize: 11, fontWeight: '800' },
  acquisitionMeta: { color: '#74827A', fontSize: 9.5, marginTop: 2 },
  historyRow: { minHeight: 66, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderTopWidth: 1, borderTopColor: '#26362E', paddingTop: 11 },
  historyDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#F5C341', marginTop: 5 },
  historyCopy: { flex: 1 },
  historyTitle: { color: '#F6F7F2', fontSize: 12.5, fontWeight: '900' },
  historyReason: { color: '#95A39B', fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  historyDate: { color: '#68766E', fontSize: 9.5, marginTop: 4 },
  modalShade: { flex: 1, backgroundColor: 'rgba(2,7,4,0.72)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: '#3A4A41', backgroundColor: '#17211C', padding: 18, paddingBottom: 30, gap: 10 },
  modalHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#506058', marginBottom: 4 },
  modalTitle: { color: '#FFF8E8', fontSize: 23, fontWeight: '900' },
  modalBody: { color: '#91A097', fontSize: 12.5, lineHeight: 18 },
  reasonInput: { minHeight: 86, borderRadius: 13, borderWidth: 1, borderColor: '#3A4A41', backgroundColor: '#0F1713', color: '#F6F7F2', padding: 12, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 9, marginTop: 2 },
  cancelButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#43534A' },
  cancelText: { color: '#C1CCC6', fontSize: 13, fontWeight: '900' },
  confirmButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#F5C341' },
  confirmText: { color: '#111A17', fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.45 },
});
