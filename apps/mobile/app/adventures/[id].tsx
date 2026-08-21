import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getAdventure,
  getAdventureRsvpSummary,
  listAdventureTicketTypes,
  setAdventureRsvp,
  setAdventureSaved,
  type AdventureAttendanceVisibility,
  type AdventureRsvpStatus,
  type AdventureRsvpSummary,
  type AdventureTicketType,
} from '../../src/adventures/api';
import type { AdventureDetail } from '../../src/adventures/types';
import { FavoriteButton } from '../../src/components/FavoriteButton';

function titleCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function AdventureDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const isTablet = width >= 700;

  const [adventure, setAdventure] = useState<AdventureDetail | null>(null);
  const [tickets, setTickets] = useState<AdventureTicketType[]>([]);
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [rsvp, setRsvp] = useState<AdventureRsvpSummary>({
    interested: 0,
    going: 0,
    myStatus: null,
    myVisibility: 'community',
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [nextAdventure, nextTickets, nextRsvp] = await Promise.all([
        getAdventure(id),
        listAdventureTicketTypes(id),
        getAdventureRsvpSummary(id),
      ]);
      setAdventure(nextAdventure);
      setSaved(Boolean(nextAdventure.is_saved));
      setTickets(nextTickets);
      setRsvp(nextRsvp.myStatus ? nextRsvp : { ...nextRsvp, myVisibility: 'community' });
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load adventure.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const priceLabel = useMemo(() => {
    if (!adventure) return '';
    if (!tickets.length) {
      return adventure.starting_price_cents === 0
        ? 'Free'
        : `$${Math.round(adventure.starting_price_cents / 100)}`;
    }
    const minimum = Math.min(...tickets.map((ticket) => ticket.price_cents));
    if (tickets.length === 1) return minimum === 0 ? 'Free' : `$${Math.round(minimum / 100)}`;
    return minimum === 0 ? 'From Free' : `From $${Math.round(minimum / 100)}`;
  }, [adventure, tickets]);

  async function toggleSaved() {
    if (!adventure) return;
    const next = !saved;
    setSaved(next);
    setNotice(next ? 'Adventure saved.' : 'Removed from Saved.');
    try {
      await setAdventureSaved(adventure.id, next);
    } catch (caught) {
      setSaved(!next);
      setError(caught instanceof Error ? caught.message : 'Unable to update saved adventure.');
    }
  }

  async function chooseRsvp(status: AdventureRsvpStatus) {
    if (!adventure) return;
    setWorking(true);
    try {
      await setAdventureRsvp(adventure.id, status, rsvp.myVisibility);
      await load();
      setNotice(status === 'not_going'
        ? 'Marked Not Going. This does not cancel an active reservation.'
        : `Marked ${titleCase(status)}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update RSVP.');
    } finally {
      setWorking(false);
    }
  }

  async function toggleVisibility() {
    if (!adventure) return;
    const visibility: AdventureAttendanceVisibility = rsvp.myVisibility === 'private' ? 'community' : 'private';

    if (!rsvp.myStatus) {
      setRsvp((current) => ({ ...current, myVisibility: visibility }));
      return;
    }

    setWorking(true);
    try {
      await setAdventureRsvp(adventure.id, rsvp.myStatus, visibility);
      setRsvp((current) => ({ ...current, myVisibility: visibility }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update attendance privacy.');
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return <SafeAreaView style={styles.center}><ActivityIndicator color="#F4C542" /></SafeAreaView>;
  }

  if (!adventure) {
    return <SafeAreaView style={styles.center}><Text style={styles.error}>{error ?? 'Adventure not found.'}</Text></SafeAreaView>;
  }

  const soldOut = adventure.status === 'sold_out';
  const cancelled = adventure.status === 'cancelled';
  const closed = soldOut || cancelled || adventure.status === 'completed';
  const spotsLabel = soldOut
    ? 'Sold out'
    : adventure.spots_remaining == null
      ? 'Open'
      : `${adventure.spots_remaining} spots`;
  const canCheckout = !closed && tickets.length > 0;
  const heroLocation = adventure.venue_name
    ? `${adventure.venue_name} · ${adventure.city}, ${adventure.state}`
    : `${adventure.city}, ${adventure.state}`;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[styles.content, isTablet && styles.tabletContent]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.heroWrap, isTablet && styles.tabletHeroWrap]}>
            <ImageBackground
              source={adventure.hero_image_url ? { uri: adventure.hero_image_url } : undefined}
              style={[styles.hero, isTablet && styles.tabletHero]}
              imageStyle={styles.heroRadius}
            >
              <View style={styles.heroShade} />
              <View style={styles.heroTop}>
                <Pressable accessibilityLabel="Back" style={styles.heroButton} onPress={() => router.back()}>
                  <Text style={styles.heroButtonText}>‹</Text>
                </Pressable>
                <FavoriteButton
                  saved={saved}
                  accessibilityLabel={saved ? 'Remove from Saved' : 'Save Adventure'}
                  onPress={() => void toggleSaved()}
                />
              </View>

              <View style={styles.heroBottom}>
                <Text style={styles.eyebrow}>{adventure.is_featured ? 'FEATURED ADVENTURE' : 'OFFICIAL ADVENTURE'}</Text>
                <Text style={styles.title}>{adventure.title}</Text>
                <Text style={styles.heroMeta}>{formatDate(adventure.starts_at)} · {formatTime(adventure.starts_at)}</Text>
                <Text style={styles.heroLocation}>⌖  {heroLocation}</Text>
              </View>
            </ImageBackground>
          </View>

          <View style={styles.quickFacts}>
            <View style={styles.quickFact}><Text style={styles.quickIcon}>◈</Text><Text style={styles.quickValue}>{priceLabel}</Text><Text style={styles.quickLabel}>Price</Text></View>
            <View style={styles.quickFact}><Text style={styles.quickIcon}>♙</Text><Text style={styles.quickValue}>{spotsLabel}</Text><Text style={styles.quickLabel}>Availability</Text></View>
            <View style={styles.quickFact}><Text style={styles.quickIcon}>△</Text><Text style={styles.quickValue}>{titleCase(adventure.difficulty)}</Text><Text style={styles.quickLabel}>Difficulty</Text></View>
            <View style={styles.quickFact}><Text style={styles.quickIcon}>≈</Text><Text style={styles.quickValue}>{titleCase(adventure.category)}</Text><Text style={styles.quickLabel}>Adventure</Text></View>
          </View>

          {notice ? <View style={styles.notice}><Text style={styles.noticeText}>{notice}</Text></View> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.card}>
            <View style={styles.sectionHeadingRow}>
              <View style={styles.sectionIcon}><Text style={styles.sectionIconText}>⌁</Text></View>
              <Text style={styles.sectionTitle}>About this adventure</Text>
            </View>
            <Text style={styles.body}>{adventure.description}</Text>
            <View style={styles.chips}>
              <Text style={styles.chip}>{titleCase(adventure.difficulty)}</Text>
              <Text style={styles.chipAlt}>{titleCase(adventure.category)}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeadingRow}>
              <View style={styles.sectionIcon}><Text style={styles.sectionIconText}>♙</Text></View>
              <View style={styles.sectionHeadingCopy}>
                <Text style={styles.sectionTitle}>Who’s going</Text>
                <Text style={styles.subtle}>{rsvp.going} going · {rsvp.interested} interested</Text>
              </View>
            </View>
            <View style={styles.rsvpRow}>
              {(['interested', 'going'] as AdventureRsvpStatus[]).map((status) => (
                <Pressable
                  key={status}
                  disabled={working}
                  style={[styles.rsvpButton, rsvp.myStatus === status && styles.rsvpActive]}
                  onPress={() => void chooseRsvp(status)}
                >
                  <Text style={[styles.rsvpText, rsvp.myStatus === status && styles.rsvpTextActive]}>{titleCase(status)}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.rsvpFooter}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Attendance visibility: ${rsvp.myVisibility === 'private' ? 'Private' : 'Public'}. Tap to change.`}
                disabled={working}
                hitSlop={6}
                style={styles.visibilityButton}
                onPress={() => void toggleVisibility()}
              >
                <Text style={styles.visibilityIcon}>{rsvp.myVisibility === 'private' ? '▣' : '◎'}</Text>
                <View style={styles.visibilityCopy}>
                  <Text style={styles.visibilityLabel}>Attendance visibility</Text>
                  <Text style={styles.visibilityValue}>{rsvp.myVisibility === 'private' ? 'Private' : 'Public'}  ⌄</Text>
                </View>
              </Pressable>
              {rsvp.myStatus ? (
                <Pressable disabled={working} onPress={() => void chooseRsvp('not_going')}>
                  <Text style={styles.secondaryAction}>Not going</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {tickets.length ? (
            <View style={styles.card}>
              <View style={styles.sectionHeadingRow}>
                <View style={styles.sectionIcon}><Text style={styles.sectionIconText}>◇</Text></View>
                <View style={styles.sectionHeadingCopy}>
                  <Text style={styles.sectionTitle}>Choose your experience</Text>
                  <Text style={styles.subtle}>Tap an option to see what’s included.</Text>
                </View>
              </View>

              {tickets.map((ticket) => {
                const expanded = expandedTicket === ticket.id;
                const admissions = (ticket as AdventureTicketType & { admissions_per_unit?: number }).admissions_per_unit ?? 1;
                return (
                  <Pressable
                    key={ticket.id}
                    style={[styles.ticketBox, expanded && styles.ticketBoxExpanded]}
                    onPress={() => setExpandedTicket(expanded ? null : ticket.id)}
                  >
                    <View style={styles.ticketRow}>
                      <View style={styles.ticketBadge}><Text style={styles.ticketBadgeText}>↗</Text></View>
                      <View style={styles.ticketCopy}>
                        <Text style={styles.ticketName}>{ticket.name}</Text>
                        <Text style={styles.subtle}>{admissions > 1 ? `Admission for ${admissions} people` : 'Admission for 1 person'}</Text>
                        <Text style={styles.ticketPrice}>{ticket.price_cents === 0 ? 'Free' : `$${Math.round(ticket.price_cents / 100)}`}</Text>
                      </View>
                      <Text style={styles.selectCircle}>{expanded ? '●' : '○'}</Text>
                    </View>
                    {expanded ? (
                      <View style={styles.ticketDetails}>
                        <Text style={styles.body}>{ticket.description || 'Standard admission for this experience.'}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.stickyBar}>
          <View style={styles.stickyCopy}>
            <Text style={styles.stickyTitle}>{priceLabel} · {spotsLabel}</Text>
            <Text style={styles.stickySubtitle}>{canCheckout ? 'Reserve your spot for this adventure.' : tickets.length ? 'Reservations are unavailable.' : 'Ticket options coming soon.'}</Text>
          </View>
          <Pressable
            style={[styles.primaryButton, !canCheckout && styles.disabled]}
            disabled={!canCheckout}
            onPress={() => router.push(`/checkout/${adventure.id}`)}
          >
            <Text style={styles.primaryButtonText}>{cancelled ? 'Cancelled' : soldOut ? 'Sold out' : tickets.length ? 'Reserve Spot' : 'Coming soon'}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0B120F' },
  screen: { flex: 1, backgroundColor: '#0B120F' },
  center: { flex: 1, backgroundColor: '#0B120F', alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 118, gap: 10 },
  tabletContent: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 18 },
  heroWrap: { borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: '#223028' },
  tabletHeroWrap: { borderRadius: 24 },
  hero: { height: 405, justifyContent: 'space-between', backgroundColor: '#24342B' },
  tabletHero: { height: 360 },
  heroRadius: { borderRadius: 22 },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(4,8,6,0.30)' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  heroButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(10,16,13,0.82)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  heroButtonText: { color: '#FFFDF6', fontSize: 30, lineHeight: 32 },
  heroBottom: { padding: 18, paddingTop: 80 },
  eyebrow: { color: '#F4C542', fontWeight: '900', letterSpacing: 1.1, fontSize: 11 },
  title: { color: '#FFFFFF', fontSize: 34, lineHeight: 38, fontWeight: '900', marginTop: 6, maxWidth: '94%' },
  heroMeta: { color: '#F2F4F2', marginTop: 10, fontSize: 15, fontWeight: '700' },
  heroLocation: { color: '#D8DEDA', marginTop: 5, fontSize: 14, lineHeight: 19, fontWeight: '700', maxWidth: '94%' },
  quickFacts: { flexDirection: 'row', backgroundColor: '#111A16', borderRadius: 16, borderWidth: 1, borderColor: '#26332C', paddingVertical: 12, paddingHorizontal: 6 },
  quickFact: { flex: 1, alignItems: 'center', paddingHorizontal: 3 },
  quickIcon: { color: '#F4C542', fontSize: 18, marginBottom: 4 },
  quickValue: { color: '#FFFFFF', fontWeight: '900', fontSize: 13, textAlign: 'center' },
  quickLabel: { color: '#8E9A93', fontSize: 10, marginTop: 2, textAlign: 'center' },
  notice: { backgroundColor: '#203429', borderRadius: 12, padding: 11, borderWidth: 1, borderColor: '#355241' },
  noticeText: { color: '#D7E5DC', fontWeight: '700' },
  error: { color: '#FFB4A9' },
  card: { backgroundColor: '#111A16', borderRadius: 16, padding: 15, borderWidth: 1, borderColor: '#26332C', gap: 10 },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionHeadingCopy: { flex: 1 },
  sectionIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#26372D', alignItems: 'center', justifyContent: 'center' },
  sectionIconText: { color: '#F4C542', fontSize: 18, fontWeight: '900' },
  sectionTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  body: { color: '#D2D9D4', fontSize: 14, lineHeight: 21 },
  subtle: { color: '#96A19A', fontSize: 12, lineHeight: 17 },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { color: '#EAF0EC', backgroundColor: '#294226', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, fontWeight: '800', fontSize: 12 },
  chipAlt: { color: '#D9EEF8', backgroundColor: '#183545', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, fontWeight: '800', fontSize: 12 },
  rsvpRow: { flexDirection: 'row', gap: 8 },
  rsvpButton: { flex: 1, borderWidth: 1, borderColor: '#4A5850', borderRadius: 10, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  rsvpActive: { backgroundColor: '#F4C542', borderColor: '#F4C542' },
  rsvpText: { color: '#EDF1EE', fontWeight: '800', fontSize: 13 },
  rsvpTextActive: { color: '#101610' },
  rsvpFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  visibilityButton: { minHeight: 48, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 11, borderWidth: 1, borderColor: '#34443A', backgroundColor: '#121C17', paddingHorizontal: 11, paddingVertical: 8 },
  visibilityIcon: { color: '#F4C542', fontSize: 18, fontWeight: '900' },
  visibilityCopy: { flex: 1 },
  visibilityLabel: { color: '#8E9A93', fontSize: 10, fontWeight: '700' },
  visibilityValue: { color: '#F4C542', fontSize: 13, fontWeight: '900', marginTop: 1 },
  secondaryAction: { color: '#9AA59E', fontSize: 12, textDecorationLine: 'underline' },
  ticketBox: { backgroundColor: '#151F1A', borderRadius: 13, borderWidth: 1, borderColor: '#2C3932', padding: 11 },
  ticketBoxExpanded: { borderColor: '#55665B' },
  ticketRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ticketBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2E542A', alignItems: 'center', justifyContent: 'center' },
  ticketBadgeText: { color: '#E6F3E7', fontSize: 17, fontWeight: '900' },
  ticketCopy: { flex: 1 },
  ticketName: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  ticketPrice: { color: '#79C94B', fontWeight: '900', fontSize: 14, marginTop: 2 },
  selectCircle: { color: '#B7C1BA', fontSize: 24 },
  ticketDetails: { borderTopWidth: 1, borderTopColor: '#28362F', marginTop: 10, paddingTop: 10 },
  stickyBar: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 92, backgroundColor: 'rgba(31,27,18,0.98)', borderTopWidth: 1, borderTopColor: '#5A4820', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  stickyCopy: { flex: 1 },
  stickyTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  stickySubtitle: { color: '#B6B8B2', fontSize: 11, marginTop: 2 },
  primaryButton: { minHeight: 48, minWidth: 140, borderRadius: 10, backgroundColor: '#F4C542', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryButtonText: { color: '#141309', fontWeight: '900', fontSize: 14 },
  disabled: { opacity: 0.48 },
});
