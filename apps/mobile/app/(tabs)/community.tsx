import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getGroups, joinGroup, type CommunityGroup } from '../../src/community/api';

function kindLabel(kind: CommunityGroup['kind']) {
  if (kind === 'adventure') return 'ADVENTURE GROUP';
  if (kind === 'local') return 'LOCAL GROUP';
  return 'INTEREST GROUP';
}

export default function GroupsScreen() {
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setGroups(await getGroups());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load your groups.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const myGroups = useMemo(() => groups.filter((group) => group.is_member), [groups]);
  const suggested = useMemo(() => groups.filter((group) => !group.is_member && group.visibility === 'public'), [groups]);

  async function handleJoin(group: CommunityGroup) {
    setJoiningId(group.id);
    try {
      await joinGroup(group.id);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to join this group.');
    } finally {
      setJoiningId(null);
    }
  }

  const sections: Array<{ key: string; title: string; subtitle: string; data: CommunityGroup[] }> = [
    {
      key: 'mine',
      title: 'Your Groups',
      subtitle: 'Adventure groups appear automatically after a confirmed registration.',
      data: myGroups,
    },
    {
      key: 'suggested',
      title: 'Suggested Groups',
      subtitle: 'Join local and interest spaces when you want a little more campfire.',
      data: suggested,
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={sections}
        keyExtractor={(section) => section.key}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor="#D7B45A" />}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>AROUND THE CAMPFIRE</Text>
            <Text style={styles.title}>Groups</Text>
            <Text style={styles.intro}>Connect around the adventures, places, and outdoor interests you actually share.</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {loading ? <ActivityIndicator color="#D7B45A" /> : null}
          </View>
        }
        renderItem={({ item: section }) => (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
            {section.data.length ? section.data.map((group) => (
              <Pressable
                key={group.id}
                style={styles.card}
                onPress={() => group.is_member
                  ? router.push({ pathname: '/groups/[id]', params: { id: group.id } })
                  : void handleJoin(group)}
              >
                <View style={styles.cardTopRow}>
                  <Text style={styles.kind}>{kindLabel(group.kind)}</Text>
                  <Text style={styles.memberCount}>{group.member_count} member{group.member_count === 1 ? '' : 's'}</Text>
                </View>
                <Text style={styles.cardTitle}>{group.name}</Text>
                {group.city && group.state ? <Text style={styles.meta}>{group.city}, {group.state}</Text> : null}
                {group.description ? <Text style={styles.description} numberOfLines={3}>{group.description}</Text> : null}
                <Text style={styles.action}>
                  {group.is_member ? 'Open group →' : joiningId === group.id ? 'Joining…' : 'Join group'}
                </Text>
              </Pressable>
            )) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>{section.key === 'mine' ? 'No groups yet' : 'Nothing suggested yet'}</Text>
                <Text style={styles.emptyBody}>
                  {section.key === 'mine'
                    ? 'Your confirmed adventures will create private trip groups here.'
                    : 'Local and interest groups will appear here as they open.'}
                </Text>
              </View>
            )}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F1713' },
  content: { padding: 18, paddingBottom: 42, gap: 22 },
  header: { gap: 9, marginBottom: 8 },
  eyebrow: { color: '#D7B45A', fontWeight: '900', letterSpacing: 1.1, fontSize: 12 },
  title: { color: '#FFF8E8', fontSize: 36, lineHeight: 40, fontWeight: '900' },
  intro: { color: '#C6CEC8', fontSize: 16, lineHeight: 23, maxWidth: 520 },
  error: { color: '#FFB4A9', marginTop: 5 },
  section: { gap: 10 },
  sectionTitle: { color: '#FFF8E8', fontSize: 23, fontWeight: '900' },
  sectionSubtitle: { color: '#8F9B93', lineHeight: 20, marginBottom: 2 },
  card: { backgroundColor: '#17211C', borderWidth: 1, borderColor: '#28362E', borderRadius: 20, padding: 17, gap: 7 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  kind: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  memberCount: { color: '#859188', fontSize: 12 },
  cardTitle: { color: '#FFF8E8', fontSize: 21, lineHeight: 25, fontWeight: '900' },
  meta: { color: '#AEB8B2', fontSize: 13 },
  description: { color: '#CDD4CF', lineHeight: 21, marginTop: 3 },
  action: { color: '#D7B45A', fontWeight: '900', marginTop: 6 },
  emptyCard: { backgroundColor: '#141E19', borderRadius: 18, padding: 17, gap: 5 },
  emptyTitle: { color: '#FFF8E8', fontWeight: '900', fontSize: 17 },
  emptyBody: { color: '#8F9B93', lineHeight: 20 },
});
