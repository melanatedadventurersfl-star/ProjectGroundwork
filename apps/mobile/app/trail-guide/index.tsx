import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '../../src/ui/AppIcon';

type GuideCategory = 'All' | 'Camping' | 'Hiking' | 'Water' | 'Safety' | 'Gear' | 'Weather' | 'Family';

type GuideTip = {
  id: string;
  category: Exclude<GuideCategory, 'All'>;
  title: string;
  summary: string;
  bullets: string[];
};

const categories: GuideCategory[] = ['All', 'Camping', 'Hiking', 'Water', 'Safety', 'Gear', 'Weather', 'Family'];

const tips: GuideTip[] = [
  {
    id: 'camp-first-night',
    category: 'Camping',
    title: 'Your first night at camp',
    summary: 'A simple setup order that keeps camp comfortable before the sun disappears.',
    bullets: ['Choose level, well-drained ground.', 'Set up shelter before unpacking the rest of camp.', 'Keep food and scented items secured away from your sleeping area.'],
  },
  {
    id: 'camp-sleep',
    category: 'Camping',
    title: 'Sleep warmer and drier',
    summary: 'Comfort at camp starts underneath you, not just with a thicker blanket.',
    bullets: ['Use an insulated sleeping pad or mattress.', 'Change out of damp clothes before bed.', 'Keep tomorrow’s clothes dry inside your shelter.'],
  },
  {
    id: 'hike-pack',
    category: 'Hiking',
    title: 'Pack for a day hike',
    summary: 'Carry enough for a delay without turning your backpack into a moving truck.',
    bullets: ['Bring water, snacks, navigation and sun protection.', 'Pack a light rain layer even when the morning is clear.', 'Carry a small first-aid kit and a charged phone or battery.'],
  },
  {
    id: 'hike-pace',
    category: 'Hiking',
    title: 'Choose a trail you will enjoy',
    summary: 'Distance is only half the story. Elevation, heat and terrain can change the whole hike.',
    bullets: ['Check distance and elevation gain.', 'Start easier than your maximum ability.', 'Turn around early if weather, daylight or energy changes.'],
  },
  {
    id: 'water-basics',
    category: 'Water',
    title: 'Water-day basics',
    summary: 'A few habits make paddling, floating and shoreline adventures dramatically safer.',
    bullets: ['Wear a properly fitted life jacket when appropriate.', 'Protect your phone and essentials in a dry bag.', 'Check wind, current and weather before entering the water.'],
  },
  {
    id: 'safety-plan',
    category: 'Safety',
    title: 'Leave a simple trip plan',
    summary: 'Someone should know where you are going and when to expect you back.',
    bullets: ['Share the trail, park or campground name.', 'Include your expected return time.', 'Update your contact if your plans change.'],
  },
  {
    id: 'gear-buy',
    category: 'Gear',
    title: 'What to buy first',
    summary: 'Build your gear closet around comfort and safety before chasing every shiny gadget.',
    bullets: ['Prioritize footwear, shelter and sleep comfort.', 'Rent or borrow specialty gear before buying.', 'Test new gear at home before depending on it outside.'],
  },
  {
    id: 'weather-heat',
    category: 'Weather',
    title: 'Heat changes the plan',
    summary: 'Hot weather affects pace, water needs and how long an otherwise easy outing feels.',
    bullets: ['Start earlier when temperatures are lower.', 'Drink regularly instead of waiting until you feel thirsty.', 'Use shade, breaks and sun protection aggressively.'],
  },
  {
    id: 'family-kids',
    category: 'Family',
    title: 'Make outside fun for kids',
    summary: 'A shorter adventure with room to explore usually beats a rigid mileage goal.',
    bullets: ['Plan around breaks, snacks and curiosity.', 'Give kids a small job or piece of gear to own.', 'Have a comfortable exit plan before anyone is exhausted.'],
  },
];

export default function TrailGuideScreen() {
  const [category, setCategory] = useState<GuideCategory>('All');
  const [openTip, setOpenTip] = useState<string | null>('camp-first-night');
  const visibleTips = useMemo(() => category === 'All' ? tips : tips.filter((tip) => tip.category === category), [category]);

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <AppIcon name="chevron-forward" color="#D7B45A" size={22} style={{ transform: [{ rotate: '180deg' }] }} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <Text style={styles.eyebrow}>FIELD KNOWLEDGE</Text>
        <Text style={styles.title}>Trail Guide</Text>
        <Text style={styles.intro}>Practical outdoor tips for getting comfortable, staying prepared, and enjoying more time outside.</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
          {categories.map((value) => (
            <Pressable key={value} onPress={() => setCategory(value)} style={[styles.categoryChip, category === value && styles.categoryChipActive]}>
              <Text style={[styles.categoryText, category === value && styles.categoryTextActive]}>{value}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.featured}>
          <View style={styles.featuredIcon}><AppIcon name="guide" color="#17211C" size={24} /></View>
          <View style={styles.featuredCopy}>
            <Text style={styles.featuredEyebrow}>START HERE</Text>
            <Text style={styles.featuredTitle}>New to the outdoors?</Text>
            <Text style={styles.featuredBody}>Start small, learn one skill at a time, and choose adventures that leave you wanting to come back.</Text>
          </View>
        </View>

        <View style={styles.sectionRow}><Text style={styles.sectionTitle}>{category === 'All' ? 'Popular Guides' : `${category} Guides`}</Text><Text style={styles.count}>{visibleTips.length}</Text></View>

        {visibleTips.map((tip) => {
          const open = openTip === tip.id;
          return (
            <Pressable key={tip.id} onPress={() => setOpenTip(open ? null : tip.id)} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.cardCopy}>
                  <Text style={styles.cardCategory}>{tip.category.toUpperCase()}</Text>
                  <Text style={styles.cardTitle}>{tip.title}</Text>
                  <Text style={styles.cardSummary}>{tip.summary}</Text>
                </View>
                <AppIcon name="chevron-forward" color="#D7B45A" size={21} style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }} />
              </View>
              {open ? <View style={styles.details}>{tip.bullets.map((bullet) => <View key={bullet} style={styles.bulletRow}><View style={styles.bullet} /><Text style={styles.bulletText}>{bullet}</Text></View>)}</View> : null}
            </Pressable>
          );
        })}

        <View style={styles.footerCard}>
          <Text style={styles.footerTitle}>Keep building the guide</Text>
          <Text style={styles.footerText}>This is the first field-manual pass. We can keep adding checklists, seasonal advice, gear explainers, campsite etiquette, navigation, food, first aid and skill guides without changing the structure.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' },
  content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 72, gap: 14 },
  back: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { color: '#D7B45A', fontWeight: '900' },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginTop: 4 },
  title: { color: '#FFF8E8', fontSize: 36, lineHeight: 40, fontWeight: '900' },
  intro: { color: '#AEB8B2', fontSize: 15, lineHeight: 22, maxWidth: 520 },
  categories: { gap: 8, paddingRight: 12, paddingVertical: 2 },
  categoryChip: { borderWidth: 1, borderColor: '#405047', backgroundColor: '#17211C', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  categoryChipActive: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' },
  categoryText: { color: '#D7DFDA', fontSize: 12, fontWeight: '800' },
  categoryTextActive: { color: '#17211C' },
  featured: { flexDirection: 'row', gap: 13, borderRadius: 20, borderWidth: 1, borderColor: '#44594D', backgroundColor: '#1C2B23', padding: 16 },
  featuredIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' },
  featuredCopy: { flex: 1 },
  featuredEyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  featuredTitle: { color: '#FFF8E8', fontSize: 19, fontWeight: '900', marginTop: 3 },
  featuredBody: { color: '#B8C3BC', fontSize: 13, lineHeight: 19, marginTop: 4 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  sectionTitle: { color: '#FFF8E8', fontSize: 21, fontWeight: '900' },
  count: { color: '#85928A', fontSize: 12, fontWeight: '800' },
  card: { borderRadius: 18, borderWidth: 1, borderColor: '#2C3B33', backgroundColor: '#17211C', padding: 15 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardCopy: { flex: 1 },
  cardCategory: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: .8 },
  cardTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900', marginTop: 3 },
  cardSummary: { color: '#AEB8B2', fontSize: 13, lineHeight: 19, marginTop: 5 },
  details: { borderTopWidth: 1, borderTopColor: '#2B3932', marginTop: 12, paddingTop: 12, gap: 9 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#67CFC8', marginTop: 7 },
  bulletText: { color: '#D0D8D3', fontSize: 13, lineHeight: 20, flex: 1 },
  footerCard: { borderRadius: 18, backgroundColor: '#111A17', borderWidth: 1, borderColor: '#28362E', padding: 16, marginTop: 4 },
  footerTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' },
  footerText: { color: '#8F9C94', fontSize: 12.5, lineHeight: 19, marginTop: 5 },
});
