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
import { RankEmblem, rankLadder, type RankName } from '../../src/passport/RankEmblem';
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
  title: string;
  description: string | null;
  category: string | null;
  earned: boolean;
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
  title: string;
  description: string | null;
  category: string | null;
  earned_count: number;
  acquisitions: StampAcquisition[];
};

type AuditRow = {
  id: string;
  action: string;
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
  };
  badges: BadgeRow[];
  stamps: StampRow[];
  history: AuditRow[];
};

type TabName = 'rank' | 'badges' | 'stamps' | 'history';
type CollectionFilter = 'all' | 'earned' | 'available';
type PendingAction =
  | { kind: 'set-rank'; rank: RankName; title: string; defaultReason: string }
  | { kind: 'clear-rank'; title: string; defaultReason: string }
  | { kind: 'grant-badge'; badgeId: string; title: string; defaultReason: string }
  | { kind: 'revoke-badge'; badgeId: string; title: string; defaultReason: string }
  | { kind: 'grant-stamp'; stampId: string; title: string; defaultReason: string }
  | { kind: 'revoke-stamp'; memberStampId: string; title: string; defaultReason: string };

const tabOptions: { key: TabName; label: string }[] = [
  { key: 'rank', label: 'Rank' },
  { key: 'badges', label: 'Badges' },
  { key: 'stamps', label: 'Stamps' },
  { key: 'history', label: 'History' },
];

function displayName(member: { display_name: string | null; username: string | null; email: string | null }) {
  return member.display_name?.trim() || member.username?.trim() || member.email?.split('@')[0] || 'Member';
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : parts[0]?.[1] ?? '';
  return `${first}${second}`.toUpperCase() || 'MA';
}

function actionLabel(value: string) {
  const labels: Record<string, string> = {
    rank_override_set: 'Rank override changed',
    rank_override_cleared: 'Returned to calculated rank',
    badge_granted: 'Badge granted',
    badge_revoked: 'Badge removed',
    stamp_granted: 'Stamp granted',
    stamp_revoked: 'Stamp removed',
  };
  return labels[value] ?? value.split('_').join(' ');
}

export default function CreatorPassportScreen() {
  const { session } = useAuth();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [memberQuery, setMemberQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recognition, setRecognition] = useState<Recognition | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [tab, setTab] = useState<TabName>('rank');
  const [collectionQuery, setCollectionQuery] = useState('');
  const [collectionFilter, setCollectionFilter] = useState<CollectionFilter>('all');
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
      setError('');
      setMembers((data ?? []) as MemberSummary[]);
    }
    setSearching(false);
  }, []);

  const loadRecognition = useCallback(async (profileId: string) => {
    setLoadingDetail(true);
    const { data, error: detailError } = await supabase.rpc('creator_get_passport_recognition', {
      p_profile_id: profileId,
    });
    if (detailError) {
      setRecognition(null);
      setError(detailError.message);
    } else {
      setRecognition(data as Recognition);
      setError('');
    }
    setLoadingDetail(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void loadMembers(memberQuery); }, 220);
    return () => clearTimeout(timer);
  }, [loadMembers, memberQuery]);

  useEffect(() => {
    if (selectedId) void loadRecognition(selectedId);
  }, [loadRecognition, selectedId]);

  const badges = useMemo(() => {
    const query = collectionQuery.trim().toLowerCase();
    return (recognition?.badges ?? []).filter((badge) => {
      const textMatch = !query || `${badge.title} ${badge.category ?? ''} ${badge.description ?? ''}`.toLowerCase().includes(query);
      const filterMatch = collectionFilter === 'all' || (collectionFilter === 'earned' ? badge.earned : !badge.earned);
      return textMatch && filterMatch;
    });
  }, [collectionFilter, collectionQuery, recognition?.badges]);

  const stamps = useMemo(() => {
    const query = collectionQuery.trim().toLowerCase();
    return (recognition?.stamps ?? []).filter((stamp) => {
      const earned = stamp.earned_count > 0;
      const textMatch = !query || `${stamp.title} ${stamp.category ?? ''} ${stamp.description ?? ''}`.toLowerCase().includes(query);
      const filterMatch = collectionFilter === 'all' || (collectionFilter === 'earned' ? earned : !earned);
      return textMatch && filterMatch;
    });
  }, [collectionFilter, collectionQuery, recognition?.stamps]);

  function chooseMember(profileId: string) {
    setSelectedId(profileId);
    setTab('rank');
    setCollectionQuery('');
    setCollectionFilter('all');
  }

  function changeMember() {
    setSelectedId(null);
    setRecognition(null);
    setTab('rank');
    setCollectionQuery('');
    setCollectionFilter('all');
  }

  function openAction(action: PendingAction) {
    setPendingAction(action);
    setReason(action.defaultReason);
  }

  async function confirmAction() {
    if (!recognition || !pendingAction || saving || reason.trim().length < 2) return;
    setSaving(true);
    setError('');
    try {
      const profileId = recognition.member.profile_id;
      let mutationError: { message: string } | null = null;

      if (pendingAction.kind === 'set-rank') {
        ({ error: mutationError } = await supabase.rpc('creator_set_rank_override', {
          p_profile_id: profileId,
          p_rank_name: pendingAction.rank,
          p_reason: reason.trim(),
        }));
      } else if (pendingAction.kind === 'clear-rank') {
        ({ error: mutationError } = await supabase.rpc('creator_clear_rank_override', {
          p_profile_id: profileId,
          p_reason: reason.trim(),
        }));
      } else if (pendingAction.kind === 'grant-badge') {
        ({ error: mutationError } = await supabase.rpc('creator_grant_badge', {
          p_profile_id: profileId,
          p_badge_id: pendingAction.badgeId,
          p_reason: reason.trim(),
        }));
      } else if (pendingAction.kind === 'revoke-badge') {
        ({ error: mutationError } = await supabase.rpc('creator_revoke_badge', {
          p_profile_id: profileId,
          p_badge_id: pendingAction.badgeId,
          p_reason: reason.trim(),
        }));
      } else if (pendingAction.kind === 'grant-stamp') {
        ({ error: mutationError } = await supabase.rpc('creator_grant_stamp', {
          p_profile_id: profileId,
          p_stamp_id: pendingAction.stampId,
          p_reason: reason.trim(),
        }));
      } else {
        ({ error: mutationError } = await supabase.rpc('creator_revoke_stamp', {
          p_profile_id: profileId,
          p_member_stamp_id: pendingAction.memberStampId,
          p_reason: reason.trim(),
        }));
      }

      if (mutationError) throw new Error(mutationError.message);
      setPendingAction(null);
      setReason('');
      await Promise.all([loadRecognition(profileId), loadMembers(memberQuery)]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save that Passport change.');
    } finally {
      setSaving(false);
    }
  }

  if (authorized === null) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#F5C341" size="large" /><Text style={styles.muted}>Opening Passport controls…</Text></View></SafeAreaView>;
  }

  if (!authorized) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.denied}>
          <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
          <View style={styles.deniedCard}>
            <Text style={styles.eyebrow}>FOUNDER ONLY</Text>
            <Text style={styles.title}>Passport control is protected</Text>
            <Text style={styles.muted}>Only the private Master/Founder account can change member ranks, badges, and stamps.</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.back}>‹ Creator Console</Text></Pressable>

        <View style={styles.hero}>
          <View style={styles.founderPill}><Text style={styles.founderPillText}>FOUNDER CONTROL</Text></View>
          <Text style={styles.title}>Passport & Recognition</Text>
          <Text style={styles.subtitle}>Search a member, choose what you want to change, confirm it, and keep moving.</Text>
        </View>

        <View style={styles.auditNote}>
          <AppIcon name="badge" color="#F5C341" size={20} />
          <View style={styles.flex}><Text style={styles.auditTitle}>Safe manual controls</Text><Text style={styles.muted}>Ranks use reversible overrides. Badge and stamp changes are audit logged with a reason.</Text></View>
        </View>

        {!recognition ? (
          <View style={styles.card}>
            <View><Text style={styles.eyebrowTeal}>MEMBER</Text><Text style={styles.sectionTitle}>Choose a Passport</Text></View>
            <Pressable style={styles.myPassportButton} onPress={() => session?.user.id && chooseMember(session.user.id)}>
              <AppIcon name="profile" color="#111A17" size={19} />
              <Text style={styles.myPassportText}>Manage My Passport</Text>
            </Pressable>
            <View style={styles.searchBox}>
              <AppIcon name="search" color="#7E8C84" size={18} />
              <TextInput
                value={memberQuery}
                onChangeText={setMemberQuery}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Search name, username, or email"
                placeholderTextColor="#6C7972"
                style={styles.searchInput}
              />
              {searching ? <ActivityIndicator size="small" color="#D7B45A" /> : null}
            </View>
            <View style={styles.memberList}>
              {members.map((member) => {
                const name = displayName(member);
                return (
                  <Pressable key={member.profile_id} style={styles.memberRow} onPress={() => chooseMember(member.profile_id)}>
                    <Avatar uri={member.avatar_url} name={name} size={46} />
                    <View style={styles.memberCopy}>
                      <View style={styles.inline}><Text style={styles.memberName} numberOfLines={1}>{name}</Text>{member.profile_id === session?.user.id ? <Text style={styles.youPill}>YOU</Text> : null}</View>
                      <Text style={styles.memberMeta} numberOfLines={1}>{member.username ? `@${member.username}` : member.email ?? 'Member'}</Text>
                      <View style={styles.statsRow}><Text style={styles.rankPill}>{member.effective_rank}</Text><Text style={styles.statText}>{member.badge_count} badges</Text><Text style={styles.statText}>{member.stamp_count} stamps</Text></View>
                    </View>
                    <AppIcon name="chevron-forward" color="#D7B45A" size={20} />
                  </Pressable>
                );
              })}
              {!searching && !members.length ? <Text style={styles.empty}>No matching members.</Text> : null}
            </View>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.headingRow}><View><Text style={styles.eyebrowTeal}>MANAGING PASSPORT</Text><Text style={styles.sectionTitle}>{displayName(recognition.member)}</Text></View><Pressable onPress={changeMember}><Text style={styles.change}>Change</Text></Pressable></View>
              <View style={styles.selectedMember}>
                <Avatar uri={recognition.member.avatar_url} name={displayName(recognition.member)} size={58} />
                <View style={styles.memberCopy}>
                  <Text style={styles.memberMeta}>{recognition.member.username ? `@${recognition.member.username}` : recognition.member.email ?? 'Member'}</Text>
                  <View style={styles.statsRow}><Text style={styles.rankPill}>{recognition.rank.effective_rank}</Text><Text style={styles.statText}>{recognition.badges.filter((item) => item.earned).length} badges</Text><Text style={styles.statText}>{recognition.stamps.reduce((sum, item) => sum + item.earned_count, 0)} stamps</Text></View>
                </View>
                <RankEmblem rank={recognition.rank.effective_rank} size={62} />
              </View>
            </View>

            {loadingDetail ? <ActivityIndicator color="#F5C341" style={styles.loader} /> : (
              <>
                <View style={styles.tabs}>
                  {tabOptions.map((option) => (
                    <Pressable key={option.key} onPress={() => { setTab(option.key); setCollectionQuery(''); setCollectionFilter('all'); }} style={[styles.tab, tab === option.key && styles.tabActive]}>
                      <Text style={[styles.tabText, tab === option.key && styles.tabTextActive]}>{option.label}</Text>
                    </Pressable>
                  ))}
                </View>

                {tab === 'rank' ? <RankSection recognition={recognition} onAction={openAction} /> : null}

                {tab === 'badges' ? (
                  <CollectionSection title="Badges" query={collectionQuery} setQuery={setCollectionQuery} filter={collectionFilter} setFilter={setCollectionFilter}>
                    {badges.map((badge) => (
                      <View key={badge.badge_id} style={styles.collectionRow}>
                        <View style={styles.collectionIcon}><AppIcon name="badge" color={badge.earned ? '#67CFC8' : '#738078'} size={23} /></View>
                        <View style={styles.collectionCopy}>
                          <View style={styles.inline}><Text style={styles.collectionTitle}>{badge.title}</Text>{badge.earned ? <Text style={styles.earnedPill}>EARNED</Text> : null}</View>
                          <Text style={styles.collectionMeta}>{badge.category || 'milestone'}{badge.earned_at ? ` · ${new Date(badge.earned_at).toLocaleDateString()}` : ''}</Text>
                          {badge.description ? <Text style={styles.collectionDescription} numberOfLines={2}>{badge.description}</Text> : null}
                          {badge.earned && badge.evidence?.source === 'founder_manual' ? <Text style={styles.manualText}>Founder awarded</Text> : null}
                        </View>
                        <Pressable
                          style={[styles.actionButton, badge.earned && styles.removeButton]}
                          onPress={() => openAction(badge.earned
                            ? { kind: 'revoke-badge', badgeId: badge.badge_id, title: `Remove ${badge.title}?`, defaultReason: 'Founder manual badge removal' }
                            : { kind: 'grant-badge', badgeId: badge.badge_id, title: `Grant ${badge.title}?`, defaultReason: 'Founder manual badge grant' })}
                        >
                          <Text style={[styles.actionText, badge.earned && styles.removeText]}>{badge.earned ? 'Remove' : 'Grant'}</Text>
                        </Pressable>
                      </View>
                    ))}
                    {!badges.length ? <Text style={styles.empty}>No badges match this filter.</Text> : null}
                  </CollectionSection>
                ) : null}

                {tab === 'stamps' ? (
                  <CollectionSection title="Stamps" query={collectionQuery} setQuery={setCollectionQuery} filter={collectionFilter} setFilter={setCollectionFilter}>
                    {stamps.map((stamp) => (
                      <View key={stamp.stamp_id} style={styles.collectionGroup}>
                        <View style={styles.collectionRowPlain}>
                          <View style={styles.collectionIcon}><AppIcon name="stamp" color={stamp.earned_count ? '#67CFC8' : '#738078'} size={23} /></View>
                          <View style={styles.collectionCopy}>
                            <View style={styles.inline}><Text style={styles.collectionTitle}>{stamp.title}</Text>{stamp.earned_count > 0 ? <Text style={styles.earnedPill}>{stamp.earned_count > 1 ? `${stamp.earned_count}×` : 'EARNED'}</Text> : null}</View>
                            <Text style={styles.collectionMeta}>{stamp.category || 'passport'}</Text>
                            {stamp.description ? <Text style={styles.collectionDescription} numberOfLines={2}>{stamp.description}</Text> : null}
                          </View>
                          {!stamp.earned_count ? (
                            <Pressable style={styles.actionButton} onPress={() => openAction({ kind: 'grant-stamp', stampId: stamp.stamp_id, title: `Grant ${stamp.title}?`, defaultReason: 'Founder manual stamp grant' })}>
                              <Text style={styles.actionText}>Grant</Text>
                            </Pressable>
                          ) : null}
                        </View>
                        {stamp.acquisitions.map((acquisition) => (
                          <View key={acquisition.member_stamp_id} style={styles.acquisitionRow}>
                            <View style={styles.flex}><Text style={styles.acquisitionTitle}>Earned {new Date(acquisition.earned_at).toLocaleDateString()}</Text><Text style={styles.acquisitionMeta}>{acquisition.evidence?.source === 'founder_manual' ? 'Founder awarded' : acquisition.adventure_id ? 'Adventure earned' : 'Passport earned'}</Text></View>
                            <Pressable style={[styles.actionButton, styles.removeButton]} onPress={() => openAction({ kind: 'revoke-stamp', memberStampId: acquisition.member_stamp_id, title: `Remove ${stamp.title}?`, defaultReason: 'Founder manual stamp removal' })}><Text style={[styles.actionText, styles.removeText]}>Remove</Text></Pressable>
                          </View>
                        ))}
                      </View>
                    ))}
                    {!stamps.length ? <Text style={styles.empty}>No stamps match this filter.</Text> : null}
                  </CollectionSection>
                ) : null}

                {tab === 'history' ? (
                  <View style={styles.card}>
                    <View><Text style={styles.eyebrowTeal}>AUDIT TRAIL</Text><Text style={styles.sectionTitle}>Founder changes</Text><Text style={styles.body}>Only manual Founder actions appear here. Automatically earned recognition stays separate.</Text></View>
                    {recognition.history.length ? recognition.history.map((item) => (
                      <View key={item.id} style={styles.historyRow}>
                        <View style={styles.historyDot} />
                        <View style={styles.flex}><Text style={styles.historyTitle}>{actionLabel(item.action)}</Text><Text style={styles.historyReason}>{item.reason}</Text><Text style={styles.historyDate}>{new Date(item.created_at).toLocaleString()}</Text></View>
                      </View>
                    )) : <Text style={styles.empty}>No manual Passport changes yet.</Text>}
                  </View>
                ) : null}
              </>
            )}
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <ConfirmModal
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
  return <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>{uri ? <Image source={{ uri }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{initials(name)}</Text>}</View>;
}

function RankSection({ recognition, onAction }: { recognition: Recognition; onAction: (action: PendingAction) => void }) {
  const rank = recognition.rank;
  return (
    <View style={styles.card}>
      <View style={styles.rankHero}>
        <RankEmblem rank={rank.effective_rank} size={94} />
        <View style={styles.flex}><Text style={styles.eyebrowTeal}>{rank.rank_override ? 'DISPLAYED RANK · OVERRIDE' : 'DISPLAYED RANK'}</Text><Text style={styles.rankTitle}>{rank.effective_rank}</Text><Text style={styles.body}>Calculated from {rank.completed_adventures} completed adventure{rank.completed_adventures === 1 ? '' : 's'}: <Text style={styles.gold}>{rank.calculated_rank}</Text></Text></View>
      </View>
      {rank.rank_override ? (
        <View style={styles.overrideRow}><View style={styles.flex}><Text style={styles.overrideTitle}>Override active</Text><Text style={styles.overrideReason}>{rank.override_reason || 'Founder override'}</Text></View><Pressable style={styles.resetButton} onPress={() => onAction({ kind: 'clear-rank', title: 'Use calculated rank again?', defaultReason: 'Return to calculated Passport rank' })}><Text style={styles.resetText}>Reset</Text></Pressable></View>
      ) : null}
      <View><Text style={styles.sectionTitle}>Choose displayed rank</Text><Text style={styles.body}>Tap a rank. The member’s completed-adventure history is left untouched.</Text></View>
      <View style={styles.rankGrid}>
        {rankLadder.map(([name, minimum]) => {
          const current = rank.effective_rank === name;
          const calculated = rank.calculated_rank === name;
          return (
            <Pressable key={name} style={[styles.rankChoice, current && styles.rankChoiceActive]} onPress={() => onAction({ kind: 'set-rank', rank: name, title: `Display ${name}?`, defaultReason: recognition.member.platform_role === 'founder' ? 'Founder rank override for testing' : 'Founder manual rank override' })}>
              <RankEmblem rank={name} size={50} />
              <Text style={[styles.rankChoiceName, current && styles.rankChoiceNameActive]}>{name}</Text>
              <Text style={styles.rankChoiceMeta}>{minimum === 0 ? 'Start' : `${minimum}+ adventures`}</Text>
              {calculated ? <Text style={styles.calculatedPill}>CALCULATED</Text> : current ? <Text style={styles.displayedPill}>DISPLAYED</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function CollectionSection({ title, query, setQuery, filter, setFilter, children }: { title: string; query: string; setQuery: (value: string) => void; filter: CollectionFilter; setFilter: (value: CollectionFilter) => void; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <View><Text style={styles.eyebrowTeal}>PASSPORT COLLECTION</Text><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.body}>Earned items stay at the top. Search, filter, then grant or remove.</Text></View>
      <View style={styles.searchBox}><AppIcon name="search" color="#7E8C84" size={17} /><TextInput value={query} onChangeText={setQuery} placeholder={`Search ${title.toLowerCase()}`} placeholderTextColor="#6C7972" style={styles.searchInput} /></View>
      <View style={styles.filters}>{(['all', 'earned', 'available'] as CollectionFilter[]).map((value) => <Pressable key={value} onPress={() => setFilter(value)} style={[styles.filter, filter === value && styles.filterActive]}><Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{value === 'all' ? 'All' : value === 'earned' ? 'Earned' : 'Not earned'}</Text></Pressable>)}</View>
      <View style={styles.collectionList}>{children}</View>
    </View>
  );
}

function ConfirmModal({ action, reason, setReason, saving, onClose, onConfirm }: { action: PendingAction | null; reason: string; setReason: (value: string) => void; saving: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal visible={Boolean(action)} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalShade} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.modalCard}>
          <View style={styles.modalHandle} />
          <Text style={styles.eyebrowTeal}>CONFIRM FOUNDER CHANGE</Text>
          <Text style={styles.modalTitle}>{action?.title ?? 'Confirm change'}</Text>
          <Text style={styles.body}>The reason is saved with the audit entry. The suggested text is editable.</Text>
          <TextInput value={reason} onChangeText={setReason} multiline placeholder="Reason for this change" placeholderTextColor="#68766E" style={styles.reasonInput} />
          <View style={styles.modalActions}><Pressable disabled={saving} style={styles.cancelButton} onPress={onClose}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable disabled={saving || reason.trim().length < 2} style={[styles.confirmButton, (saving || reason.trim().length < 2) && styles.disabled]} onPress={onConfirm}><Text style={styles.confirmText}>{saving ? 'Saving…' : 'Confirm'}</Text></Pressable></View>
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
  deniedCard: { marginTop: 32, padding: 20, gap: 8, borderRadius: 20, borderWidth: 1, borderColor: '#5A3C35', backgroundColor: '#211817' },
  flex: { flex: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  backButton: { alignSelf: 'flex-start', minHeight: 38, justifyContent: 'center' },
  back: { color: '#D7B45A', fontSize: 15, fontWeight: '900' },
  hero: { gap: 5 },
  founderPill: { alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, borderColor: '#8D7133', backgroundColor: '#3A311B', paddingHorizontal: 10, paddingVertical: 5 },
  founderPillText: { color: '#F5C341', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  eyebrow: { color: '#F5C341', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  eyebrowTeal: { color: '#67CFC8', fontSize: 9.5, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#FFF8E8', fontSize: 31, lineHeight: 36, fontWeight: '900' },
  subtitle: { color: '#A2AFA7', fontSize: 14, lineHeight: 20 },
  body: { color: '#8F9D95', fontSize: 12.5, lineHeight: 18 },
  muted: { color: '#8C9A92', fontSize: 12, lineHeight: 17 },
  error: { color: '#FFB4A9', backgroundColor: '#2A1716', borderRadius: 12, padding: 11, fontSize: 12, lineHeight: 17 },
  auditNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 13, borderRadius: 16, borderWidth: 1, borderColor: '#415039', backgroundColor: '#192018' },
  auditTitle: { color: '#F6F1DE', fontSize: 13, fontWeight: '900' },
  card: { gap: 12, padding: 14, borderRadius: 20, borderWidth: 1, borderColor: '#2C3B33', backgroundColor: '#151F1A' },
  sectionTitle: { color: '#FFF8E8', fontSize: 20, fontWeight: '900', marginTop: 2 },
  change: { color: '#F5C341', fontSize: 13, fontWeight: '900' },
  myPassportButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 13, backgroundColor: '#F5C341' },
  myPassportText: { color: '#111A17', fontSize: 14, fontWeight: '900' },
  searchBox: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11, borderRadius: 13, borderWidth: 1, borderColor: '#34443B', backgroundColor: '#0F1713' },
  searchInput: { flex: 1, minHeight: 44, color: '#F6F7F2', fontSize: 13.5 },
  memberList: { gap: 8 },
  memberRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 15, borderWidth: 1, borderColor: '#25352D', backgroundColor: '#111A16' },
  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, borderWidth: 1, borderColor: '#617267', backgroundColor: '#25352D' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: '#FFF8E8', fontSize: 14, fontWeight: '900' },
  memberCopy: { flex: 1, minWidth: 0, gap: 2 },
  memberName: { flexShrink: 1, color: '#F7F8F3', fontSize: 14.5, fontWeight: '900' },
  memberMeta: { color: '#7F8D85', fontSize: 11.5 },
  youPill: { color: '#111A17', backgroundColor: '#67CFC8', borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2, fontSize: 8, fontWeight: '900' },
  statsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  rankPill: { color: '#F5C341', fontSize: 9.5, fontWeight: '900', borderRadius: 999, borderWidth: 1, borderColor: '#66542A', backgroundColor: '#2A2417', paddingHorizontal: 7, paddingVertical: 3 },
  statText: { color: '#8E9C94', fontSize: 10.5, fontWeight: '700' },
  selectedMember: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 15, backgroundColor: '#101814' },
  loader: { marginVertical: 24 },
  tabs: { flexDirection: 'row', gap: 6, padding: 5, borderRadius: 15, backgroundColor: '#101814' },
  tab: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  tabActive: { backgroundColor: '#26372E' },
  tabText: { color: '#7F8D85', fontSize: 12, fontWeight: '900' },
  tabTextActive: { color: '#F5C341' },
  rankHero: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 18, backgroundColor: '#101814' },
  rankTitle: { color: '#FFF8E8', fontSize: 25, fontWeight: '900' },
  gold: { color: '#F5C341', fontWeight: '900' },
  overrideRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 14, borderWidth: 1, borderColor: '#6C5728', backgroundColor: '#262014' },
  overrideTitle: { color: '#F5C341', fontSize: 12, fontWeight: '900' },
  overrideReason: { color: '#B6A984', fontSize: 11.5, marginTop: 2 },
  resetButton: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#8D7133' },
  resetText: { color: '#F5C341', fontSize: 11, fontWeight: '900' },
  rankGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rankChoice: { width: '48.5%', minHeight: 128, alignItems: 'center', justifyContent: 'center', padding: 9, borderRadius: 16, borderWidth: 1, borderColor: '#2B3A32', backgroundColor: '#101814' },
  rankChoiceActive: { borderColor: '#F5C341', backgroundColor: '#202219' },
  rankChoiceName: { color: '#CDD6D1', fontSize: 12.5, fontWeight: '900', textAlign: 'center' },
  rankChoiceNameActive: { color: '#FFF8E8' },
  rankChoiceMeta: { color: '#75827B', fontSize: 9.5, marginTop: 2 },
  calculatedPill: { color: '#111A17', backgroundColor: '#67CFC8', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 3, fontSize: 7.5, fontWeight: '900', marginTop: 5 },
  displayedPill: { color: '#F5C341', borderRadius: 99, borderWidth: 1, borderColor: '#6C5728', paddingHorizontal: 7, paddingVertical: 3, fontSize: 7.5, fontWeight: '900', marginTop: 5 },
  filters: { flexDirection: 'row', gap: 7 },
  filter: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 99, borderWidth: 1, borderColor: '#34443B' },
  filterActive: { backgroundColor: '#26372E', borderColor: '#5D7669' },
  filterText: { color: '#829087', fontSize: 10.5, fontWeight: '900' },
  filterTextActive: { color: '#F5C341' },
  collectionList: { gap: 8 },
  collectionRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 9, padding: 10, borderRadius: 15, borderWidth: 1, borderColor: '#26362E', backgroundColor: '#101814' },
  collectionGroup: { borderRadius: 15, borderWidth: 1, borderColor: '#26362E', backgroundColor: '#101814', overflow: 'hidden' },
  collectionRowPlain: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 9, padding: 10 },
  collectionIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#1B2922', flexShrink: 0 },
  collectionCopy: { flex: 1, minWidth: 0 },
  collectionTitle: { flex: 1, color: '#F6F7F2', fontSize: 13.5, fontWeight: '900' },
  collectionMeta: { color: '#67CFC8', fontSize: 9.5, fontWeight: '800', marginTop: 2, textTransform: 'uppercase' },
  collectionDescription: { color: '#7F8D85', fontSize: 10.5, lineHeight: 15, marginTop: 3 },
  earnedPill: { color: '#111A17', backgroundColor: '#67CFC8', borderRadius: 99, paddingHorizontal: 6, paddingVertical: 3, fontSize: 7.5, fontWeight: '900' },
  manualText: { color: '#F5C341', fontSize: 9.5, fontWeight: '800', marginTop: 3 },
  actionButton: { minWidth: 58, minHeight: 36, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9, borderRadius: 10, backgroundColor: '#F5C341' },
  actionText: { color: '#111A17', fontSize: 10.5, fontWeight: '900' },
  removeButton: { backgroundColor: '#2A1716', borderWidth: 1, borderColor: '#6A413C' },
  removeText: { color: '#FFB4A9' },
  acquisitionRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#26362E' },
  acquisitionTitle: { color: '#CAD4CF', fontSize: 11, fontWeight: '800' },
  acquisitionMeta: { color: '#74827A', fontSize: 9.5, marginTop: 2 },
  historyRow: { minHeight: 62, flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#26362E' },
  historyDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#F5C341', marginTop: 5 },
  historyTitle: { color: '#F6F7F2', fontSize: 12.5, fontWeight: '900' },
  historyReason: { color: '#95A39B', fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  historyDate: { color: '#68766E', fontSize: 9.5, marginTop: 4 },
  empty: { color: '#7D8A83', textAlign: 'center', paddingVertical: 18, fontSize: 13 },
  modalShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,7,4,0.72)' },
  modalCard: { gap: 10, padding: 18, paddingBottom: 30, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: '#3A4A41', backgroundColor: '#17211C' },
  modalHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#506058', marginBottom: 4 },
  modalTitle: { color: '#FFF8E8', fontSize: 23, fontWeight: '900' },
  reasonInput: { minHeight: 86, padding: 12, textAlignVertical: 'top', borderRadius: 13, borderWidth: 1, borderColor: '#3A4A41', backgroundColor: '#0F1713', color: '#F6F7F2' },
  modalActions: { flexDirection: 'row', gap: 9 },
  cancelButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#43534A' },
  cancelText: { color: '#C1CCC6', fontSize: 13, fontWeight: '900' },
  confirmButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#F5C341' },
  confirmText: { color: '#111A17', fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.45 },
});