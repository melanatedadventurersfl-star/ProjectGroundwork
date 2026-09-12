import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../../src/auth/AuthProvider';
import { experienceLabel } from '../../../src/platform/experience';
import { useTenantExperience } from '../../../src/platform/TenantExperienceProvider';
import { AppIcon, type AppIconName } from '../../../src/ui/AppIcon';

type MenuItem = {
  key: string;
  label: string;
  detail: string;
  icon: AppIconName;
  route: string;
};

function textValue(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export default function TenantMenuScreen() {
  const { signOut } = useAuth();
  const { context, moduleEnabled } = useTenantExperience();
  if (!context) return null;

  const { experience, organization } = context;
  const brandName = textValue(experience.branding.brand_name, experience.name);
  const accent = textValue(experience.branding.accent, '#D7B45A');
  const surface = textValue(experience.branding.surface, '#17211C');
  const text = textValue(experience.branding.text, '#FFF8E8');
  const base = `/experience/${experience.publicSlug}`;
  const memberLabel = experienceLabel(experience, 'member', 'Member');

  const rows: MenuItem[] = [
    moduleEnabled('home') ? { key: 'home', label: experienceLabel(experience, 'home', 'Home'), detail: `${brandName} home`, icon: 'trailhead', route: base } : null,
    moduleEnabled('events') ? { key: 'events', label: experienceLabel(experience, 'events', 'Events'), detail: `Events published by ${brandName}`, icon: 'calendar', route: `${base}/events` } : null,
    moduleEnabled('profiles') ? { key: 'profiles', label: `${memberLabel} Profile`, detail: `Your identity inside ${brandName}`, icon: 'profile', route: `${base}/profile` } : null,
  ].filter((item): item is MenuItem => item !== null);

  async function handleSignOut() {
    await signOut();
    router.replace({ pathname: '/tenant-sign-in', params: { slug: experience.publicSlug } });
  }

  return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <Text style={[styles.eyebrow, { color: accent }]}>{brandName.toUpperCase()}</Text>
    <Text style={[styles.title, { color: text }]}>Menu</Text>
    <Text style={styles.subtitle}>Settings and navigation for this organization app only.</Text>

    <View style={[styles.identity, { backgroundColor: surface }]}>
      <View style={[styles.mark, { borderColor: `${accent}88` }]}><Text style={[styles.markText, { color: accent }]}>{brandName.slice(0, 1).toUpperCase()}</Text></View>
      <View style={styles.flex}><Text style={[styles.orgName, { color: text }]}>{organization.name}</Text><Text style={styles.orgMeta}>{organization.roles.length ? organization.roles.join(' · ') : 'Organization member'}</Text></View>
    </View>

    <View style={[styles.card, { backgroundColor: surface }]}>
      {rows.map((row, index) => <Pressable key={row.key} style={[styles.row, index > 0 && styles.divider]} onPress={() => router.replace(row.route as never)}>
        <View style={[styles.icon, { backgroundColor: `${accent}20` }]}><AppIcon name={row.icon} color={accent} size={20} /></View>
        <View style={styles.flex}><Text style={[styles.rowTitle, { color: text }]}>{row.label}</Text><Text style={styles.rowDetail}>{row.detail}</Text></View>
        <AppIcon name="chevron-forward" color="#7D8A82" size={18} />
      </Pressable>)}
    </View>

    <View style={[styles.separationCard, { borderColor: `${accent}50` }]}>
      <AppIcon name="privacy" color={accent} size={20} />
      <View style={styles.flex}><Text style={[styles.separationTitle, { color: text }]}>Separate organization experience</Text><Text style={styles.separationText}>{brandName} does not expose Go Melanated profile, community, Passport, Trail Guide, membership, or saved-content data.</Text></View>
    </View>

    <Pressable style={styles.signOut} onPress={() => void handleSignOut()}><AppIcon name="profile" color="#E9AAA2" size={18} /><Text style={styles.signOutText}>Sign out of this app</Text></Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 32, maxWidth: 720, width: '100%', alignSelf: 'center' },
  flex: { flex: 1 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  title: { fontSize: 29, fontWeight: '900', marginTop: 5 },
  subtitle: { color: '#8D9A92', fontSize: 11, lineHeight: 17, marginTop: 5 },
  identity: { borderRadius: 17, padding: 14, marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 11 },
  mark: { width: 43, height: 43, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0E1511' },
  markText: { fontSize: 17, fontWeight: '900' },
  orgName: { fontSize: 13, fontWeight: '900' },
  orgMeta: { color: '#7D8A82', fontSize: 9, marginTop: 3, textTransform: 'capitalize' },
  card: { borderRadius: 17, marginTop: 12, overflow: 'hidden' },
  row: { minHeight: 67, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
  divider: { borderTopWidth: 1, borderTopColor: '#2D3932' },
  icon: { width: 39, height: 39, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 12.5, fontWeight: '900' },
  rowDetail: { color: '#7D8A82', fontSize: 9.5, lineHeight: 13, marginTop: 2 },
  separationCard: { marginTop: 13, borderRadius: 16, borderWidth: 1, padding: 14, flexDirection: 'row', gap: 11, backgroundColor: 'rgba(255,255,255,0.02)' },
  separationTitle: { fontSize: 11.5, fontWeight: '900' },
  separationText: { color: '#87948C', fontSize: 9.5, lineHeight: 15, marginTop: 3 },
  signOut: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: '#5C3734', backgroundColor: '#241513', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 },
  signOutText: { color: '#E9AAA2', fontSize: 11, fontWeight: '900' },
});
