import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTenantExperience } from '../../../src/platform/TenantExperienceProvider';
import { AppIcon } from '../../../src/ui/AppIcon';

function textValue(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export default function TenantBusinessScreen() {
  const { context } = useTenantExperience();
  if (!context) return null;

  const { organization, experience } = context;
  const brandName = textValue(experience.branding.brand_name, experience.name);
  const accent = textValue(experience.branding.accent, '#D7B45A');
  const surface = textValue(experience.branding.surface, '#17211C');
  const text = textValue(experience.branding.text, '#FFF8E8');
  const logoUrl = textValue(experience.branding.logo_url, '');
  const coverUrl = textValue(experience.branding.cover_image_url, '');
  const tagline = textValue(experience.publicSettings.tagline, '');
  const description = textValue(experience.publicSettings.description, '');

  return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={[styles.hero, { backgroundColor: surface }]}>
      {coverUrl ? <Image source={{ uri: coverUrl }} style={styles.cover} /> : <View style={[styles.cover, styles.coverFallback]}><AppIcon name="storefront" color={accent} size={44} /></View>}
      <View style={styles.identity}>
        {logoUrl ? <Image source={{ uri: logoUrl }} style={styles.logo} /> : <View style={[styles.logo, styles.logoFallback, { borderColor: `${accent}80` }]}><Text style={[styles.logoText, { color: accent }]}>{brandName.slice(0, 1).toUpperCase()}</Text></View>}
        <View style={styles.flex}><Text style={[styles.name, { color: text }]}>{brandName}</Text><Text style={styles.kind}>{organization.kind.toUpperCase()}</Text></View>
      </View>
      {tagline ? <Text style={styles.tagline}>{tagline}</Text> : null}
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>

    <View style={[styles.card, { backgroundColor: surface }]}>
      <Text style={[styles.cardTitle, { color: text }]}>About this organization</Text>
      <Text style={styles.cardText}>This public business identity belongs to {organization.name}. It is separate from Go Melanated business, member, and community data.</Text>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 30, maxWidth: 820, width: '100%', alignSelf: 'center', gap: 12 },
  flex: { flex: 1 },
  hero: { borderRadius: 22, overflow: 'hidden', paddingBottom: 18 },
  cover: { width: '100%', height: 210 },
  coverFallback: { backgroundColor: '#101713', alignItems: 'center', justifyContent: 'center' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, marginTop: -25 },
  logo: { width: 68, height: 68, borderRadius: 18 },
  logoFallback: { backgroundColor: '#111812', borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 24, fontWeight: '900' },
  name: { fontSize: 24, fontWeight: '900', marginTop: 25 },
  kind: { color: '#819087', fontSize: 8.5, fontWeight: '900', letterSpacing: 1, marginTop: 3 },
  tagline: { color: '#D0D8D2', fontSize: 13, fontWeight: '800', paddingHorizontal: 18, marginTop: 14 },
  description: { color: '#97A49C', fontSize: 11, lineHeight: 17, paddingHorizontal: 18, marginTop: 6 },
  card: { borderRadius: 17, padding: 15 },
  cardTitle: { fontSize: 12.5, fontWeight: '900' },
  cardText: { color: '#89968E', fontSize: 10.5, lineHeight: 16, marginTop: 5 },
});
