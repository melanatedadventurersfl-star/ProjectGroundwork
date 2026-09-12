import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { supabase } from '../../src/lib/supabase';
import {
  experienceLabel,
  experienceModuleEnabled,
  type ActiveExperienceContext,
} from '../../src/platform/experience';
import { AppIcon, type AppIconName } from '../../src/ui/AppIcon';

type PublishedEvent = {
  id: string;
  title: string;
  summary: string;
  category: string;
  starts_at: string;
  city: string;
  state: string;
  venue_name: string | null;
  hero_image_url: string | null;
  starting_price_cents: number;
};

type HomeSectionCode = 'hero' | 'upcoming_events' | 'community_activity' | 'recommendations';

type CommunityHomeProps = {
  context: ActiveExperienceContext;
};

const DEFAULT_LAYOUT: HomeSectionCode[] = [
  'hero',
  'upcoming_events',
  'community_activity',
  'recommendations',
];

const SUPPORTED_SECTIONS = new Set<HomeSectionCode>(DEFAULT_LAYOUT);

function textValue(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function homeLayout(value: unknown[]): HomeSectionCode[] {
  const seen = new Set<string>();
  const configured = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim() as HomeSectionCode)
    .filter((item) => SUPPORTED_SECTIONS.has(item) && !seen.has(item) && Boolean(seen.add(item)));

  return configured.length ? configured : DEFAULT_LAYOUT;
}

function eventDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function priceLabel(cents: number) {
  if (!cents) return 'Free';
  return `From $${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export default function CommunityHome({ context }: CommunityHomeProps) {
  const [events, setEvents] = useState<PublishedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { experience, modules } = context;
  const brandName = textValue(experience.branding.brand_name, experience.name);
  const homeName = experienceLabel(experience, 'home', 'Home');
  const eventsName = experienceLabel(experience, 'events', 'Events');
  const communityName = experienceLabel(experience, 'community', 'Community');
  const directoryName = experienceLabel(experience, 'directory', 'Directory');
  const memberName = experienceLabel(experience, 'member', 'Member');
  const accent = textValue(experience.branding.accent, '#D7B45A');
  const primary = textValue(experience.branding.primary, '#0F1713');
  const surface = textValue(experience.branding.surface, '#17211C');
  const text = textValue(experience.branding.text, '#FFF8E8');
  const coverImage = textValue(experience.branding.cover_image_url, '');
  const logoUrl = textValue(experience.branding.logo_url, '');
  const tagline = textValue(experience.publicSettings.tagline, `Discover what is happening across ${brandName}.`);
  const sections = useMemo(() => homeLayout(experience.homeLayout), [experience.homeLayout]);

  const eventsEnabled = experienceModuleEnabled(modules, 'events');
  const communityEnabled = experienceModuleEnabled(modules, 'community');
  const directoryEnabled = experienceModuleEnabled(modules, 'directory', false);
  const groupsEnabled = experienceModuleEnabled(modules, 'groups', false);
  const profilesEnabled = experienceModuleEnabled(modules, 'profiles', false);
  const membershipsEnabled = experienceModuleEnabled(modules, 'memberships', false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { data, error: queryError } = await supabase
        .from('adventures')
        .select('id,title,summary,category,starts_at,city,state,venue_name,hero_image_url,starting_price_cents')
        .eq('public_experience_id', experience.id)
        .in('status', ['published', 'sold_out'])
        .gte('ends_at', new Date().toISOString())
        .order('is_featured', { ascending: false })
        .order('starts_at', { ascending: true })
        .limit(8);

      if (queryError) throw queryError;
      setEvents((data ?? []) as PublishedEvent[]);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Unable to load ${eventsName.toLowerCase()}.`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventsName, experience.id]);

  useState(() => {
    void load();
    return true;
  });

  function renderHero() {
    const body = (
      <>
        <View style={styles.heroTop}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.logo} resizeMode="contain" />
          ) : (
            <View style={[styles.logoFallback, { borderColor: accent }]}>
              <Text style={[styles.logoFallbackText, { color: accent }]}>{brandName.slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.heroBrandCopy}>
            <Text style={[styles.eyebrow, { color: accent }]}>{homeName.toUpperCase()}</Text>
            <Text style={[styles.brandName, { color: text }]}>{brandName}</Text>
          </View>
        </View>
        <Text style={[styles.heroTitle, { color: text }]}>{tagline}</Text>
        <View style={styles.heroActions}>
          {eventsEnabled ? <ActionButton label={`Browse ${eventsName}`} icon="calendar" accent={accent} onPress={() => router.push('/(tabs)/explore')} /> : null}
          {communityEnabled ? <ActionButton label={`Open ${communityName}`} icon="community" accent={accent} onPress={() => router.push('/(tabs)/community')} /> : null}
        </View>
      </>
    );

    if (coverImage) {
      return <ImageBackground key="hero" source={{ uri: coverImage }} style={styles.hero} imageStyle={styles.heroImage}>
        <View style={styles.heroShade} />
        <View style={styles.heroBody}>{body}</View>
      </ImageBackground>;
    }

    return <View key="hero" style={[styles.hero, styles.heroPlain, { backgroundColor: surface, borderColor: accent }]}>
      <View style={styles.heroBody}>{body}</View>
    </View>;
  }

  function renderEvents() {
    if (!eventsEnabled) return null;
    return <View key="upcoming_events" style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionCopy}>
          <Text style={[styles.sectionTitle, { color: text }]}>Upcoming {eventsName}</Text>
          <Text style={styles.sectionSubtitle}>Published by {brandName}</Text>
        </View>
        <Pressable onPress={() => router.push('/(tabs)/explore')}><Text style={[styles.sectionLink, { color: accent }]}>See all</Text></Pressable>
      </View>

      {loading ? <ActivityIndicator color={accent} style={styles.loader} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && events.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eventRow}>
        {events.map((event) => <Pressable
          key={event.id}
          style={[styles.eventCard, { backgroundColor: surface }]}
          onPress={() => router.push({ pathname: '/adventures/[id]', params: { id: event.id } })}
        >
          {event.hero_image_url ? <Image source={{ uri: event.hero_image_url }} style={styles.eventImage} /> : <View style={[styles.eventImageFallback, { backgroundColor: primary }]}><AppIcon name="calendar" color={accent} size={28} /></View>}
          <View style={styles.eventBody}>
            <Text style={[styles.eventCategory, { color: accent }]}>{event.category.toUpperCase()}</Text>
            <Text style={[styles.eventTitle, { color: text }]} numberOfLines={2}>{event.title}</Text>
            <Text style={styles.eventMeta}>{eventDate(event.starts_at)} · {event.city}, {event.state}</Text>
            <Text style={[styles.eventPrice, { color: text }]}>{priceLabel(event.starting_price_cents)}</Text>
          </View>
        </Pressable>)}
      </ScrollView> : null}

      {!loading && !events.length ? <View style={[styles.emptyCard, { backgroundColor: surface }]}>
        <Text style={[styles.emptyTitle, { color: text }]}>No upcoming {eventsName.toLowerCase()} yet.</Text>
        <Text style={styles.emptyText}>When {brandName} publishes something new, it will appear here.</Text>
      </View> : null}
    </View>;
  }

  function renderCommunity() {
    if (!communityEnabled) return null;
    return <Pressable
      key="community_activity"
      style={[styles.communityCard, { backgroundColor: surface, borderColor: `${accent}66` }]}
      onPress={() => router.push('/(tabs)/community')}
    >
      <View style={[styles.featureIcon, { backgroundColor: `${accent}22` }]}><AppIcon name="community" color={accent} size={24} /></View>
      <View style={styles.flex}>
        <Text style={[styles.communityTitle, { color: text }]}>{communityName}</Text>
        <Text style={styles.communityText}>Connect with other {memberName.toLowerCase()}s, join conversations, and keep up with your community.</Text>
      </View>
      <AppIcon name="chevron-forward" color={accent} size={20} />
    </Pressable>;
  }

  function renderRecommendations() {
    const cards: { key: string; label: string; detail: string; route: string; icon: AppIconName }[] = [];
    if (directoryEnabled) cards.push({ key: 'directory', label: directoryName, detail: 'Find trusted places, businesses, and resources.', route: '/trail-guide', icon: 'directory' });
    if (groupsEnabled) cards.push({ key: 'groups', label: 'Groups', detail: 'Find smaller communities built around shared interests.', route: '/groups', icon: 'connections' });
    if (profilesEnabled) cards.push({ key: 'profiles', label: `${memberName} Profile`, detail: 'Manage how you show up across this community.', route: '/member/profile', icon: 'profile' });
    if (membershipsEnabled) cards.push({ key: 'memberships', label: 'Membership', detail: 'View your membership and available benefits.', route: '/member/go-plus', icon: 'badge' });
    if (!cards.length) return null;

    return <View key="recommendations" style={styles.section}>
      <View style={styles.sectionCopy}>
        <Text style={[styles.sectionTitle, { color: text }]}>Explore {brandName}</Text>
        <Text style={styles.sectionSubtitle}>Shortcuts based on the modules this organization enabled.</Text>
      </View>
      <View style={styles.featureGrid}>
        {cards.map((card) => <Pressable key={card.key} style={[styles.featureCard, { backgroundColor: surface }]} onPress={() => router.push(card.route as never)}>
          <View style={[styles.featureIcon, { backgroundColor: `${accent}22` }]}><AppIcon name={card.icon} color={accent} size={22} /></View>
          <Text style={[styles.featureTitle, { color: text }]}>{card.label}</Text>
          <Text style={styles.featureText}>{card.detail}</Text>
        </Pressable>)}
      </View>
    </View>;
  }

  function renderSection(section: HomeSectionCode) {
    if (section === 'hero') return renderHero();
    if (section === 'upcoming_events') return renderEvents();
    if (section === 'community_activity') return renderCommunity();
    if (section === 'recommendations') return renderRecommendations();
    return null;
  }

  return <ScrollView
    style={[styles.screen, { backgroundColor: primary }]}
    contentContainerStyle={styles.content}
    refreshControl={<RefreshControl refreshing={refreshing} tintColor={accent} onRefresh={() => void load(true)} />}
  >
    {sections.map(renderSection)}
  </ScrollView>;
}

function ActionButton({ label, icon, accent, onPress }: { label: string; icon: AppIconName; accent: string; onPress: () => void }) {
  return <Pressable style={styles.actionButton} onPress={onPress}>
    <AppIcon name={icon} color={accent} size={17} />
    <Text style={[styles.actionText, { color: accent }]}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 56, gap: 20, maxWidth: 900, width: '100%', alignSelf: 'center' },
  flex: { flex: 1 },
  hero: { minHeight: 260, borderRadius: 24, overflow: 'hidden', justifyContent: 'flex-end' },
  heroPlain: { borderWidth: 1 },
  heroImage: { borderRadius: 24 },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,8,6,0.54)' },
  heroBody: { padding: 20, gap: 15 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 50, height: 50, borderRadius: 14 },
  logoFallback: { width: 50, height: 50, borderRadius: 14, borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.18)', alignItems: 'center', justifyContent: 'center' },
  logoFallbackText: { fontSize: 20, fontWeight: '900' },
  heroBrandCopy: { flex: 1 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  brandName: { fontSize: 19, fontWeight: '900', marginTop: 2 },
  heroTitle: { fontSize: 28, lineHeight: 33, fontWeight: '900', maxWidth: 600 },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  actionButton: { minHeight: 42, borderRadius: 13, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(4,9,7,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  actionText: { fontSize: 11, fontWeight: '900' },
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  sectionCopy: { flex: 1, gap: 3 },
  sectionTitle: { fontSize: 22, lineHeight: 27, fontWeight: '900' },
  sectionSubtitle: { color: '#98A69E', fontSize: 11.5, lineHeight: 16, fontWeight: '600' },
  sectionLink: { fontSize: 11, fontWeight: '900', paddingTop: 5 },
  loader: { marginVertical: 18 },
  error: { color: '#FFB4A9', fontSize: 11.5 },
  eventRow: { gap: 12, paddingRight: 18 },
  eventCard: { width: 278, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  eventImage: { width: '100%', height: 138, resizeMode: 'cover' },
  eventImageFallback: { height: 138, alignItems: 'center', justifyContent: 'center' },
  eventBody: { padding: 13, gap: 4 },
  eventCategory: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8 },
  eventTitle: { fontSize: 17, lineHeight: 21, fontWeight: '900' },
  eventMeta: { color: '#AEB9B2', fontSize: 10.5, lineHeight: 14, fontWeight: '700' },
  eventPrice: { fontSize: 11, fontWeight: '900', marginTop: 4 },
  emptyCard: { borderRadius: 17, padding: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  emptyTitle: { fontSize: 14, fontWeight: '900' },
  emptyText: { color: '#98A69E', fontSize: 11.5, lineHeight: 16, marginTop: 4 },
  communityCard: { minHeight: 104, borderRadius: 18, padding: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  communityTitle: { fontSize: 16, fontWeight: '900' },
  communityText: { color: '#AAB6AF', fontSize: 11.5, lineHeight: 16, marginTop: 3 },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  featureCard: { minWidth: 160, flexGrow: 1, flexBasis: 160, borderRadius: 17, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  featureIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  featureTitle: { fontSize: 14, fontWeight: '900' },
  featureText: { color: '#98A69E', fontSize: 10.5, lineHeight: 15, marginTop: 4 },
});
