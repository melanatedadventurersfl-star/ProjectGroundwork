import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getGroups, joinGroup, type CommunityGroup } from '../../src/community/api';
import { getMemberBasecamp } from '../../src/member/api';

function kindLabel(kind: CommunityGroup['kind']) {
  if (kind === 'adventure') return 'ADVENTURE GROUP';
  if (kind === 'local') return 'LOCAL EVENT GROUP';
  return 'INTEREST GROUP';
}

function GroupCard({ group, joining, onJoin }: { group: CommunityGroup; joining: boolean; onJoin: (group: CommunityGroup) => void }) {
  return (
    <Pressable
      style={styles.card}
      onPress={() => group.is_member ? router.push({ pathname: '/groups/[id]', params: { id: group.id } }) : onJoin(group)}
    >
      <View style={styles.cardTopRow}>
        <Text style={styles.kind}>{kindLabel(group.kind)}</Text>
        <Text style={styles.memberCount}>{group.member_count} member{group.member_count === 1 ? '' : 's'}</Text>
      </View>
      <Text style={styles.cardTitle}>{group.name}</Text>
      {group.city && group.state ? <Text style={styles.meta}>{group.city}, {group.state}</Text> : null}
      {group.description ? <Text style={styles.description} numberOfLines={3}>{group.description}</Text> : null}
      <Text style={styles.action}>{group.is_member ? 'Open group →' : joining ? 'Joining…' : 'Join group'}</Text>
    </Pressable>
  );
}

export default function GroupsScreen() {
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [homeCity, setHomeCity] = useState<string | null>(null);
  const [homeState, setHomeState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [nextGroups, basecamp] = await Promise.all([getGroups(), getMemberBasecamp()]);
      setGroups(nextGroups);
      setHomeCity(basecamp.profile?.home_city ?? null);
      setHomeState(basecamp.profile?.home_state ?? null);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load Groups.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const yourGroups = useMemo(() => groups.filter((group) => group.is_member), [groups]);
  const adventureGroups = useMemo(() => groups.filter((group) => group.kind === 'adventure'), [groups]);
  const localGroups = useMemo(() => groups.filter((group) => group.kind === 'local'), [groups]);
  const interestGroups = useMemo(() => groups.filter((group) => group.kind === 'interest'), [groups]);
  const nearYou = useMemo(() => groups.filter((group) => !group.is_member && group.state && group.state === homeState && (!homeCity || !group.city || group.city === homeCity)), [groups, homeCity, homeState]);

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

  const shelves = [
    { key: 'yours', title: 'Your Groups', subtitle: 'Your adventure, local-event, and interest spaces.', data: yourGroups },
    { key: 'adventure', title: 'Adventure Groups', subtitle: 'Trip coordination for official MA Adventures.', data: adventureGroups },
    { key: 'near', title: 'Near You', subtitle: homeCity && homeState ? `Communities around ${homeCity}, ${homeState}.` : 'Set your profile city to improve local discovery.', data: nearYou },
    { key: 'interest', title: 'For Your Interests', subtitle: 'Ongoing communities built around the outdoors you enjoy.', data: interestGroups },
    { key: 'local', title: 'Local Event Groups', subtitle: 'Member-hosted meetups and their conversation spaces.', data: localGroups },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={shelves}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor="#D7B45A" />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>YOUR COMMUNITY CLUBHOUSE</Text>
            <Text style={styles.title}>Groups</Text>
            <Text style={styles.intro}>Belong first, scroll second. Groups are organized around shared adventures, local events, and interests rather than one giant feed.</Text>
            <View style={styles.guideCard}>
              <Text style={styles.guideTitle}>How Groups work</Text>
              <Text style={styles.guideBody}>Adventure Groups unlock with confirmed trips. Local Event Groups support meetups. Interest Groups stay open for ongoing conversation.</Text>
            </View>
            {loading ? <ActivityIndicator color="#D7B45A" /> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{item.title}</Text>
            <Text style={styles.sectionSubtitle}>{item.subtitle}</Text>
            {item.data.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>
                {item.data.map((group) => <GroupCard key={`${item.key}-${group.id}`} group={group} joining={joiningId === group.id} onJoin={(next) => void handleJoin(next)} />)}
              </ScrollView>
            ) : (
              <View style={styles.emptyCard}><Text style={styles.emptyBody}>Nothing here yet. This shelf will fill as your community activity grows.</Text></View>
            )}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:{flex:1,backgroundColor:'#0F1713'},content:{padding:18,paddingBottom:44,gap:24},header:{gap:10,marginBottom:4},eyebrow:{color:'#D7B45A',fontWeight:'900',letterSpacing:1.1,fontSize:11},title:{color:'#FFF8E8',fontSize:36,fontWeight:'900'},intro:{color:'#C6CEC8',fontSize:16,lineHeight:23},guideCard:{backgroundColor:'#1B2A22',borderWidth:1,borderColor:'#33483B',borderRadius:18,padding:16,marginTop:4},guideTitle:{color:'#FFF8E8',fontSize:18,fontWeight:'900'},guideBody:{color:'#AEB8B2',lineHeight:20,marginTop:6},error:{color:'#FFB4A9'},section:{gap:8},sectionTitle:{color:'#FFF8E8',fontSize:23,fontWeight:'900'},sectionSubtitle:{color:'#8F9B93',lineHeight:19},shelf:{gap:11,paddingVertical:3,paddingRight:18},card:{width:285,backgroundColor:'#17211C',borderWidth:1,borderColor:'#28362E',borderRadius:20,padding:17,gap:7},cardTopRow:{flexDirection:'row',justifyContent:'space-between',gap:10},kind:{color:'#D7B45A',fontSize:10,fontWeight:'900',letterSpacing:.8},memberCount:{color:'#859188',fontSize:11},cardTitle:{color:'#FFF8E8',fontSize:20,fontWeight:'900'},meta:{color:'#AEB8B2',fontSize:13},description:{color:'#CDD4CF',lineHeight:20},action:{color:'#D7B45A',fontWeight:'900',marginTop:5},emptyCard:{backgroundColor:'#141E19',borderRadius:16,padding:15},emptyBody:{color:'#8F9B93',lineHeight:20}
});
