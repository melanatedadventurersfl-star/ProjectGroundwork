import Ionicons from '@react-native-vector-icons/ionicons';
import { useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export type PlaceRecommendationValue = {
  name: string;
  location: string;
  category: string;
  tags: string[];
  cost: string;
  access: string;
  bestTime: string;
};

export const EMPTY_PLACE_RECOMMENDATION: PlaceRecommendationValue = {
  name: '',
  location: '',
  category: 'park',
  tags: [],
  cost: '',
  access: '',
  bestTime: '',
};

const GOLD = '#D7B45A';
const GOLD_MUTED = '#B79B58';
const TEXT = '#FFF8E8';
const MUTED = '#9AA69E';
const BORDER = '#34423A';
const FIELD = '#121C17';

const categories = [
  ['trail', 'Trail'],
  ['park', 'Park'],
  ['campground', 'Campground'],
  ['beach', 'Beach'],
  ['paddle', 'Paddle spot'],
  ['food', 'Food stop'],
  ['scenic', 'Scenic spot'],
  ['lodging', 'Lodging'],
  ['other', 'Other'],
] as const;

const tags = [
  'Family friendly',
  'Beginner friendly',
  'Dog friendly',
  'Free',
  'Good for groups',
  'Accessible',
  'Worth the drive',
  'Hidden gem',
];

function categoryLabel(value: string) {
  return categories.find(([key]) => key === value)?.[1] ?? 'Other';
}

export function PlaceRecommendationFields({ value, onChange }: { value: PlaceRecommendationValue; onChange: (next: PlaceRecommendationValue) => void }) {
  const [categoryOpen, setCategoryOpen] = useState(false);
  const locationRef = useRef<TextInput>(null);
  const costRef = useRef<TextInput>(null);
  const accessRef = useRef<TextInput>(null);
  const bestTimeRef = useRef<TextInput>(null);

  const update = (patch: Partial<PlaceRecommendationValue>) => onChange({ ...value, ...patch });

  function toggleTag(tag: string) {
    update({ tags: value.tags.includes(tag) ? value.tags.filter((item) => item !== tag) : [...value.tags, tag] });
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.headingRow}>
        <View style={styles.headingIcon}><Ionicons name="location-outline" size={17} color={GOLD} /></View>
        <View style={styles.flex}>
          <Text style={styles.heading}>Tell us about the place</Text>
          <Text style={styles.helper}>Add the useful details. Only the place and location are required.</Text>
        </View>
      </View>

      <TextInput
        value={value.name}
        onChangeText={(name) => update({ name })}
        placeholder="Place name *"
        placeholderTextColor="#748078"
        returnKeyType="next"
        blurOnSubmit={false}
        onSubmitEditing={() => locationRef.current?.focus()}
        style={styles.field}
      />
      <TextInput
        ref={locationRef}
        value={value.location}
        onChangeText={(location) => update({ location })}
        placeholder="City, area, or address *"
        placeholderTextColor="#748078"
        returnKeyType="next"
        blurOnSubmit={false}
        onSubmitEditing={() => costRef.current?.focus()}
        style={styles.field}
      />

      <Pressable style={styles.select} onPress={() => setCategoryOpen((open) => !open)}>
        <View style={styles.flex}>
          <Text style={styles.selectLabel}>TYPE OF PLACE</Text>
          <Text style={styles.selectValue}>{categoryLabel(value.category)}</Text>
        </View>
        <Ionicons name={categoryOpen ? 'chevron-up' : 'chevron-down'} size={17} color={MUTED} />
      </Pressable>
      {categoryOpen ? (
        <View style={styles.categoryList}>
          {categories.map(([key, label]) => (
            <Pressable key={key} style={styles.categoryRow} onPress={() => { update({ category: key }); setCategoryOpen(false); }}>
              <Text style={[styles.categoryText, key === value.category && styles.categoryTextActive]}>{label}</Text>
              {key === value.category ? <Ionicons name="checkmark" size={16} color={GOLD} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      <View>
        <Text style={styles.sectionLabel}>QUICK TAGS</Text>
        <View style={styles.tags}>
          {tags.map((tag) => {
            const active = value.tags.includes(tag);
            return (
              <Pressable key={tag} style={[styles.tag, active && styles.tagActive]} onPress={() => toggleTag(tag)}>
                {active ? <Ionicons name="checkmark" size={13} color="#101510" /> : null}
                <Text style={[styles.tagText, active && styles.tagTextActive]}>{tag}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.optionalGrid}>
        <TextInput
          ref={costRef}
          value={value.cost}
          onChangeText={(cost) => update({ cost })}
          placeholder="Cost / entry"
          placeholderTextColor="#748078"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => accessRef.current?.focus()}
          style={[styles.field, styles.halfField]}
        />
        <TextInput
          ref={accessRef}
          value={value.access}
          onChangeText={(access) => update({ access })}
          placeholder="Parking / access"
          placeholderTextColor="#748078"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => bestTimeRef.current?.focus()}
          style={[styles.field, styles.halfField]}
        />
      </View>
      <TextInput
        ref={bestTimeRef}
        value={value.bestTime}
        onChangeText={(bestTime) => update({ bestTime })}
        placeholder="Best time to go"
        placeholderTextColor="#748078"
        returnKeyType="done"
        onSubmitEditing={Keyboard.dismiss}
        style={styles.field}
      />
    </View>
  );
}

export function placeRecommendationMetadata(value: PlaceRecommendationValue) {
  return {
    place_name: value.name.trim(),
    place_location: value.location.trim(),
    place_category: value.category,
    place_tags: value.tags,
    place_cost: value.cost.trim(),
    place_access: value.access.trim(),
    place_best_time: value.bestTime.trim(),
  };
}

export function PlaceRecommendationSummary({ metadata }: { metadata: Record<string, unknown> }) {
  const name = typeof metadata.place_name === 'string' ? metadata.place_name : '';
  if (!name) return null;
  const location = typeof metadata.place_location === 'string' ? metadata.place_location : '';
  const category = typeof metadata.place_category === 'string' ? metadata.place_category : '';
  const rawTags = Array.isArray(metadata.place_tags) ? metadata.place_tags : [];
  const displayTags = rawTags.filter((tag): tag is string => typeof tag === 'string').slice(0, 3);
  const details = [
    typeof metadata.place_cost === 'string' ? metadata.place_cost : '',
    typeof metadata.place_access === 'string' ? metadata.place_access : '',
    typeof metadata.place_best_time === 'string' ? metadata.place_best_time : '',
  ].filter(Boolean);

  return (
    <View style={styles.summary}>
      <View style={styles.summaryTop}>
        <View style={styles.summaryPin}><Ionicons name="location" size={16} color={GOLD} /></View>
        <View style={styles.flex}>
          <Text style={styles.summaryName}>{name}</Text>
          {location ? <Text style={styles.summaryLocation}>{location}</Text> : null}
        </View>
        {category ? <Text style={styles.summaryCategory}>{categoryLabel(category).toUpperCase()}</Text> : null}
      </View>
      {displayTags.length ? (
        <View style={styles.summaryTags}>{displayTags.map((tag) => <Text key={tag} style={styles.summaryTag}>{tag}</Text>)}</View>
      ) : null}
      {details.length ? <Text style={styles.summaryDetails}>{details.join(' · ')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#37443C', paddingTop: 10, gap: 8 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  headingIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#1C2A23', alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  heading: { color: TEXT, fontSize: 13.5, fontWeight: '900' },
  helper: { color: MUTED, fontSize: 10.5, lineHeight: 14, marginTop: 1 },
  field: { minHeight: 42, borderWidth: 1, borderColor: BORDER, borderRadius: 11, backgroundColor: FIELD, color: TEXT, fontSize: 12.5, paddingHorizontal: 11, paddingVertical: 9 },
  select: { minHeight: 46, borderWidth: 1, borderColor: BORDER, borderRadius: 11, backgroundColor: FIELD, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectLabel: { color: '#718078', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  selectValue: { color: TEXT, fontSize: 12.5, fontWeight: '800', marginTop: 2 },
  categoryList: { borderWidth: 1, borderColor: BORDER, borderRadius: 11, overflow: 'hidden', backgroundColor: '#101914' },
  categoryRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER },
  categoryText: { flex: 1, color: '#C8D0CB', fontSize: 12 },
  categoryTextActive: { color: GOLD, fontWeight: '900' },
  sectionLabel: { color: '#718078', fontSize: 9, fontWeight: '900', letterSpacing: 0.55, marginBottom: 6 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { minHeight: 30, borderRadius: 99, borderWidth: 1, borderColor: '#3B4A41', paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 4 },
  tagActive: { backgroundColor: GOLD, borderColor: GOLD },
  tagText: { color: '#BAC4BD', fontSize: 10.5, fontWeight: '700' },
  tagTextActive: { color: '#101510', fontWeight: '900' },
  optionalGrid: { flexDirection: 'row', gap: 8 },
  halfField: { flex: 1 },
  summary: { borderWidth: 1, borderColor: '#34423A', borderRadius: 13, backgroundColor: '#142019', padding: 10, gap: 7 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryPin: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#1D2B24', alignItems: 'center', justifyContent: 'center' },
  summaryName: { color: TEXT, fontWeight: '900', fontSize: 14 },
  summaryLocation: { color: MUTED, fontSize: 10.5, marginTop: 1 },
  summaryCategory: { color: GOLD_MUTED, fontSize: 8.5, fontWeight: '900', letterSpacing: 0.4 },
  summaryTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  summaryTag: { color: '#D2DBD5', backgroundColor: '#1B2A22', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 4, fontSize: 9.5, fontWeight: '700' },
  summaryDetails: { color: '#8F9B93', fontSize: 10.5, lineHeight: 14 },
});
