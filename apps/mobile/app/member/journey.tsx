import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMemberBasecamp } from '../../src/member/api';
import { getJourney, type JourneyItem } from '../../src/passport/api';
import { AppIcon } from '../../src/ui/AppIcon';

type JourneyYear = { year: string; items: JourneyItem[] };
type Milestone = { threshold: number; title: string; body: string };

const MILESTONES: Milestone[] = [
  { threshold: 50, title: '50 adventures', body: "Fifty adventures. That's a serious outdoor autobiography." },
  { threshold: 25, title: '25 adventures', body: 'Twenty-five adventures. This is becoming a way of life.' },
  { threshold: 10, title: '10 adventures', body: 'Double digits. Ten adventures are now part of your story.' },
  { threshold: 5, title: '5 adventures', body: 'Five adventures. Your Trail is taking shape.' },
  { threshold: 1, title: 'First adventure', body: 'Your first adventure is in the books.' },
];

function experiencedDate(item: JourneyItem) { return item.experienced_at || item.starts_at; }
function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Adventure complete';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function normalizePlace(item: JourneyItem) { return `${item.city ?? ''}|${item.state ?? ''}`.trim().toLowerCase(); }
function itemYear(item: JourneyItem) {
  const date = new Date(experiencedDate(item));
  return Number.isNaN(date.getTime()) ? 'Earlier' : String(date.getFullYear());
}

function TrailNode({ item, isLast }: { item: JourneyItem; isLast: boolean }) {
  const location = [item.city, item.state].filter(Boolean).join(', ');
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${item.title}, ${location}, ${formatDate(experiencedDate(item))}`} onPress={() => router.push(`/passport/memories/${item.adventure_id}` as never)} style={({ pressed }) => [styles.trailRow, pressed && styles.pressed]}>
      <View style={styles.railColumn}><View style={styles.nodeOuter}><View style={styles.nodeInner} /></View>{!isLast ? <View style={styles.rail} /> : null}</View>
      <View style={styles.trailCard}>
        <View style={styles.cardTopRow}><Text style={styles.dateText}>{formatDate(experiencedDate(item)).toUpperCase()}</Text><AppIcon name="chevron-forward" color="#7E8B83" size={17} /></View>
        <Text style={styles.adventureTitle}>{item.title}</Text>
        {location ? <Text style={styles.locationText}>{location}</Text> : null}
        <View style={styles.metaRow}>{item.category ? <View style={styles.pill}><Text style={styles.pillText}>{item.category}</Text></View> : null}<View style={styles.pill}><Text style={styles.pillText}>{item.photo_count} photo{item.photo_count === 1 ? '' : 's'}</Text></View></View>
        {item.highlight ? <Text style={styles.highlight}>“{item.highlight}”</Text> : null}
      </View>
    </Pressable>
  );
}

export default function JourneyScreen() {
  const [journey, setJourney] = useState<JourneyItem[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    Promise.all([getJourney(), getMemberBasecamp()])
      .then(([nextJourney, basecamp]) => { if (!active) return; setJourney(nextJourney); setProfile(basecamp?.profile ?? null); setError(null); })
      .catch((caught) => { if (!active) return; setError(caught instanceof Error ? caught.message : 'Unable to load your Trail.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const sortedJourney = useMemo(() => [...journey].sort((a, b) => new Date(experiencedDate(b)).getTime() - new Date(experiencedDate(a)).getTime()), [journey]);
  const years = useMemo<JourneyYear[]>(() => {
    const grouped = new Map<string, JourneyItem[]>();
    for (const item of sortedJourney) { const year = itemYear(item); grouped.set(year, [...(grouped.get(year) ?? []), item]); }
    return Array.from(grouped.entries()).map(([year, items]) => ({ year, items }));
  }, [sortedJourney]);
  const uniquePlaces = useMemo(() => new Set(journey.map(normalizePlace).filter(Boolean)).size, [journey]);
  const memoryCount = useMemo(() => journey.reduce((total, item) => total + (item.photo_count ?? 0), 0), [journey]);
  const activeYears = years.filter((group) => group.year !== 'Earlier').length;
  const milestone = MILESTONES.find((item) => journey.length >= item.threshold) ?? null;
  const nextMilestone = [...MILESTONES].reverse().find((item) => item.threshold > journey.length) ?? null;
  const latest = sortedJourney[0] ?? null;
  const currentYear = String(new Date().getFullYear());
  const currentYearItems = years.find((group) => group.year === currentYear)?.items ?? [];
  const currentYearPlaces = new Set(currentYearItems.map(normalizePlace).filter(Boolean)).size;
  const currentYearMemories = currentYearItems.reduce((sum, item) => sum + (item.photo_count ?? 0), 0);
  const favoriteCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of currentYearItems) if (item.category) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }, [currentYearItems]);

  async function shareTrail() {
    const name = profile?.display_name || 'My';
    await Share.share({ message: `${name} Go Melanated Trail: ${journey.length} adventures, ${uniquePlaces} places, ${memoryCount} saved memories across ${activeYears} year${activeYears === 1 ? '' : 's'}. Your outdoor life, remembered.` });
  }
  async function shareYear() {
    const name = profile?.display_name || 'My';
    await Share.share({ message: `${name} ${currentYear} outside: ${currentYearItems.length} adventures, ${currentYearPlaces} places and ${currentYearMemories} saved memories with Go Melanated.` });
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /></SafeAreaView>;

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.topRow}><Pressable onPress={() => router.back()} style={styles.backButton}><AppIcon name="chevron-back" color="#D7B45A" size={19} /><Text style={styles.back}>Profile</Text></Pressable>{journey.length ? <Pressable onPress={() => void shareTrail()} style={styles.shareButton}><AppIcon name="share" color="#142019" size={16} /><Text style={styles.shareButtonText}>Share</Text></Pressable> : null}</View>
    <View style={styles.heroCopy}><Text style={styles.eyebrow}>YOUR OUTDOOR LIFE, REMEMBERED</Text><Text style={styles.title}>Your Trail</Text><Text style={styles.subtitle}>Not a scoreboard. A living record of where you went, what stayed with you, and how your outdoor life keeps unfolding.</Text></View>
    {error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text></View> : null}
    {journey.length ? <>
      <View style={styles.summaryCard}><Text style={styles.summaryName}>{profile?.display_name || 'Your journey so far'}</Text><Text style={styles.summaryLocation}>{[profile?.home_city, profile?.home_state].filter(Boolean).join(', ') || 'Go Melanated'}</Text><View style={styles.statsRow}><View style={styles.stat}><Text style={styles.statNumber}>{journey.length}</Text><Text style={styles.statLabel}>Adventures</Text></View><View style={styles.statDivider} /><View style={styles.stat}><Text style={styles.statNumber}>{uniquePlaces}</Text><Text style={styles.statLabel}>Places</Text></View><View style={styles.statDivider} /><View style={styles.stat}><Text style={styles.statNumber}>{memoryCount}</Text><Text style={styles.statLabel}>Memories</Text></View><View style={styles.statDivider} /><View style={styles.stat}><Text style={styles.statNumber}>{activeYears}</Text><Text style={styles.statLabel}>Years</Text></View></View></View>
      {latest ? <Pressable style={styles.latestCard} onPress={() => router.push(`/passport/memories/${latest.adventure_id}` as never)}><Text style={styles.latestEyebrow}>YOUR LATEST CHAPTER</Text><Text style={styles.latestTitle}>{latest.title}</Text><Text style={styles.latestMeta}>{[latest.city, latest.state].filter(Boolean).join(', ')} · {formatDate(experiencedDate(latest))}</Text><Text style={styles.latestBody}>{latest.highlight || latest.reflection || 'This chapter is waiting for the memory you want to keep.'}</Text><View style={styles.latestFooter}><Text style={styles.latestLink}>Open this chapter</Text><AppIcon name="chevron-forward" color="#F0D083" size={18} /></View></Pressable> : null}
      {milestone ? <View style={styles.milestoneCard}><View style={styles.milestoneIcon}><AppIcon name="adventure" color="#F0D083" size={26} /></View><View style={styles.milestoneCopy}><Text style={styles.milestoneEyebrow}>MILESTONE ALONG THE WAY</Text><Text style={styles.milestoneTitle}>{milestone.title}</Text><Text style={styles.milestoneBody}>{milestone.body}</Text>{nextMilestone ? <Text style={styles.nextMilestone}>{nextMilestone.threshold - journey.length} more to your next chapter</Text> : null}</View></View> : null}
      {currentYearItems.length ? <View style={styles.yearOutsideCard}><Text style={styles.yearOutsideEyebrow}>YOUR {currentYear} OUTSIDE</Text><Text style={styles.yearOutsideTitle}>This year has a shape already.</Text><Text style={styles.yearOutsideBody}>{currentYearItems.length} adventure{currentYearItems.length === 1 ? '' : 's'} across {currentYearPlaces} place{currentYearPlaces === 1 ? '' : 's'}, with {currentYearMemories} saved memor{currentYearMemories === 1 ? 'y' : 'ies'}{favoriteCategory ? ` and a clear pull toward ${favoriteCategory.toLowerCase()}` : ''}.</Text><Pressable onPress={() => void shareYear()} style={styles.yearShare}><AppIcon name="share" color="#F0D083" size={16} /><Text style={styles.yearShareText}>Share your year outside</Text></Pressable></View> : null}
      <View style={styles.sectionIntro}><Text style={styles.sectionEyebrow}>THE STORY SO FAR</Text><Text style={styles.sectionTitle}>Follow your Trail</Text><Text style={styles.sectionBody}>Each year is a chapter. Tap an adventure to open the photos and reflections you saved there.</Text></View>
      {years.map((group, groupIndex) => { const expanded = expandedYears[group.year] ?? groupIndex === 0; const visibleItems = expanded ? group.items : group.items.slice(0, 2); return <View key={group.year} style={styles.yearSection}><Pressable style={styles.yearRow} onPress={() => setExpandedYears((current) => ({ ...current, [group.year]: !expanded }))}><View><Text style={styles.yearText}>{group.year}</Text><Text style={styles.yearCount}>{group.items.length} adventure{group.items.length === 1 ? '' : 's'}</Text></View><View style={styles.yearLine} /><AppIcon name={expanded ? 'chevron-up' : 'chevron-forward'} color="#D7B45A" size={18} /></Pressable>{visibleItems.map((item, index) => <TrailNode key={item.adventure_id} item={item} isLast={index === visibleItems.length - 1} />)}{!expanded && group.items.length > 2 ? <Pressable style={styles.moreButton} onPress={() => setExpandedYears((current) => ({ ...current, [group.year]: true }))}><Text style={styles.moreButtonText}>Show {group.items.length - 2} more from {group.year}</Text></Pressable> : null}</View>; })}
      <View style={styles.lifecycleCard}><Text style={styles.lifecycleEyebrow}>EVERY ADVENTURE HAS THREE MOMENTS</Text><View style={styles.lifecycleRow}><View style={styles.lifecycleIcon}><AppIcon name="calendar" color="#D7B45A" size={19} /></View><View style={styles.lifecycleCopy}><Text style={styles.lifecycleTitle}>Before</Text><Text style={styles.lifecycleBody}>Anticipation, planning and the things you do not want to forget.</Text></View></View><View style={styles.lifecycleRow}><View style={styles.lifecycleIcon}><AppIcon name="camera" color="#D7B45A" size={19} /></View><View style={styles.lifecycleCopy}><Text style={styles.lifecycleTitle}>During</Text><Text style={styles.lifecycleBody}>Photos and moments that become part of the chapter.</Text></View></View><View style={styles.lifecycleRow}><View style={styles.lifecycleIcon}><AppIcon name="photos" color="#D7B45A" size={19} /></View><View style={styles.lifecycleCopy}><Text style={styles.lifecycleTitle}>After</Text><Text style={styles.lifecycleBody}>Reflections, highlights and the memory you carry forward.</Text></View></View></View>
      <Pressable style={styles.memoryButton} onPress={() => router.push('/passport/memories' as never)}><AppIcon name="photos" color="#F0D083" size={20} /><View style={styles.memoryButtonCopy}><Text style={styles.memoryButtonTitle}>Keep the story growing</Text><Text style={styles.memoryButtonBody}>Add photos and reflections to the adventures already on your Trail.</Text></View><AppIcon name="chevron-forward" color="#D7B45A" size={19} /></Pressable>
    </> : <View style={styles.emptyCard}><View style={styles.emptyIcon}><AppIcon name="adventure" color="#D7B45A" size={32} /></View><Text style={styles.emptyEyebrow}>YOUR TRAIL STARTS HERE</Text><Text style={styles.emptyTitle}>Your first adventure becomes chapter one.</Text><Text style={styles.emptyBody}>Complete an official adventure and it will appear here automatically with its place, date and memories.</Text><Pressable style={styles.primaryButton} onPress={() => router.push('/(tabs)/explore' as never)}><Text style={styles.primaryButtonText}>Find your next adventure</Text></Pressable></View>}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#0F1713'},center:{flex:1,backgroundColor:'#0F1713',alignItems:'center',justifyContent:'center'},content:{padding:18,paddingBottom:110,gap:16},topRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},backButton:{minHeight:44,flexDirection:'row',alignItems:'center',gap:4},back:{color:'#D7B45A',fontWeight:'900',fontSize:15},shareButton:{minHeight:42,paddingHorizontal:14,borderRadius:999,backgroundColor:'#D7B45A',flexDirection:'row',alignItems:'center',gap:7},shareButtonText:{color:'#142019',fontWeight:'900',fontSize:12},heroCopy:{gap:5,paddingTop:4,paddingBottom:2},eyebrow:{color:'#D7B45A',fontSize:10,fontWeight:'900',letterSpacing:1.25},title:{color:'#FFF8E8',fontSize:38,lineHeight:42,fontWeight:'900'},subtitle:{color:'#A3ADA6',fontSize:14,lineHeight:21,maxWidth:560},errorCard:{backgroundColor:'#2C1C19',borderWidth:1,borderColor:'#6A3C33',borderRadius:16,padding:14},error:{color:'#FFB4A9',lineHeight:20},summaryCard:{backgroundColor:'#17211C',borderRadius:22,padding:18,borderWidth:1,borderColor:'#34483C',gap:4},summaryName:{color:'#FFF8E8',fontSize:22,fontWeight:'900'},summaryLocation:{color:'#98A49C',fontSize:12},statsRow:{flexDirection:'row',alignItems:'stretch',marginTop:15},stat:{flex:1,alignItems:'center',gap:2},statNumber:{color:'#F0D083',fontSize:23,fontWeight:'900'},statLabel:{color:'#A8B2AB',fontSize:10,fontWeight:'800'},statDivider:{width:1,backgroundColor:'#304139',marginVertical:3},latestCard:{backgroundColor:'#1B2A21',borderRadius:22,borderWidth:1,borderColor:'#425A49',padding:18,gap:6},latestEyebrow:{color:'#D7B45A',fontSize:9,fontWeight:'900',letterSpacing:1.1},latestTitle:{color:'#FFF8E8',fontSize:24,lineHeight:29,fontWeight:'900'},latestMeta:{color:'#9BA79F',fontSize:12},latestBody:{color:'#D5DDD8',fontSize:14,lineHeight:21,marginTop:5},latestFooter:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:6},latestLink:{color:'#F0D083',fontSize:12,fontWeight:'900'},milestoneCard:{backgroundColor:'#223128',borderRadius:20,borderWidth:1,borderColor:'#536A59',padding:16,flexDirection:'row',gap:13},milestoneIcon:{width:48,height:48,borderRadius:16,backgroundColor:'#17211C',alignItems:'center',justifyContent:'center'},milestoneCopy:{flex:1,gap:3},milestoneEyebrow:{color:'#D7B45A',fontSize:9,fontWeight:'900',letterSpacing:1},milestoneTitle:{color:'#FFF8E8',fontSize:18,fontWeight:'900'},milestoneBody:{color:'#CCD4CF',fontSize:13,lineHeight:19},nextMilestone:{color:'#F0D083',fontSize:11,fontWeight:'800',marginTop:5},yearOutsideCard:{backgroundColor:'#241F16',borderRadius:22,borderWidth:1,borderColor:'#66583A',padding:18,gap:6},yearOutsideEyebrow:{color:'#F0D083',fontSize:10,fontWeight:'900',letterSpacing:1},yearOutsideTitle:{color:'#FFF8E8',fontSize:22,fontWeight:'900'},yearOutsideBody:{color:'#D9D1C0',fontSize:13,lineHeight:20},yearShare:{marginTop:8,flexDirection:'row',alignItems:'center',gap:7,alignSelf:'flex-start',paddingVertical:8},yearShareText:{color:'#F0D083',fontSize:12,fontWeight:'900'},sectionIntro:{gap:3,marginTop:4},sectionEyebrow:{color:'#D7B45A',fontSize:9,fontWeight:'900',letterSpacing:1},sectionTitle:{color:'#FFF8E8',fontSize:24,fontWeight:'900'},sectionBody:{color:'#98A49C',fontSize:12,lineHeight:18},yearSection:{gap:0},yearRow:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:10,marginTop:2,minHeight:46},yearText:{color:'#F0D083',fontSize:18,fontWeight:'900'},yearCount:{color:'#77857D',fontSize:10,fontWeight:'700'},yearLine:{flex:1,height:1,backgroundColor:'#2C3B33'},trailRow:{flexDirection:'row',minHeight:118},pressed:{opacity:.78},railColumn:{width:28,alignItems:'center'},nodeOuter:{width:18,height:18,borderRadius:9,borderWidth:2,borderColor:'#D7B45A',alignItems:'center',justifyContent:'center',backgroundColor:'#0F1713',zIndex:2},nodeInner:{width:7,height:7,borderRadius:4,backgroundColor:'#D7B45A'},rail:{width:2,flex:1,backgroundColor:'#33463A',marginTop:4},trailCard:{flex:1,marginLeft:8,marginBottom:14,borderRadius:18,backgroundColor:'#17211C',borderWidth:1,borderColor:'#2C3B33',padding:14,gap:4},cardTopRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},dateText:{color:'#78867E',fontSize:9,fontWeight:'900',letterSpacing:.8},adventureTitle:{color:'#FFF8E8',fontSize:17,fontWeight:'900'},locationText:{color:'#A3ADA6',fontSize:11},metaRow:{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:5},pill:{backgroundColor:'#223129',borderRadius:999,paddingHorizontal:8,paddingVertical:4},pillText:{color:'#BFC9C3',fontSize:9,fontWeight:'800'},highlight:{color:'#E5DED0',fontSize:12,lineHeight:18,fontStyle:'italic',marginTop:6},moreButton:{alignSelf:'flex-start',marginLeft:36,marginBottom:14,paddingVertical:7},moreButtonText:{color:'#D7B45A',fontSize:11,fontWeight:'900'},lifecycleCard:{backgroundColor:'#141F19',borderRadius:22,borderWidth:1,borderColor:'#2D3E34',padding:16,gap:13},lifecycleEyebrow:{color:'#D7B45A',fontSize:9,fontWeight:'900',letterSpacing:1},lifecycleRow:{flexDirection:'row',gap:12,alignItems:'flex-start'},lifecycleIcon:{width:38,height:38,borderRadius:12,backgroundColor:'#213026',alignItems:'center',justifyContent:'center'},lifecycleCopy:{flex:1},lifecycleTitle:{color:'#FFF8E8',fontSize:14,fontWeight:'900'},lifecycleBody:{color:'#9DA9A2',fontSize:12,lineHeight:18,marginTop:2},memoryButton:{minHeight:72,borderRadius:18,borderWidth:1,borderColor:'#394D40',backgroundColor:'#18231D',padding:14,flexDirection:'row',alignItems:'center',gap:12},memoryButtonCopy:{flex:1},memoryButtonTitle:{color:'#FFF8E8',fontSize:14,fontWeight:'900'},memoryButtonBody:{color:'#8E9A92',fontSize:11,lineHeight:16,marginTop:2},emptyCard:{alignItems:'center',backgroundColor:'#17211C',borderRadius:24,padding:24,borderWidth:1,borderColor:'#34483C'},emptyIcon:{width:62,height:62,borderRadius:22,backgroundColor:'#223128',alignItems:'center',justifyContent:'center',marginBottom:14},emptyEyebrow:{color:'#D7B45A',fontSize:9,fontWeight:'900',letterSpacing:1},emptyTitle:{color:'#FFF8E8',fontSize:22,lineHeight:27,fontWeight:'900',textAlign:'center',marginTop:5},emptyBody:{color:'#A3ADA6',fontSize:13,lineHeight:20,textAlign:'center',marginTop:7},primaryButton:{minHeight:48,minWidth:210,borderRadius:16,alignItems:'center',justifyContent:'center',backgroundColor:'#D7B45A',marginTop:18,paddingHorizontal:18},primaryButtonText:{color:'#102018',fontSize:14,fontWeight:'900'}
});