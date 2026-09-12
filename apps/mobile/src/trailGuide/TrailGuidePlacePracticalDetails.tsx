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

type MoreProps = {
  placeId: string;
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

function formatVerifiedDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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

function ruleLabels(data: TrailGuideStructuredData) {
  const rules: string[] = [];
  if (trailGuideBoolean(data, 'fires.rings_only')) rules.push('Fires in designated rings');
  if (trailGuideBoolean(data, 'generators.off_during_quiet_hours')) rules.push('Generators off during quiet hours');
  if (trailGuideBoolean(data, 'alcohol.allowed') === false) rules.push('No alcohol');
  if (trailGuideBoolean(data, 'hammocks.on_trees_allowed') === false) rules.push('No hammocks on trees');
  if (trailGuideBoolean(data, 'pets.shoreline_allowed') === false) rules.push('Pets stay off shoreline');
  if (trailGuideBoolean(data, 'vehicles.golf_carts_atvs_utvs_allowed') === false) rules.push('No golf carts, ATVs, or UTVs');
  return rules;
}

function expectItems(data: TrailGuideStructuredData) {
  const notes: string[] = [];
  if (trailGuideBoolean(data, 'beach_driving.four_wheel_drive_recommended')) notes.push('Soft sand');
  if (trailGuideBoolean(data, 'water.hookup') === false && trailGuideBoolean(data, 'water.potable_central')) notes.push('Bring water');
  if (trailGuideBoolean(data, 'sewer.hookup') === false && trailGuideBoolean(data, 'dump_station.available')) notes.push('Dump station');
  if (trailGuideBoolean(data, 'generators.off_during_quiet_hours')) notes.push('Generators off at night');
  if (trailGuideBoolean(data, 'pets.shoreline_allowed') === false) notes.push('No pets on shoreline');
  return notes.slice(0, 5);
}

function useStructuredData(placeId: string) {
  const [data, setData] = useState<TrailGuideStructuredData | null>(null);

  useEffect(() => {
    let active = true;
    setData(null);
    void loadTrailGuideStructuredData(placeId)
      .then((result) => { if (active) setData(result); })
      .catch(() => { if (active) setData(null); });
    return () => { active = false; };
  }, [placeId]);

  return data;
}

export function TrailGuidePlacePracticalDetails({
  placeId,
  category,
  fallbackDetails,
  formattedAddress,
  weekdayDescription,
}: Props) {
  const data = useStructuredData(placeId);
  const essentials = useMemo(() => data && category === 'Camping' ? essentialCards(data) : [], [category, data]);
  const quick = useMemo(() => data ? quickDetails(data) : [], [data]);
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

  return (
    <View style={styles.section}>
      {(essentials.length || tentPrice != null || rvPrice != null || reservationSource) ? (
        <View style={styles.stayCard}>
          <Text style={styles.cardTitle}>Stay here</Text>

          {(tentPrice != null || rvPrice != null) ? (
            <View style={styles.priceBand}>
              {tentPrice != null ? <View style={styles.priceCell}><Text style={styles.priceValue}>{money(tentPrice)}</Text><Text style={styles.priceLabel}>Tent / night</Text></View> : null}
              {tentPrice != null && rvPrice != null ? <View style={styles.priceDivider} /> : null}
              {rvPrice != null ? <View style={styles.priceCell}><Text style={styles.priceValue}>{money(rvPrice)}</Text><Text style={styles.priceLabel}>RV / night</Text></View> : null}
            </View>
          ) : null}

          {essentials.length ? (
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
          ) : null}

          {reservationSource ? (
            <Pressable onPress={() => void Linking.openURL(reservationSource.sourceUrl)} style={({ pressed }) => [styles.reserveButton, pressed && styles.pressed]}>
              <AppIcon name="calendar" color="#17211C" size={17} />
              <Text style={styles.reserveText}>Reserve campsite</Text>
            </Pressable>
          ) : null}

          <Text style={styles.disclaimer}>Rates, availability, and amenities can change. Confirm current pricing and site-specific details with the campground before booking.</Text>
        </View>
      ) : null}

      {(quick.length || expectations.length) ? (
        <View style={styles.beforeCard}>
          <Text style={styles.cardTitle}>Before you go</Text>
          {quick.length ? (
            <View style={styles.quickGrid}>
              {quick.map((item) => (
                <View key={`${item.label}-${item.value}`} style={styles.quickItem}>
                  <Text style={styles.quickIcon}>{item.icon}</Text>
                  <View style={styles.quickCopy}><Text style={styles.quickLabel}>{item.label}</Text><Text style={styles.quickValue}>{item.value}</Text></View>
                </View>
              ))}
            </View>
          ) : null}
          {expectations.length ? <View style={styles.expectChips}>{expectations.map((item) => <View key={item} style={styles.expectChip}><Text style={styles.expectChipText}>{item}</Text></View>)}</View> : null}
        </View>
      ) : null}
    </View>
  );
}

export function TrailGuidePlaceMoreDetails({ placeId, formattedAddress, weekdayDescription }: MoreProps) {
  const data = useStructuredData(placeId);
  const [showMore, setShowMore] = useState(false);
  const amenities = useMemo(() => data ? amenityLabels(data) : [], [data]);
  const rules = useMemo(() => data ? ruleLabels(data) : [], [data]);

  if (!data || !Object.keys(data.facts).length) return null;

  const source = trailGuidePrimarySource(data);
  const sourceDate = formatSourceDate(source?.sourceDate);
  const verifiedDate = formatVerifiedDate(data.lastVerifiedAt);

  return (
    <View style={styles.moreSection}>
      <Pressable onPress={() => setShowMore((current) => !current)} style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}>
        <View style={styles.moreButtonCopy}><Text style={styles.moreTitle}>Amenities & rules</Text><Text style={styles.moreHint}>Facilities, policies, address, and official source</Text></View>
        <AppIcon name={showMore ? 'chevron-up' : 'chevron-forward'} color="#D7B45A" size={18} />
      </Pressable>

      {showMore ? (
        <View style={styles.morePanel}>
          {amenities.length ? <View><Text style={styles.detailLabel}>Amenities</Text><View style={styles.chips}>{amenities.map((item) => <View key={item} style={styles.chip}><Text style={styles.chipText}>{item}</Text></View>)}</View></View> : null}
          {rules.length ? <View><Text style={styles.detailLabel}>Rules to know</Text><View style={styles.chips}>{rules.map((item) => <View key={item} style={styles.chip}><Text style={styles.chipText}>{item}</Text></View>)}</View></View> : null}
          {data.address || formattedAddress ? <Text style={styles.infoLine}>{data.address || formattedAddress}</Text> : null}
          {weekdayDescription ? <Text style={styles.infoLine}>{weekdayDescription}</Text> : null}
          {source ? (
            <Pressable onPress={() => void Linking.openURL(source.sourceUrl)} style={styles.sourceStrip}>
              <View style={styles.sourceDot} />
              <View style={styles.sourceCopy}>
                <Text style={styles.sourceTitle}>Verified from {data.operatorName || source.sourceName}</Text>
                <Text style={styles.sourceMeta}>{verifiedDate ? `Last checked ${verifiedDate}` : sourceDate ? `Source dated ${sourceDate}` : 'Official source'} · View source</Text>
              </View>
              <AppIcon name="open" color="#8EBE82" size={14} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 11, gap: 9 },
  sectionTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' },
  cardTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' },
  stayCard: { borderRadius: 17, borderWidth: 1, borderColor: '#243128', backgroundColor: '#101914', padding: 11, gap: 9 },
  priceBand: { minHeight: 58, borderRadius: 13, borderWidth: 1, borderColor: '#28362D', backgroundColor: '#121C16', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  priceCell: { flex: 1, alignItems: 'center' },
  priceDivider: { width: 1, height: 30, backgroundColor: '#2A382F' },
  priceValue: { color: '#FFF8E8', fontSize: 19, lineHeight: 22, fontWeight: '900' },
  priceLabel: { color: '#88958D', fontSize: 8.5, marginTop: 1, fontWeight: '700' },
  essentialGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  essentialCell: { width: '31.6%', minHeight: 82, borderRadius: 12, borderWidth: 1, borderColor: '#2A382F', backgroundColor: '#152019', paddingHorizontal: 6, paddingVertical: 7, alignItems: 'center', justifyContent: 'center' },
  essentialIcon: { fontSize: 20, lineHeight: 23, marginBottom: 3 },
  essentialLabel: { color: '#F6F1E7', fontSize: 9, fontWeight: '900', textAlign: 'center' },
  essentialValue: { color: '#D7DFDA', fontSize: 9.5, lineHeight: 12, fontWeight: '800', marginTop: 2, textAlign: 'center' },
  essentialNote: { color: '#77847C', fontSize: 7.5, lineHeight: 10, marginTop: 2, textAlign: 'center' },
  reserveButton: { minHeight: 43, borderRadius: 13, backgroundColor: '#D7B45A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  reserveText: { color: '#17211C', fontSize: 13, fontWeight: '900' },
  disclaimer: { color: '#78847D', fontSize: 8.5, lineHeight: 12.5, textAlign: 'center', paddingHorizontal: 4 },
  beforeCard: { borderRadius: 16, borderWidth: 1, borderColor: '#2A392F', backgroundColor: '#111B15', padding: 11 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 5 },
  quickItem: { width: '50%', minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingRight: 6 },
  quickIcon: { fontSize: 14, width: 20, textAlign: 'center' },
  quickCopy: { flex: 1 },
  quickLabel: { color: '#7B8880', fontSize: 7.5, fontWeight: '800', textTransform: 'uppercase' },
  quickValue: { color: '#D9E0DB', fontSize: 9.5, lineHeight: 12.5, fontWeight: '800', marginTop: 1 },
  expectChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 7 },
  expectChip: { borderRadius: 999, backgroundColor: '#1A2B20', borderWidth: 1, borderColor: '#34503B', paddingHorizontal: 8, paddingVertical: 5 },
  expectChipText: { color: '#AFC7B6', fontSize: 8.5, fontWeight: '800' },
  moreSection: { marginTop: 10, gap: 7 },
  moreButton: { minHeight: 54, borderRadius: 14, borderWidth: 1, borderColor: '#29382F', backgroundColor: '#101914', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  moreButtonCopy: { flex: 1, paddingRight: 10 },
  moreTitle: { color: '#F3EEE3', fontSize: 12, fontWeight: '900' },
  moreHint: { color: '#748178', fontSize: 8, marginTop: 2 },
  morePanel: { borderRadius: 14, borderWidth: 1, borderColor: '#243128', backgroundColor: '#0F1712', padding: 11, gap: 10 },
  detailLabel: { color: '#98A59D', fontSize: 8.5, fontWeight: '900', textTransform: 'uppercase', marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: '#34463B', backgroundColor: '#17211C', paddingHorizontal: 8, paddingVertical: 5 },
  chipText: { color: '#B8C3BC', fontSize: 8.5, fontWeight: '700' },
  infoLine: { color: '#9AA69F', fontSize: 10, lineHeight: 15 },
  sourceStrip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#26352C', paddingTop: 9 },
  sourceDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#6FA765' },
  sourceCopy: { flex: 1 },
  sourceTitle: { color: '#D8E2DB', fontSize: 10, fontWeight: '900' },
  sourceMeta: { color: '#748178', fontSize: 8, marginTop: 2 },
  fallbackCard: { marginTop: 6, borderRadius: 14, borderWidth: 1, borderColor: '#29372F', backgroundColor: '#111914', padding: 11, gap: 6 },
  fallbackText: { color: '#C5CEC8', fontSize: 10.5, lineHeight: 15 },
  muted: { color: '#78847D', fontSize: 9, lineHeight: 13 },
  pressed: { opacity: 0.78 },
});