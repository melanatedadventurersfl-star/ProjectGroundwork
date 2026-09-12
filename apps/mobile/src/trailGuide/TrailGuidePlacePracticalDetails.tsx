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
  const primitive = trailGuideBoolean(data, 'camping.primitive');
  const cabins = trailGuideBoolean(data, 'camping.cabins');
  const siteCount = trailGuideNumber(data, 'camping.site_count');
  const showers = trailGuideBoolean(data, 'amenities.showers');
  const restrooms = trailGuideBoolean(data, 'amenities.restrooms');
  const pets = trailGuideBoolean(data, 'pets.allowed');
  const petMax = trailGuideNumber(data, 'pets.max_per_site');

  const electricParts = [
    electricScope === 'all_sites' ? 'All sites' : electricScope,
    voltage ? `${voltage}V` : null,
    amps?.length ? amps.map((amp) => `${amp}A`).join(' / ') : null,
  ].filter(Boolean);

  const campingTypes = [
    tent ? 'Tent' : null,
    rv ? 'RV' : null,
    primitive ? 'Primitive' : null,
    cabins ? 'Cabins' : null,
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
    campingTypes.length === 0 ? null : {
      key: 'camping', icon: '🏕️', label: 'Camping',
      value: campingTypes.join(' + '),
      note: siteCount != null ? `${siteCount} sites` : null,
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
  const visitHours = trailGuideString(data, 'visit.hours');
  const admission = trailGuideString(data, 'visit.admission');
  const phone = trailGuideString(data, 'contact.phone');
  const trailDistance = trailGuideNumber(data, 'trail.distance_miles');
  const trailSurface = trailGuideString(data, 'trail.surface');
  const maxPeople = trailGuideNumber(data, 'occupancy.max_people');
  const checkIn = trailGuideString(data, 'check_in.time');
  const checkOut = trailGuideString(data, 'check_out.time');
  const quietHours = trailGuideString(data, 'quiet_hours.range');
  const maxRvLength = trailGuideNumber(data, 'camping.max_rv_length_ft');
  const fourWheelDrive = trailGuideBoolean(data, 'beach_driving.four_wheel_drive_recommended');
  const petFee = trailGuideNumber(data, 'pets.fee');

  return [
    visitHours ? { icon: '🕐', label: 'Hours', value: visitHours } : null,
    admission ? { icon: '🎟️', label: 'Admission', value: admission } : null,
    phone ? { icon: '☎️', label: 'Phone', value: phone } : null,
    trailDistance != null ? { icon: '🥾', label: 'Trail distance', value: `${trailDistance} mi` } : null,
    trailSurface ? { icon: '🧭', label: 'Trail surface', value: trailSurface } : null,
    maxPeople != null ? { icon: '👥', label: 'Capacity', value: `${maxPeople} people/site` } : null,
    checkIn ? { icon: '↘', label: 'Check-in', value: checkIn } : null,
    checkOut ? { icon: '↗', label: 'Check-out', value: checkOut } : null,
    quietHours ? { icon: '🌙', label: 'Quiet hours', value: quietHours } : null,
    maxRvLength != null ? { icon: '🚐', label: 'Max RV length', value: `${maxRvLength} ft` } : null,
    fourWheelDrive ? { icon: '🚙', label: 'Beach access', value: '4WD recommended' } : null,
    petFee != null ? { icon: '🐕', label: 'Pet fee', value: `${money(petFee)} / stay` } : null,
  ].filter((item): item is QuickDetail => Boolean(item));
}

function amenityLabels(data: TrailGuideStructuredData) {
  const candidates = [
    ['parking.available', 'Parking'],
    ['amenities.showers', 'Showers'],
    ['amenities.restrooms', 'Restrooms'],
    ['amenities.drinking_water', 'Drinking water'],
    ['amenities.picnic_tables', 'Picnic tables'],
    ['amenities.playground', 'Playground'],
    ['amenities.concession', 'Concession'],
    ['amenities.laundry', 'Laundry'],
    ['amenities.wifi', 'Wi-Fi'],
    ['accessibility.wheelchair', 'Wheelchair accessible'],
    ['dump_station.available', 'Dump station'],
    ['launch.nonmotorized', 'Kayak / paddle launch'],
    ['launch.boat', 'Boat launch'],
    ['camping.primitive', 'Primitive camping'],
    ['camping.cabins', 'Cabins'],
  ] as const;
  return candidates.filter(([field]) => trailGuideBoolean(data, field) === true).map(([, label]) => label);
}

function activityLabels(data: TrailGuideStructuredData) {
  const candidates = [
    ['activities.hiking', 'Hiking'],
    ['activities.bicycling', 'Bicycling'],
    ['activities.equestrian', 'Horseback riding'],
    ['activities.paddling', 'Paddling'],
    ['activities.picnicking', 'Picnicking'],
    ['activities.wildlife_viewing', 'Wildlife viewing'],
    ['activities.scenic', 'Scenic / historic'],
    ['activities.swimming', 'Swimming'],
    ['activities.fishing', 'Fishing'],
    ['activities.surfing', 'Surfing'],
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
  if (trailGuideBoolean(data, 'pets.allowed') === false) rules.push('No pets');
  if (trailGuideBoolean(data, 'pets.leash_required')) rules.push('Pets must be leashed');
  if (trailGuideBoolean(data, 'pets.shoreline_allowed') === false) rules.push('Pets stay off shoreline');
  if (trailGuideBoolean(data, 'activities.bicycling') === false) rules.push('No bicycles');
  if (trailGuideBoolean(data, 'vehicles.golf_carts_atvs_utvs_allowed') === false) rules.push('No golf carts, ATVs, or UTVs');
  return rules;
}

function expectItems(data: TrailGuideStructuredData) {
  const notes: string[] = [];
  if (trailGuideBoolean(data, 'beach_driving.four_wheel_drive_recommended')) notes.push('Soft sand');
  if (trailGuideBoolean(data, 'water.hookup') === false && trailGuideBoolean(data, 'water.potable_central')) notes.push('Central water only');
  if (trailGuideBoolean(data, 'sewer.hookup') === false && trailGuideBoolean(data, 'dump_station.available')) notes.push('Dump station');
  if (trailGuideBoolean(data, 'generators.off_during_quiet_hours')) notes.push('Generators off at night');
  if (trailGuideBoolean(data, 'pets.shoreline_allowed') === false) notes.push('No pets on shoreline');
  if (trailGuideBoolean(data, 'launch.nonmotorized') === false && trailGuideBoolean(data, 'activities.paddling')) notes.push('No launch on property');
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
        <Text style={styles.sectionTitle}>Destination details</Text>
        <View style={styles.fallbackCard}>
          <Text style={styles.fallbackHeading}>Official details are still being added.</Text>
          {fallbackDetails.slice(0, 3).map((detail) => <Text key={detail} style={styles.fallbackText}>• {detail}</Text>)}
          {formattedAddress ? <Text style={styles.muted}>{formattedAddress}</Text> : null}
          {weekdayDescription ? <Text style={styles.muted}>{weekdayDescription}</Text> : null}
        </View>
      </View>
    );
  }

  const tentPrice = trailGuideNumber(data, 'pricing.tent_total') ?? trailGuideNumber(data, 'pricing.tent_base');
  const rvPrice = trailGuideNumber(data, 'pricing.rv_total') ?? trailGuideNumber(data, 'pricing.rv_base');
  const cabinPrice = trailGuideNumber(data, 'pricing.cabin_total') ?? trailGuideNumber(data, 'pricing.cabin_base');
  const prices = [
    tentPrice != null ? { key: 'tent', value: tentPrice, label: 'Tent / night' } : null,
    rvPrice != null ? { key: 'rv', value: rvPrice, label: 'RV / night' } : null,
    cabinPrice != null ? { key: 'cabin', value: cabinPrice, label: 'Cabin / night' } : null,
  ].filter((item): item is { key: string; value: number; label: string } => Boolean(item));
  const reservationsAvailable = trailGuideBoolean(data, 'reservations.available') === true;
  const reservationSource = data.sources.find((source) => source.sourceType === 'reservation')
    ?? (reservationsAvailable ? trailGuidePrimarySource(data) : null);
  const alert = trailGuideString(data, 'alerts.current');

  return (
    <View style={styles.section}>
      {alert ? (
        <View style={styles.alertCard}>
          <View style={styles.alertIcon}><Text style={styles.alertGlyph}>!</Text></View>
          <View style={styles.alertCopy}>
            <Text style={styles.alertLabel}>Current advisory</Text>
            <Text style={styles.alertText}>{alert}</Text>
          </View>
        </View>
      ) : null}

      {(essentials.length || prices.length || reservationSource) ? (
        <View style={styles.stayCard}>
          <Text style={styles.cardTitle}>Stay here</Text>

          {prices.length ? (
            <View style={styles.priceBand}>
              {prices.map((price, index) => (
                <View key={price.key} style={styles.priceRowItem}>
                  {index > 0 ? <View style={styles.priceDivider} /> : null}
                  <View style={styles.priceCell}>
                    <Text style={styles.priceValue}>{money(price.value)}</Text>
                    <Text style={styles.priceLabel}>{price.label}</Text>
                  </View>
                </View>
              ))}
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
              <Text style={styles.reserveText}>Check camping availability</Text>
            </Pressable>
          ) : null}

          <Text style={styles.disclaimer}>Rates, availability, and amenities can change. Confirm current details with the destination before leaving.</Text>
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
  const activities = useMemo(() => data ? activityLabels(data) : [], [data]);
  const rules = useMemo(() => data ? ruleLabels(data) : [], [data]);

  if (!data || !Object.keys(data.facts).length) return null;

  const source = trailGuidePrimarySource(data);
  const sourceDate = formatSourceDate(source?.sourceDate);
  const verifiedDate = formatVerifiedDate(data.lastVerifiedAt);

  return (
    <View style={styles.moreSection}>
      <Pressable onPress={() => setShowMore((current) => !current)} style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}>
        <View style={styles.moreButtonCopy}><Text style={styles.moreTitle}>Amenities, activities & rules</Text><Text style={styles.moreHint}>Facilities, recreation, policies, address, and official source</Text></View>
        <AppIcon name={showMore ? 'chevron-up' : 'chevron-forward'} color="#D7B45A" size={18} />
      </Pressable>

      {showMore ? (
        <View style={styles.morePanel}>
          {amenities.length ? <View><Text style={styles.detailLabel}>Amenities</Text><View style={styles.chips}>{amenities.map((item) => <View key={item} style={styles.chip}><Text style={styles.chipText}>{item}</Text></View>)}</View></View> : null}
          {activities.length ? <View><Text style={styles.detailLabel}>Activities</Text><View style={styles.chips}>{activities.map((item) => <View key={item} style={styles.chip}><Text style={styles.chipText}>{item}</Text></View>)}</View></View> : null}
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
  alertCard: { borderRadius: 15, borderWidth: 1, borderColor: '#6E5A25', backgroundColor: '#241F12', padding: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  alertIcon: { width: 25, height: 25, borderRadius: 13, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center' },
  alertGlyph: { color: '#17211C', fontSize: 14, fontWeight: '900' },
  alertCopy: { flex: 1 },
  alertLabel: { color: '#F1D77A', fontSize: 8, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.55 },
  alertText: { color: '#E8DFC7', fontSize: 10.5, lineHeight: 15, marginTop: 3 },
  stayCard: { borderRadius: 17, borderWidth: 1, borderColor: '#243128', backgroundColor: '#101914', padding: 11, gap: 9 },
  priceBand: { minHeight: 58, borderRadius: 13, borderWidth: 1, borderColor: '#28362D', backgroundColor: '#121C16', flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: 6 },
  priceRowItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  priceCell: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  priceDivider: { width: 1, height: 30, backgroundColor: '#2A382F' },
  priceValue: { color: '#FFF8E8', fontSize: 18, lineHeight: 21, fontWeight: '900' },
  priceLabel: { color: '#88958D', fontSize: 7.5, marginTop: 1, fontWeight: '700', textAlign: 'center' },
  essentialGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  essentialCell: { width: '31.6%', minHeight: 82, borderRadius: 12, borderWidth: 1, borderColor: '#2A382F', backgroundColor: '#152019', paddingHorizontal: 6, paddingVertical: 7, alignItems: 'center', justifyContent: 'center' },
  essentialIcon: { fontSize: 20, lineHeight: 23, marginBottom: 3 },
  essentialLabel: { color: '#F6F1E7', fontSize: 9, fontWeight: '900', textAlign: 'center' },
  essentialValue: { color: '#D7DFDA', fontSize: 9.5, lineHeight: 12, fontWeight: '800', marginTop: 2, textAlign: 'center' },
  essentialNote: { color: '#77847C', fontSize: 7.5, lineHeight: 10, marginTop: 2, textAlign: 'center' },
  reserveButton: { minHeight: 43, borderRadius: 13, backgroundColor: '#D7B45A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  reserveText: { color: '#17211C', fontSize: 12, fontWeight: '900' },
  disclaimer: { color: '#78847D', fontSize: 8.5, lineHeight: 12.5, textAlign: 'center', paddingHorizontal: 4 },
  beforeCard: { borderRadius: 16, borderWidth: 1, borderColor: '#2A392F', backgroundColor: '#111B15', padding: 11 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 5 },
  quickItem: { width: '50%', minHeight: 48, flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 5, paddingRight: 7 },
  quickIcon: { fontSize: 14, width: 20, textAlign: 'center', marginTop: 1 },
  quickCopy: { flex: 1 },
  quickLabel: { color: '#7B8880', fontSize: 7.5, fontWeight: '800', textTransform: 'uppercase' },
  quickValue: { color: '#D9E0DB', fontSize: 9.5, lineHeight: 13, fontWeight: '800', marginTop: 1 },
  expectChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 7 },
  expectChip: { borderRadius: 999, backgroundColor: '#1A2B20', borderWidth: 1, borderColor: '#34503B', paddingHorizontal: 8, paddingVertical: 5 },
  expectChipText: { color: '#AFC7B6', fontSize: 8.5, fontWeight: '800' },
  moreSection: { marginTop: 10, gap: 7 },
  moreButton: { minHeight: 56, borderRadius: 14, borderWidth: 1, borderColor: '#29382F', backgroundColor: '#101914', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  moreButtonCopy: { flex: 1, paddingRight: 10 },
  moreTitle: { color: '#F3EEE3', fontSize: 12, fontWeight: '900' },
  moreHint: { color: '#748178', fontSize: 8, lineHeight: 11, marginTop: 2 },
  morePanel: { borderRadius: 14, borderWidth: 1, borderColor: '#243128', backgroundColor: '#0F1712', padding: 11, gap: 11 },
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
  fallbackHeading: { color: '#D5DDD8', fontSize: 10.5, fontWeight: '900' },
  fallbackText: { color: '#C5CEC8', fontSize: 10.5, lineHeight: 15 },
  muted: { color: '#78847D', fontSize: 9, lineHeight: 13 },
  pressed: { opacity: 0.78 },
});
