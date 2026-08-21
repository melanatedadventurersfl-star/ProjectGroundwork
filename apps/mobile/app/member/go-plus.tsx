import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMembershipHub, type MembershipPlan, type MembershipStatus } from '../../src/membership/api';
import { AppIcon } from '../../src/ui/AppIcon';

const benefitCopy: Record<string, { title: string; body: string }> = {
  priority_registration: {
    title: 'First access to Adventures',
    body: 'Register during Go+ early-access windows before public registration opens.',
  },
  member_only_adventures: {
    title: 'Go+ member experiences',
    body: 'Join select outings and gatherings created specifically for the member community.',
  },
  premium_trip_early_access: {
    title: 'Early access to major trips',
    body: 'Get the first look at camps, signature weekends, and premium Adventures.',
  },
};

function money(cents: number | null) {
  if (cents == null) return '—';
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export default function GoPlusScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [membership, setMembership] = useState<MembershipStatus | null>(null);

  useEffect(() => {
    let active = true;
    void getMembershipHub()
      .then((result) => {
        if (!active) return;
        setPlans(result.plans);
        setMembership(result.membership);
      })
      .catch((caught) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : 'Unable to load membership.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const plan = useMemo(() => plans.find((item) => item.code === 'go_plus') ?? null, [plans]);
  const active = membership != null && ['trialing', 'active', 'complimentary'].includes(membership.status);
  const entitlements = active ? membership?.entitlements ?? [] : plan?.entitlements ?? [];

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <AppIcon name="chevron-back" color="#FFF8E8" size={22} />
        </Pressable>
        <Text style={styles.headerTitle}>Membership</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.hero}>
        <Text style={styles.kicker}>GO+</Text>
        <Text style={styles.heroTitle}>{active ? 'You’re in.' : 'Go deeper with the community.'}</Text>
        <Text style={styles.heroBody}>{active
          ? 'Your Go+ access travels with you across Adventures and member experiences.'
          : 'Get closer access to Adventures, member experiences, and what Go Melanated builds next.'}</Text>
        {active ? <View style={styles.statusPill}><Text style={styles.statusText}>{membership?.status === 'complimentary' ? 'COMPLIMENTARY MEMBER' : 'ACTIVE MEMBER'}</Text></View> : null}
      </View>

      {loading ? <ActivityIndicator color="#D7B45A" style={{ marginTop: 28 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && plan ? <>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What Go+ opens up</Text>
          <View style={styles.card}>
            {entitlements.map((key, index) => {
              const item = benefitCopy[key] ?? { title: key.replaceAll('_', ' '), body: 'Included with your Go+ membership.' };
              return <View key={key} style={[styles.benefitRow, index > 0 && styles.divider]}>
                <View style={styles.iconCircle}><AppIcon name="badge" color="#F5C341" size={18} /></View>
                <View style={styles.benefitCopy}><Text style={styles.benefitTitle}>{item.title}</Text><Text style={styles.benefitBody}>{item.body}</Text></View>
              </View>;
            })}
          </View>
        </View>

        {!active ? <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose your pace</Text>
          <View style={styles.planGrid}>
            <View style={styles.planCard}><Text style={styles.planLabel}>MONTHLY</Text><Text style={styles.price}>{money(plan.monthly_price_cents)}</Text><Text style={styles.period}>per month</Text></View>
            <View style={[styles.planCard, styles.featuredPlan]}><Text style={styles.planLabel}>ANNUAL</Text><Text style={styles.price}>{money(plan.annual_price_cents)}</Text><Text style={styles.period}>per year</Text><Text style={styles.saveText}>Best value</Text></View>
          </View>
          <View style={styles.billingNote}>
            <Text style={styles.billingTitle}>Membership checkout is next.</Text>
            <Text style={styles.billingBody}>The membership foundation is live in the app. Store billing will activate these plans without changing the Go+ access model.</Text>
          </View>
        </View> : <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your membership</Text>
          <View style={styles.card}><View style={styles.detailRow}><Text style={styles.detailLabel}>Plan</Text><Text style={styles.detailValue}>{membership?.plan_name ?? 'Go+'}</Text></View>
            <View style={[styles.detailRow, styles.divider]}><Text style={styles.detailLabel}>Billing</Text><Text style={styles.detailValue}>{membership?.billing_period ? membership.billing_period[0].toUpperCase() + membership.billing_period.slice(1) : 'Member access'}</Text></View>
            {membership?.current_period_ends_at ? <View style={[styles.detailRow, styles.divider]}><Text style={styles.detailLabel}>{membership.cancel_at_period_end ? 'Access through' : 'Renews'}</Text><Text style={styles.detailValue}>{new Date(membership.current_period_ends_at).toLocaleDateString()}</Text></View> : null}
          </View>
        </View>}

        <View style={styles.philosophyCard}>
          <Text style={styles.philosophyKicker}>MEMBERSHIP, NOT STATUS</Text>
          <Text style={styles.philosophyTitle}>Your Trailhead rank is still earned.</Text>
          <Text style={styles.philosophyBody}>Go+ opens access and experiences. Your rank, badges, Adventure history, and community progress remain based on what you do.</Text>
        </View>
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' },
  content: { padding: 20, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#17211C' },
  headerTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' },
  headerSpacer: { width: 40 },
  hero: { backgroundColor: '#1D2117', borderRadius: 24, borderWidth: 1, borderColor: '#6B5729', padding: 22 },
  kicker: { color: '#F5C341', fontSize: 12, fontWeight: '900', letterSpacing: 1.4 },
  heroTitle: { color: '#FFF8E8', fontSize: 30, lineHeight: 34, fontWeight: '900', marginTop: 8 },
  heroBody: { color: '#BCC6BF', fontSize: 15, lineHeight: 22, marginTop: 10 },
  statusPill: { alignSelf: 'flex-start', marginTop: 16, backgroundColor: '#2D351E', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, borderWidth: 1, borderColor: '#6B5729' },
  statusText: { color: '#F5C341', fontSize: 10, fontWeight: '900', letterSpacing: .8 },
  section: { marginTop: 24 },
  sectionTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900', marginBottom: 10 },
  card: { backgroundColor: '#17211C', borderRadius: 18, borderWidth: 1, borderColor: '#26332C', overflow: 'hidden' },
  benefitRow: { flexDirection: 'row', gap: 12, padding: 16 },
  divider: { borderTopWidth: 1, borderTopColor: '#26332C' },
  iconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#292817', alignItems: 'center', justifyContent: 'center' },
  benefitCopy: { flex: 1 },
  benefitTitle: { color: '#FFF8E8', fontSize: 15, fontWeight: '800' },
  benefitBody: { color: '#95A097', fontSize: 13, lineHeight: 19, marginTop: 3 },
  planGrid: { flexDirection: 'row', gap: 10 },
  planCard: { flex: 1, backgroundColor: '#17211C', borderRadius: 18, borderWidth: 1, borderColor: '#26332C', padding: 16 },
  featuredPlan: { borderColor: '#D7B45A', backgroundColor: '#1D2117' },
  planLabel: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  price: { color: '#FFF8E8', fontSize: 26, fontWeight: '900', marginTop: 7 },
  period: { color: '#8F9A93', fontSize: 12, marginTop: 1 },
  saveText: { color: '#F5C341', fontSize: 11, fontWeight: '800', marginTop: 9 },
  billingNote: { marginTop: 12, backgroundColor: '#131D18', borderRadius: 16, borderWidth: 1, borderColor: '#33463B', padding: 14 },
  billingTitle: { color: '#FFF8E8', fontSize: 14, fontWeight: '800' },
  billingBody: { color: '#8F9A93', fontSize: 12, lineHeight: 18, marginTop: 4 },
  detailRow: { minHeight: 54, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailLabel: { color: '#8F9A93', fontSize: 13 },
  detailValue: { color: '#FFF8E8', fontSize: 14, fontWeight: '800' },
  philosophyCard: { marginTop: 24, backgroundColor: '#131D18', borderRadius: 18, padding: 17, borderWidth: 1, borderColor: '#33463B' },
  philosophyKicker: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  philosophyTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900', marginTop: 6 },
  philosophyBody: { color: '#8F9A93', fontSize: 13, lineHeight: 19, marginTop: 5 },
  error: { color: '#FFB4A9', marginTop: 18 },
});
