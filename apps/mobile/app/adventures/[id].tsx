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
import { getPublicHostProfile, type PublicHostProfile } from '../../src/hosts/publicProfileApi';

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
  const [host, setHost] = useState<PublicHostProfile | null>(null);
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
      const nextAdventure = await getAdventure(id);
      const [nextTickets, nextRsvp, nextHost] = await Promise.all([
        listAdventureTicketTypes(id),
        getAdventureRsvpSummary(id),
        nextAdventure.created_by ? getPublicHostProfile(nextAdventure.created_by).catch(() => null) : Promise.resolve(null),
      ]);
      setAdventure(nextAdventure);
      setHost(nextHost);
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
  const canCheckout = !closed && tickets.length > 0;
  const heroLocation = adventure.venue_name
    ? `${adventure.venue_name} · ${adventure.city}, ${adventure.state}`
    : `${adventure.city}, ${adventure.state}`;
  const showTicketChoices = tickets.length > 1;
  const capacityLabel = adventure.spots_remaining != null
    ? `${adventure.spots_remaining} spots left`
    : adventure.capacity != null
      ? `${adventure.capacity} person capacity`
      : 'Open attendance';
  const hostName = host?.organization_name || host?.display_name || 'Melanated Adventurers';
  const hostSubtitle = host?.tagline || host?.bio || 'Building community through adventure and connection.';
  const hostInitials = hostName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'MA';

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
                <Text style={styles.heroMeta}>▣  {formatDate(adventure.starts_at)} · {formatTime(adventure.starts_at)}</Text>
                <Text style={styles.heroLocation}>⌖  {heroLocation}</Text>
                <View style={styles.heroChips}>
                  <Text style={styles.heroChipEasy}>{titleCase(adventure.difficulty)}</Text>
                  <Text style={styles.heroChipCategory}>{titleCase(adventure.category)}</Text>
                  <Text style={styles.heroChipPrice}>{priceLabel}</Text>
                </View>
                <View style={styles.heroAttendanceRow}>
                  <Text style={styles.heroAttendanceIcon}>♙</Text>
                  <Text style={styles.heroGoing}>{rsvp.going} going</Text>
                  <Text style={styles.heroAttendanceDot}>•</Text>
                  <Text style={styles.heroInterested}>{rsvp.interested} interested</Text>
                </View>
              </View>
            </ImageBackground>
          </View>

          <View style={styles.rsvpSection}>
            <View style={styles.rsvpRow}>
              <Pressable
                disabled={working}
                style={[styles.rsvpButton, rsvp.myStatus === 'interested' && styles.rsvpActiveSoft]}
                onPress={() => void chooseRsvp('interested')}
              >
                <Text style={styles.rsvpIcon}>{rsvp.myStatus === 'interested' ? '♥' : '♡'}</Text>
                <Text style={[styles.rsvpText, rsvp.myStatus === 'interested' && styles.rsvpTextSoft]}>Interested</Text>
              </Pressable>
              <Pressable
                disabled={working}
                style={[styles.rsvpButton, styles.goingButton, rsvp.myStatus !== 'going' && styles.goingButtonInactive]}
                onPress={() => void chooseRsvp('going')}
              >
                <Text style={[styles.goingCheck, rsvp.myStatus !== 'going' && styles.goingCheckInactive]}>{rsvp.myStatus === 'going' ? '✓' : '○'}</Text>
                <Text style={[styles.goingText, rsvp.myStatus !== 'going' && styles.goingTextInactive]}>Going</Text>
              </Pressable>
            </View>
            <Text style={styles.rsvpHint}>Let others know you’re coming.</Text>
          </View>

          {notice ? <View style={styles.notice}><Text style={styles.noticeText}>{notice}</Text></View> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.card}>
            <View style={styles.sectionHeadingRow}>
              <View style={styles.sectionIcon}><Text style={styles.sectionIconText}>♧</Text></View>
              <Text style={styles.sectionTitle}>About this adventure</Text>
            </View>
            <Text style={styles.body}>{adventure.description}</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeadingRow}>
              <View style={styles.sectionIcon}><Text style={styles.sectionIconText}>▦</Text></View>
              <Text style={styles.sectionTitle}>The plan</Text>
            </View>
            <View style={styles.planList}>
              <View style={styles.planRow}>
                <View style={styles.planRail}>
                  <View style={styles.planDot} />
                  <View style={styles.planLine} />
                </View>
                <View style={styles.planCopy}>
                  <Text style={styles.planTime}>{formatTime(adventure.starts_at)}</Text>
                  <Text style={styles.planText}>Meet at {adventure.venue_name || `${adventure.city}, ${adventure.state}`}</Text>
                </View>
              </View>
              {adventure.meeting_instructions ? (
                <View style={styles.planRow}>
                  <View style={styles.planRail}>
                    <View style={styles.planDot} />
                  </View>
                  <View style={styles.planCopy}>
                    <Text style={styles.planTime}>Meet-up notes</Text>
                    <Text style={styles.planText}>{adventure.meeting_instructions}</Text>
                  </View>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeadingRow}>
              <View style={styles.sectionIcon}><Text style={styles.sectionIconText}>?</Text></View>
              <Text style={styles.sectionTitle}>Good to know</Text>
            </View>
            <View style={styles.goodToKnowGrid}>
              <View style={styles.infoPill}>
                <Text style={styles.infoIcon}>◒</Text>
                <View style={styles.infoCopy}>
                  <Text style={styles.infoLabel}>Difficulty</Text>
                  <Text style={styles.infoValue}>{titleCase(adventure.difficulty)}</Text>
                </View>
              </View>
              <View style={styles.infoPill}>
                <Text style={styles.infoIcon}>↗</Text>
                <View style={styles.infoCopy}>
                  <Text style={styles.infoLabel}>Activity</Text>
                  <Text style={styles.infoValue}>{titleCase(adventure.category)}</Text>
                </View>
              </View>
              <View style={styles.infoPill}>
                <Text style={styles.infoIcon}>$</Text>
                <View style={styles.infoCopy}>
                  <Text style={styles.infoLabel}>Cost</Text>
                  <Text style={styles.infoValue}>{priceLabel}</Text>
                </View>
              </View>
              <View style={styles.infoPill}>
                <Text style={styles.infoIcon}>♙</Text>
                <View style={styles.infoCopy}>
                  <Text style={styles.infoLabel}>Availability</Text>
                  <Text style={styles.infoValue}>{capacityLabel}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeadingRow}>
              <View style={styles.sectionIcon}><Text style={styles.sectionIconText}>♙</Text></View>
              <Text style={styles.sectionTitle}>Who’s going</Text>
            </View>
            <View style={styles.peopleRow}>
              <View style={styles.peopleCountBubble}><Text style={styles.peopleCount}>{rsvp.going}</Text></View>
              <View style={styles.peopleCopy}>
                <Text style={styles.peopleTitle}>{rsvp.going === 1 ? '1 person is going' : `${rsvp.going} people are going`}</Text>
                <Text style={styles.subtle}>{rsvp.interested} {rsvp.interested === 1 ? 'person is' : 'people are'} interested</Text>
              </View>
            </View>
            <View style={styles.attendanceSettingsRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Attendance visibility: ${rsvp.myVisibility === 'private' ? 'Private' : 'Public'}. Tap to change.`}
                disabled={working}
                hitSlop={8}
                onPress={() => void toggleVisibility()}
              >
                <Text style={styles.attendanceSetting}>Attendance visible: {rsvp.myVisibility === 'private' ? 'Private' : 'Public'}  ›</Text>
              </Pressable>
              {rsvp.myStatus ? (
                <Pressable disabled={working} onPress={() => void chooseRsvp('not_going')}>
                  <Text style={styles.secondaryAction}>Not going</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeadingRow}>
              <View style={styles.sectionIcon}><Text style={styles.sectionIconText}>⌂</Text></View>
              <Text style={styles.sectionTitle}>Hosted by</Text>
            </View>
            <Pressable
              disabled={!host}
              style={styles.hostRow}
              accessibilityRole={host ? 'button' : undefined}
              accessibilityLabel={host ? `View ${hostName} host profile` : undefined}
              onPress={() => host ? router.push(`/host-profile/${host.id}`) : undefined}
            >
              <View style={styles.hostMark}><Text style={styles.hostMarkText}>{hostInitials}</Text></View>
              <View style={styles.hostCopy}>
                <Text style={styles.hostName}>{hostName}</Text>
                <Text style={styles.subtle} numberOfLines={2}>{hostSubtitle}</Text>
              </View>
              {host ? <Text style={styles.hostChevron}>›</Text> : null}
            </Pressable>
          </View>

          {showTicketChoices ? (
            <View style={styles.card}>
              <View style={styles.sectionHeadingRow}>
                <View style={styles.sectionIcon}><Text style={styles.sectionIconText}>◇</Text></View>
                <View style={styles.sectionHeadingCopy}>
                  <Text style={styles.sectionTitle}>Choose your experience</Text>
                  <Text style={styles.subtle}>Pick the option that works for you.</Text>
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
            <Text style={styles.stickyTitle}>{priceLabel}</Text>
            <Text style={styles.stickySubtitle}>{canCheckout ? 'Reserve your spot' : tickets.length ? 'Reservations are unavailable' : 'Ticket options coming soon'}</Text>
          </View>
          <Pressable
            style={[styles.primaryButton, !canCheckout && styles.disabled]}
            disabled={!canCheckout}
            onPress={() => router.push(`/checkout/${adventure.id}`)}
          >
            <Text style={styles.primaryButtonText}>{cancelled ? 'Cancelled' : soldOut ? 'Sold out' : tickets.length ? 'Reserve Spot  ›' : 'Coming soon'}</Text>
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
  content: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 104, gap: 12 },
  tabletContent: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 18 },
  heroWrap: { borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: '#223028' },
  tabletHeroWrap: { borderRadius: 24 },
  hero: { height: 454, justifyContent: 'space-between', backgroundColor: '#24342B' },
  tabletHero: { height: 430 },
  heroRadius: { borderRadius: 22 },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(4,8,6,0.30)' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  heroButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(10,16,13,0.82)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  heroButtonText: { color: '#FFFDF6', fontSize: 30, lineHeight: 32 },
  heroBottom: { padding: 18, paddingTop: 112, backgroundColor: 'rgba(5,10,7,0.20)' },
  eyebrow: { color: '#F4C542', fontWeight: '900', letterSpacing: 1.1, fontSize: 11 },
  title: { color: '#FFFFFF', fontSize: 34, lineHeight: 38, fontWeight: '900', marginTop: 6, maxWidth: '96%' },
  heroMeta: { color: '#F2F4F2', marginTop: 10, fontSize: 15, fontWeight: '700' },
  heroLocation: { color: '#D8DEDA', marginTop: 6, fontSize: 14, lineHeight: 19, fontWeight: '700', maxWidth: '96%' },
  heroChips: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 13 },
  heroChipEasy: { color: '#F3FAEF', backgroundColor: '#477842', paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, fontWeight: '900', fontSize: 12 },
  heroChipCategory: { color: '#EAF6FC', backgroundColor: '#2F6481', paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, fontWeight: '900', fontSize: 12 },
  heroChipPrice: { color: '#F4C542', backgroundColor: 'rgba(13,18,15,0.72)', borderColor: '#F4C542', borderWidth: 1, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, fontWeight: '900', fontSize: 12 },
  heroAttendanceRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginTop: 15 },
  heroAttendanceIcon: { color: '#E4E9E5', fontSize: 16, fontWeight: '900' },
  heroGoing: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  heroInterested: { color: '#CFD7D2', fontSize: 13, fontWeight: '700' },
  heroAttendanceDot: { color: '#89958E', fontSize: 11, fontWeight: '900' },
  rsvpSection: { paddingHorizontal: 4, paddingVertical: 4, gap: 8 },
  rsvpRow: { flexDirection: 'row', gap: 10 },
  rsvpButton: { flex: 1, minHeight: 52, borderRadius: 13, borderWidth: 1, borderColor: '#6B746F', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: '#101713' },
  rsvpActiveSoft: { borderColor: '#F4C542', backgroundColor: '#171B12' },
  rsvpIcon: { color: '#F4C542', fontSize: 22 },
  rsvpText: { color: '#F5F7F5', fontSize: 15, fontWeight: '900' },
  rsvpTextSoft: { color: '#F4C542' },
  goingButton: { backgroundColor: '#F4C542', borderColor: '#F4C542' },
  goingButtonInactive: { backgroundColor: '#101713', borderColor: '#6B746F' },
  goingCheck: { color: '#141309', fontSize: 17, fontWeight: '900' },
  goingCheckInactive: { color: '#F4C542' },
  goingText: { color: '#141309', fontSize: 15, fontWeight: '900' },
  goingTextInactive: { color: '#F5F7F5' },
  rsvpHint: { color: '#8E9A93', fontSize: 11.5, textAlign: 'center' },
  notice: { backgroundColor: '#203429', borderRadius: 12, padding: 11, borderWidth: 1, borderColor: '#355241' },
  noticeText: { color: '#D7E5DC', fontWeight: '700' },
  error: { color: '#FFB4A9' },
  card: { backgroundColor: '#111A16', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#223028', gap: 13 },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionHeadingCopy: { flex: 1 },
  sectionIcon: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#F4C542', alignItems: 'center', justifyContent: 'center' },
  sectionIconText: { color: '#F4C542', fontSize: 16, fontWeight: '900' },
  sectionTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  body: { color: '#D5DBD7', fontSize: 14, lineHeight: 22 },
  subtle: { color: '#96A19A', fontSize: 12, lineHeight: 17 },
  planList: { gap: 0 },
  planRow: { flexDirection: 'row', minHeight: 58 },
  planRail: { width: 22, alignItems: 'center' },
  planDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#F4C542', marginTop: 5 },
  planLine: { width: 2, flex: 1, backgroundColor: '#6B5A27', marginTop: 3 },
  planCopy: { flex: 1, paddingLeft: 8, paddingBottom: 14 },
  planTime: { color: '#F4C542', fontSize: 13, fontWeight: '900' },
  planText: { color: '#D5DBD7', fontSize: 13.5, lineHeight: 20, marginTop: 3 },
  goodToKnowGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  infoPill: { width: '48%', minHeight: 62, borderRadius: 13, backgroundColor: '#151F1A', borderWidth: 1, borderColor: '#26352D', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  infoIcon: { color: '#8CC456', fontSize: 20, fontWeight: '900' },
  infoCopy: { flex: 1 },
  infoLabel: { color: '#89958E', fontSize: 10.5, fontWeight: '700' },
  infoValue: { color: '#F2F5F3', fontSize: 12.5, fontWeight: '900', marginTop: 2 },
  peopleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  peopleCountBubble: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#243B2B', borderWidth: 1, borderColor: '#5E824B', alignItems: 'center', justifyContent: 'center' },
  peopleCount: { color: '#A8D879', fontSize: 18, fontWeight: '900' },
  peopleCopy: { flex: 1 },
  peopleTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  attendanceSettingsRow: { borderTopWidth: 1, borderTopColor: '#223028', paddingTop: 11, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  attendanceSetting: { color: '#9BA69F', fontSize: 11.5, fontWeight: '700' },
  secondaryAction: { color: '#9AA59E', fontSize: 11.5, textDecorationLine: 'underline' },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hostMark: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#18231D', borderWidth: 1, borderColor: '#F4C542', alignItems: 'center', justifyContent: 'center' },
  hostMarkText: { color: '#F4C542', fontSize: 14, fontWeight: '900' },
  hostCopy: { flex: 1 },
  hostName: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', marginBottom: 2 },
  hostChevron: { color: '#7F8C85', fontSize: 26, fontWeight: '700' },
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
  stickyBar: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 78, backgroundColor: 'rgba(18,19,15,0.98)', borderTopWidth: 1, borderTopColor: '#463A20', paddingHorizontal: 14, paddingTop: 9, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  stickyCopy: { flex: 1 },
  stickyTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  stickySubtitle: { color: '#AEB4AF', fontSize: 10.5, marginTop: 1 },
  primaryButton: { minHeight: 46, minWidth: 144, borderRadius: 12, backgroundColor: '#F4C542', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryButtonText: { color: '#141309', fontWeight: '900', fontSize: 13.5 },
  disabled: { opacity: 0.44 },
});