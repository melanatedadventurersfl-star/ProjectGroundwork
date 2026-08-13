import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMemberBasecamp } from '../../src/member/api';

function roleLabel(role: string | null | undefined) {
  if (role === 'organizer') return 'Organizer';
  if (role === 'guardian') return 'Guardian';
  if (role === 'dependent') return 'Dependent';
  if (role === 'connected_member') return 'Connected Member';
  return 'Adult Member';
}

export default function TrailFamilyScreen() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMemberBasecamp()
      .then(setData)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load Trail Family.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.eyebrow}>PEOPLE YOU ADVENTURE WITH</Text>
        <Text style={styles.title}>Trail Family</Text>
        <Text style={styles.intro}>Keep family and trusted travel companions connected for easier registration, readiness, and guardian-managed participation.</Text>

        {loading ? <ActivityIndicator color="#D7B45A" /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!loading && !data?.households?.length ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No Trail Family connected yet</Text>
            <Text style={styles.emptyBody}>You can create or join a Trail Family during onboarding. Invite and management controls will live here as the feature expands.</Text>
          </View>
        ) : null}

        {data?.households?.map((membership: any, index: number) => (
          <View key={`${membership.households?.id ?? index}`} style={styles.familyCard}>
            <View style={styles.cardTopRow}>
              <View>
                <Text style={styles.familyName}>{membership.households?.name ?? 'Trail Family'}</Text>
                <Text style={styles.role}>{roleLabel(membership.trail_family_role)}</Text>
              </View>
              <View style={styles.rolePill}><Text style={styles.rolePillText}>{roleLabel(membership.trail_family_role).toUpperCase()}</Text></View>
            </View>
            <View style={styles.permissionRow}>
              <Text style={styles.permission}>{membership.can_manage_bookings ? 'Can manage bookings' : 'Own bookings only'}</Text>
              <Text style={styles.permission}>{membership.can_manage_readiness ? 'Can manage readiness' : 'Own readiness only'}</Text>
            </View>
            {membership.households?.invite_code ? (
              <View style={styles.inviteBox}>
                <Text style={styles.inviteLabel}>TRAIL FAMILY INVITE CODE</Text>
                <Text style={styles.inviteCode}>{membership.households.invite_code}</Text>
              </View>
            ) : null}
          </View>
        ))}

        <View style={styles.rulesCard}>
          <Text style={styles.cardTitle}>How Trail Family works</Text>
          <Text style={styles.rule}>Adult accounts remain private and independent.</Text>
          <Text style={styles.rule}>Guardians can manage authorized dependents.</Text>
          <Text style={styles.rule}>A dependent can have more than one Guardian.</Text>
          <Text style={styles.rule}>Organizer is an administrative permission, not a family hierarchy.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F1713' }, content: { padding: 20, paddingBottom: 50, gap: 12 }, back: { color: '#D7B45A', fontWeight: '800', fontSize: 16 },
  eyebrow: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1.1, marginTop: 5 }, title: { color: '#FFF8E8', fontSize: 34, fontWeight: '900' }, intro: { color: '#AEB8B2', lineHeight: 21, marginBottom: 5 }, error: { color: '#FFB4A9' },
  familyCard: { backgroundColor: '#17211C', borderRadius: 18, borderWidth: 1, borderColor: '#29372F', padding: 17, gap: 13 }, cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, familyName: { color: '#FFF8E8', fontSize: 21, fontWeight: '900' }, role: { color: '#B6C0BA', marginTop: 4 }, rolePill: { backgroundColor: '#2C3A31', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, alignSelf: 'flex-start' }, rolePillText: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  permissionRow: { gap: 5 }, permission: { color: '#9EAAA3', fontSize: 13 }, inviteBox: { backgroundColor: '#101713', borderRadius: 13, padding: 13 }, inviteLabel: { color: '#78867D', fontSize: 9, fontWeight: '900', letterSpacing: 1 }, inviteCode: { color: '#F0D083', fontSize: 20, fontWeight: '900', letterSpacing: 2, marginTop: 4 },
  rulesCard: { backgroundColor: '#24352C', borderRadius: 18, padding: 17, gap: 8 }, cardTitle: { color: '#FFF8E8', fontSize: 19, fontWeight: '900' }, rule: { color: '#C6D0C9', lineHeight: 20 }, emptyCard: { backgroundColor: '#17211C', borderRadius: 18, padding: 20, borderWidth: 1, borderColor: '#29372F' }, emptyTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' }, emptyBody: { color: '#AEB8B2', lineHeight: 20, marginTop: 6 },
});
