import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { getConnections, type Connection } from '../../src/community/circles';
import { getJourney } from '../../src/passport/api';
import { AppIcon } from '../../src/ui/AppIcon';
import ProfileScreenBase from './profile-base';

function initials(name?: string | null) {
  return (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'MA';
}

export default function ProfileScreen() {
  const [journeyCount, setJourneyCount] = useState<number | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);

  useEffect(() => {
    let active = true;
    void Promise.allSettled([getJourney(), getConnections()]).then(([journeyResult, connectionResult]) => {
      if (!active) return;
      setJourneyCount(journeyResult.status === 'fulfilled' ? journeyResult.value.length : null);
      setConnections(connectionResult.status === 'fulfilled' ? connectionResult.value : []);
    });

    return () => { active = false; };
  }, []);

  const trailmates = useMemo(() => connections.filter((connection) => connection.status === 'accepted'), [connections]);
  const pending = useMemo(() => connections.filter((connection) => connection.status === 'pending'), [connections]);
  const preview = trailmates.slice(0, 4);

  return (
    <View style={styles.screen}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open Your Trail"
        style={({ pressed }) => [styles.trailBar, pressed && styles.pressed]}
        onPress={() => router.push('/member/journey' as never)}
      >
        <View style={styles.iconWrap}>
          <AppIcon name="trail" color="#17211C" size={19} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>YOUR OUTDOOR LIFE, REMEMBERED</Text>
          <Text style={styles.title}>Your Trail</Text>
          <Text style={styles.detail} numberOfLines={1}>
            {journeyCount === null
              ? 'Follow the story of where you’ve been.'
              : journeyCount > 0
                ? `${journeyCount} adventure${journeyCount === 1 ? '' : 's'} already part of your story.`
                : 'Your first adventure becomes chapter one.'}
          </Text>
        </View>
        <View style={styles.openWrap}>
          <Text style={styles.openText}>Open</Text>
          <AppIcon name="chevron-forward" color="#D7B45A" size={17} />
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open Trail Crew, ${trailmates.length} Trailmates`}
        style={({ pressed }) => [styles.crewBar, pressed && styles.pressed]}
        onPress={() => router.push('/connections' as never)}
      >
        <View style={styles.crewCopy}>
          <Text style={styles.crewEyebrow}>YOUR PEOPLE</Text>
          <Text style={styles.crewTitle}>Trail Crew</Text>
          <Text style={styles.crewDetail}>{trailmates.length} Trailmate{trailmates.length === 1 ? '' : 's'}{pending.length ? ` · ${pending.length} request${pending.length === 1 ? '' : 's'}` : ''}</Text>
        </View>
        <View style={styles.avatarRail}>
          {preview.map((connection, index) => (
            <View key={connection.connection_id} style={[styles.avatarWrap, index > 0 && styles.avatarOverlap]}>
              {connection.avatar_url
                ? <Image source={{ uri: connection.avatar_url }} style={styles.avatarImage} />
                : <Text style={styles.avatarText}>{initials(connection.display_name)}</Text>}
            </View>
          ))}
          {trailmates.length > preview.length ? <View style={[styles.avatarWrap, styles.avatarOverlap, styles.moreAvatar]}><Text style={styles.moreText}>+{trailmates.length - preview.length}</Text></View> : null}
          {!trailmates.length ? <View style={styles.emptyCrewIcon}><AppIcon name="connections" color="#D7B45A" size={18} /></View> : null}
        </View>
        <AppIcon name="chevron-forward" color="#D7B45A" size={18} />
      </Pressable>

      <View style={styles.profile}>
        <ProfileScreenBase />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#09110F' },
  profile: { flex: 1 },
  trailBar: {
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 4,
    minHeight: 76,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#536A59',
    backgroundColor: '#1D2B24',
    paddingHorizontal: 13,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  crewBar: {
    marginHorizontal: 14,
    marginTop: 4,
    marginBottom: 5,
    minHeight: 72,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#33483A',
    backgroundColor: '#132019',
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  crewCopy: { flex: 1, minWidth: 0 },
  crewEyebrow: { color: '#7F9D68', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.9 },
  crewTitle: { color: '#FFF8E8', fontSize: 17, lineHeight: 20, fontWeight: '900', marginTop: 1 },
  crewDetail: { color: '#AEB9B4', fontSize: 11.5, marginTop: 2 },
  avatarRail: { flexDirection: 'row', alignItems: 'center', paddingLeft: 8 },
  avatarWrap: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: '#132019', backgroundColor: '#26342A', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarOverlap: { marginLeft: -9 },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: '#D7B45A', fontSize: 10, fontWeight: '900' },
  moreAvatar: { backgroundColor: '#223128' },
  moreText: { color: '#FFF8E8', fontSize: 9.5, fontWeight: '900' },
  emptyCrewIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#223128', alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.68 },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#D7B45A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0, gap: 1 },
  eyebrow: { color: '#D7B45A', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.9 },
  title: { color: '#FFF8E8', fontSize: 18, lineHeight: 21, fontWeight: '900' },
  detail: { color: '#AEB9B4', fontSize: 11.5, lineHeight: 16 },
  openWrap: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  openText: { color: '#D7B45A', fontSize: 11.5, fontWeight: '900' },
});
