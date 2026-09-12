import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  loadTrailGuideStructuredData,
  trailGuideBoolean,
  trailGuideNumber,
  trailGuidePrimarySource,
  trailGuideString,
  trailGuideStringArray,
  type TrailGuideStructuredData,
} from './placeData';
import { AppIcon } from '../ui/AppIcon';

type Props = {
  placeId: string;
  category: string;
  fallbackDetails: string[];
  formattedAddress?: string | null;
  weekdayDescription?: string | null;
};

type Essential = {
  key: string;
  icon: string;
  label: string;
  value: string;
  note?: string | null;
};

type QuickDetail = {
  icon: string;
  label: string;
  value: string;
};

function money(value: number | null) {
  return value == null ? null : `$${value.toFixed(2)}`;
}

function formatSourceDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function essentialCards(data: TrailGuideStructuredData): Essential[] {
  const electric = trailGuideBoolean(data, 'electric.available');
  const electricScope = trailGuideString(data, 'electric.scope');
  const voltage = trailGuideNumber(data, 'electric.voltage');
  const amps = trailGuideStringArray(data, 'electric.amps');
  const waterHookup = trailGuideBoolean(data, 'water.hookup');
  const centralWater = trailGuideBoolean(data, 'water.potable_central');
  const sewerHookup = trailGuideBoolean(data, 'sewer.hookup');
  const dumpStation = trailGuideBoolean(data, 'dump_station.available');
  const tent = trailGuideBoolean(data, 'camping.tent');
  const rv = trailGuideBoolean(data, 'camping.rv');
  const showers = trailGuideBoolean(data, 'amenities.showers');
  const restrooms = trailGuideBoolean(data, 'amenities.restrooms');
  const pets = trailGuideBoolean(data, 'pets.allowed');
  const petMax = trailGuideNumber(data, 'pets.max_per_site');

  const electricParts = [
    electricScope === 'all_sites' ? 'All sites' : electricScope,
    voltage ? `${voltage}V` : null,
    amps?.length ? amps.map((amp) => `${amp}A`).join(' / ') : null,
  ].filter(Boolean);

  return [
    electric == null ? null : {
      key: 'electric', icon: '⚡', label: 'Electric',
      value: electric ? (electricParts[0] || 'Available') : 'None',
      note: electric ? electricParts.slice(1).join(' · ') : null,
    },
    waterHookup == null && centralWater == null ? null : {
      key: 'water', icon: '💧', label: 'Water',
      value: waterHookup ? 'Site hookup' : centralWater ? 'Central only' : 'No hookup',
      note: waterHookup ? null : centralWater ? 'No site hookup' : null,
    },
    sewerHookup == null && dumpStation == null ? null : {
      key: 'sewer', icon: '🚽', label: 'Sewer',
      value: sewerHookup ? 'Site hookup' : 'No hookup',
      note: dumpStation ? 'Dump station' : null,
    },
    tent == null && rv == null ? null : {
      key: 'camping', icon: '🏕️', label: 'Camping',
      value: [tent ? 'Tent' : null, rv ? 'RV' : null].filter(Boolean).join(' + ') || 'Check source',
    },
    showers == null && restrooms == null ? null : {
      key: 'facilities', icon: '🚿', label: 'Facilities',
      value: [showers ? 'Showers' : null, restrooms ? 'Restrooms' : null].filter(Boolean).join(' + ') || 'Limited',
    },
    pets == null ? null : {
      key: 'pets', icon: '🐾', label: 'Pets',
      value: pets ? 'Allowed' : 'Not allowed',
      note: pets && petMax ? `${petMax} per site` : null,
    },
  ].filter((item): item is Essential => Boolean(item));
}

function quickDetails(data: TrailGuideStructuredData): QuickDetail[] {
  const maxPeople = trailGuideNumber(data, 'occupancy.max_people');
  const checkIn = trailGuideString(data, 'check_in.time');
  const checkOut = trailGuideString(data, 'check_out.time');
  const quietHours = trailGuideString(data, 'quiet_hours.range');
  const fourWheelDrive = trailGuideBoolean(data, 'beach_driving.four_wheel_drive_recommended');
  const petFee = trailGuideNumber(data, 'pets.fee');

  return [
    maxPeople != null ? { icon: '👥', label: 'Capacity', value: `${maxPeople} people/site` } : null,
    checkIn ? { icon: '🕐', label: 'Check-in', value: checkIn } : null,
    checkOut ? { icon: '↪', label: 'Check-out', value: checkOut } : null,
    quietHours ? { icon: '🌙', label: 'Quiet hours', value: quietHours } : null,
    fourWheelDrive ? { icon: '🚙', label: 'Beach access', value: '4WD recommended' } : null,
    petFee != null ? { icon: '🐕', label: 'Pet fee', value: `${money(petFee)} / stay` } : null,
  ].filter((item): item is QuickDetail => Boolean(item));
}

function amenityLabels(data: TrailGuideStructuredData) {
  const candidates = [
    ['amenities.showers', 'Showers'],
    ['amenities.restrooms', 'Restrooms'],
    ['amenities.picnic_tables', 'Picnic tables'],
    ['amenities.playground', 'Playground'],
    ['amenities.concession', 'Concession'],
    ['amenities.laundry', 'Laundry'],
    ['amenities.wifi', 'Wi-Fi'],
    ['dump_station.available', 'Dump station'],
    ['launch.nonmotorized', 'Kayak / paddle launch'],
    ['launch.boat', 'Boat launch'],
    ['activities.swimming', 'Swimming'],
    ['activities.fishing', 'Fishing'],
    ['activities.surfing', 'Surfing'],
    ['activities.hiking', 'Hiking'],
    ['activities.birding', 'Birding'],
  ] as const;
  return candidates.filter(([field]) => trailGuideBoolean(data, field) === true).map(([, label]) => label);
}

function expectItems(data: TrailGuideStructuredData) {
  const notes: string[] = [];
  if (trailGuideBoolean(data, 'beach_driving.four_wheel_drive_recommended')) notes.push('Soft-sand access');
  if (trailGuideBoolean(data, 'water.hookup') === false && trailGuideBoolean(data, 'water.potable_central')) notes.push('Bring a water plan');
  if (trailGuideBoolean(data, 'sewer.hookup') === false && trailGuideBoolean(data, 'dump_station.available')) notes.push('Dump station instead of sewer hookup');
  if (trailGuideBoolean(data, 'generators.off_during_quiet_hours')) notes.push('Generators off during quiet hours');
  if (trailGuideBoolean(data, 'pets.shoreline_allowed') === false) notes.push('Pets stay off shoreline');
  return notes.slice(0, 4);
}

export function TrailGuidePlacePracticalDetails({
  placeId,
  category,
  fallbackDetails,
  formattedAddress,
  weekdayDescription,
}: Props) {
  const [data, setData] = useState<TrailGuideStructuredData | null>(null);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    let active = true;
    setData(null);
    setShowMore(false);
    void loadTrailGuideStructuredData(placeId)
      .then((result) => { if (active) setData(result); })
      .catch(() => { if (active) setData(null); });
    return () => { active = false; };
  }, [placeId]);

  const essentials = useMemo(() => data && category === 'Camping' ? essentialCards(data) : [], [category, data]);
  const quick = useMemo(() => data ? quickDetails(data) : [], [data]);
  const amenities = useMemo(() => data ? amenityLabels(data) : [], [data]);
  const expectations = useMemo(() => data ? expectItems(data) : [], [data]);

  if (!data || !Object.keys(data.facts).length) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick read</Text>
        <View style={styles.fallbackCard}>
          {fallbackDetails.slice(0, 3).map((detail) => <Text key={detail} style={styles.fallbackText}>• {detail}</Text>)}
          {formattedAddress ? <Text style={styles.muted}>{formattedAddress}</Text> : null}
          {weekdayDescription ? <Text style={styles.muted}>{weekdayDescription}</Text> : null}
        </View>
      </View>
    );
  }

  const tentPrice = trailGuideNumber(data, 'pricing.tent_total') ?? trailGuideNumber(data, 'pricing.tent_base');
  const rvPrice = trailGuideNumber(data, 'pricing.rv_total') ?? trailGuideNumber(data, 'pricing.rv_base');
  const reservationSource = data.sources.find((source) => source.sourceType === 'reservation') ?? null;
  const source = trailGuidePrimarySource(data);
  const sourceDate = formatSourceDate(source?.sourceDate);

  return (
    <View style={styles.section}>
      {(tentPrice != null || rvPrice != null) ? (
        <View style={styles.priceBand}>
          {tentPrice != null ? <View style={styles.priceCell}><Text style={styles.priceValue}>{money(tentPrice)}</Text><Text style={styles.priceLabel}>Tent / night</Text></View> : null}
          {tentPrice != null && rvPrice != null ? <View style={styles.priceDivider} /> : null}
          {rvPrice != null ? <View style={styles.priceCell}><Text style={styles.priceValue}>{money(rvPrice)}</Text><Text style={styles.priceLabel}>RV / night</Text></View> : null}
        </View>
      ) : null}

      {essentials.length ? (
        <View style={styles.card}>
          <View style={styles.headerRow}><Text style={styles.cardTitle}>Campsite essentials</Text><Text style={styles.headerHint}>At a glance</Text></View>
          <View style={styles.essentialGrid}>
            {essentials.map((item) => (
              <View key={item.key} style={styles.essentialCell}>
                <Text style={styles.essentialIcon}>{item.icon}</Text>
                <Text style={styles.essentialLabel}>{item.label}</Text>
                <Text numberOfLines={2} style={styles.essentialValue}>{item.value}</Text>
                {item.note ? <Text numberOfLines={1} style={styles.essentialNote}>{item.note}</Text> : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {reservationSource ? (
        <Pressable onPress={() => void Linking.openURL(reservationSource.sourceUrl)} style={({ pressed }) => [styles.reserveButton, pressed && styles.pressed]}>
          <AppIcon name="calendar" color="#17211C" size={18} />
          <Text style={styles.reserveText}>Reserve campsite</Text>
        </Pressable>
      ) : null}

      {quick.length ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Good to know</Text>
          <View style={styles.quickGrid}>
            {quick.map((item) => (
              <View key={`${item.label}-${item.value}`} style={styles.quickItem}>
                <Text style={styles.quickIcon}>{item.icon}</Text>
                <View style={{ flex: 1 }}><Text style={styles.quickLabel}>{item.label}</Text><Text style={styles.quickValue}>{item.value}</Text></View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {expectations.length ? (
        <View style={styles.expectCard}>
          <View style={styles.expectHeader}><Text style={styles.expectBulb}>💡</Text><Text style={styles.cardTitle}>What to expect</Text></View>
          <View style={styles.expectChips}>{expectations.map((item) => <View key={item} style={styles.expectChip}><Text style={styles.expectChipText}>{item}</Text></View>)}</View>
        </View>
      ) : null}

      <Pressable onPress={() => setShowMore((current) => !current)} style={styles.moreButton}>
        <View><Text style={styles.moreTitle}>{showMore ? 'Hide campground details' : 'More campground details'}</Text><Text style={styles.moreHint}>Amenities, rules, address, and official source</Text></View>
        <AppIcon name={showMore ? 'chevron-up' : 'chevron-forward'} color="#D7B45A" size={18} />
      </Pressable>

      {showMore ? (
        <View style={styles.morePanel}>
          {amenities.length ? <View style={styles.chips}>{amenities.map((item) => <View key={item} style={styles.chip}><Text style={styles.chipText}>{item}</Text></View>)}</View> : null}
          {data.address || formattedAddress ? <Text style={styles.infoLine}>{data.address || formattedAddress}</Text> : null}
          {weekdayDescription ? <Text style={styles.infoLine}>{weekdayDescription}</Text> : null}
          {source ? (
            <Pressable onPress={() => void Linking.openURL(source.sourceUrl)} style={styles.sourceStrip}>
              <View style={styles.sourceDot} />
              <View style={{ flex: 1 }}><Text style={styles.sourceTitle}>Verified from {data.operatorName || source.sourceName}</Text><Text style={styles.sourceMeta}>{sourceDate ? `Source dated ${sourceDate} · ` : ''}View official source</Text></View>
              <AppIcon name="open" color="#8EBE82" size={14} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 12, gap: 11 },
  sectionTitle: { color: '#FFF8E8', fontSize: 17, fontWeight: '900' },
  card: { borderRadius: 17, borderWidth: 1, borderColor: '#243128', backgroundColor: '#101914', padding: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' },
  headerHint: { color: '#7C8980', fontSize: 9, fontWeight: '800' },
  priceBand: { minHeight: 72, borderRadius: 16, borderWidth: 1, borderColor: '#28362D', backgroundColor: '#121C16', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  priceCell: { flex: 1, alignItems: 'center' },
  priceDivider: { width: 1, height: 36, backgroundColor: '#2A382F' },
  priceValue: { color: '#FFF8E8', fontSize: 22, lineHeight: 25, fontWeight: '900' },
  priceLabel: { color: '#88958D', fontSize: 9.5, marginTop: 2, fontWeight: '700' },
  essentialGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  essentialCell: { width: '31.4%', minHeight: 108, borderRadius: 13, borderWidth: 1, borderColor: '#2A382F', backgroundColor: '#152019', padding: 9 },
  essentialIcon: { fontSize: 18, marginBottom: 6 },
  essentialLabel: { color: '#F6F1E7', fontSize: 10, fontWeight: '900' },
  essentialValue: { color: '#D7DFDA', fontSize: 10, lineHeight: 14, fontWeight: '800', marginTop: 4 },
  essentialNote: { color: '#77847C', fontSize: 8.5, marginTop: 3 },
  reserveButton: { minHeight: 48, borderRadius: 14, backgroundColor: '#D7B45A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  reserveText: { color: '#17211C', fontSize: 14, fontWeight: '900' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 7 },
  quickItem: { width: '50%', minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingRight: 8 },
  quickIcon: { fontSize: 15, width: 22, textAlign: 'center' },
  quickLabel: { color: '#7B8880', fontSize: 8.5, fontWeight: '800', textTransform: 'uppercase' },
  quickValue: { color: '#D9E0DB', fontSize: 10.5, fontWeight: '800', marginTop: 2 },
  expectCard: { borderRadius: 17, borderWidth: 1, borderColor: '#304036', backgroundColor: '#122019', padding: 12 },
  expectHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  expectBulb: { fontSize: 16 },
  expectChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 },
  expectChip: { borderRadius: 999, backgroundColor: '#1A2B20', borderWidth: 1, borderColor: '#34503B', paddingHorizontal: 9, paddingVertical: 6 },
  expectChipText: { color: '#AFC7B6', fontSize: 9.5, fontWeight: '800' },
  moreButton: { minHeight: 58, borderRadius: 15, borderWidth: 1, borderColor: '#29382F', backgroundColor: '#101914', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  moreTitle: { color: '#F3EEE3', fontSize: 12, fontWeight: '900' },
  moreHint: { color: '#748178', fontSize: 8.5, marginTop: 3 },
  morePanel: { borderRadius: 15, borderWidth: 1, borderColor: '#243128', backgroundColor: '#0F1712', padding: 12, gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: '#34463B', backgroundColor: '#17211C', paddingHorizontal: 9, paddingVertical: 6 },
  chipText: { color: '#B8C3BC', fontSize: 9, fontWeight: '700' },
  infoLine: { color: '#9AA69F', fontSize: 10.5, lineHeight: 16 },
  sourceStrip: { flexDirection: 'row', alignItems: 'center', gap: 9, borderTopWidth: 1, borderTopColor: '#26352C', paddingTop: 10 },
  sourceDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#6FA765' },
  sourceTitle: { color: '#D8E2DB', fontSize: 10.5, fontWeight: '900' },
  sourceMeta: { color: '#748178', fontSize: 8.5, marginTop: 2 },
  fallbackCard: { marginTop: 8, borderRadius: 15, borderWidth: 1, borderColor: '#29372F', backgroundColor: '#111914', padding: 12, gap: 7 },
  fallbackText: { color: '#C5CEC8', fontSize: 11, lineHeight: 16 },
  muted: { color: '#78847D', fontSize: 9.5, lineHeight: 14 },
  pressed: { opacity: 0.78 },
});