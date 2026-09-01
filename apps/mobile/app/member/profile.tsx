import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { supabase } from '../../src/lib/supabase';
import { getJourney } from '../../src/passport/api';
import { AppIcon } from '../../src/ui/AppIcon';
import ProfileScreenBase from './profile-base';

export default function ProfileScreen() {
  const [journeyCount, setJourneyCount] = useState<number | null>(null);
  const [canViewAsMember, setCanViewAsMember] = useState(false);

  useEffect(() => {
    let active = true;
    void getJourney()
      .then((journey) => { if (active) setJourneyCount(journey.length); })
      .catch(() => { if (active) setJourneyCount(null); });

    void supabase.rpc('can_view_as_member')
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.warn('[view-as] Unable to resolve owner preview access', error.message);
          setCanViewAsMember(false);
          return;
        }
        setCanViewAsMember(data === true);
      });

    return () => { active = false; };
  }, []);

  return (
    <View style={styles.screen}>
      {canViewAsMember ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View as member"
          style={({ pressed }) => [styles.ownerBar, pressed && styles.pressed]}
          onPress={() => router.push('/member/view-as' as never)}
        >
          <View style={styles.ownerIconWrap}>
            <AppIcon name="privacy" color="#17211C" size={18} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.ownerEyebrow}>OWNER ONLY · READ ONLY</Text>
            <Text style={styles.ownerTitle}>View As Member</Text>
            <Text style={styles.ownerDetail} numberOfLines={1}>See a member’s Trailhead context without signing into their account.</Text>
          </View>
          <View style={styles.openWrap}>
            <Text style={styles.openText}>Open</Text>
            <AppIcon name="chevron-forward" color="#D7B45A" size={17} />
          </View>
        </Pressable>
      ) : null}

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

      <View style={styles.profile}>
        <ProfileScreenBase />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#09110F' },
  profile: { flex: 1 },
  ownerBar: {
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 4,
    minHeight: 76,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#806525',
    backgroundColor: '#2A2110',
    paddingHorizontal: 13,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
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
  pressed: { opacity: 0.68 },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#D7B45A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F5C341',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0, gap: 1 },
  eyebrow: { color: '#D7B45A', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.9 },
  ownerEyebrow: { color: '#F5C341', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.9 },
  title: { color: '#FFF8E8', fontSize: 18, lineHeight: 21, fontWeight: '900' },
  ownerTitle: { color: '#FFF3D1', fontSize: 18, lineHeight: 21, fontWeight: '900' },
  detail: { color: '#AEB9B4', fontSize: 11.5, lineHeight: 16 },
  ownerDetail: { color: '#C6B98E', fontSize: 11.5, lineHeight: 16 },
  openWrap: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  openText: { color: '#D7B45A', fontSize: 11.5, fontWeight: '900' },
});
