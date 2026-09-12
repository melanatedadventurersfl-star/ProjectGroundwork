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

type DetailRow = {
  icon: string;
  label: string;
  value: string;
  note?: string | null;
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

function buildCampingRows(data: TrailGuideStructuredData): DetailRow[] {
  const electric = trailGuideBoolean(data, 'electric.available');
  const electricScope = trailGuideString(data, 'electric.scope');
  const voltage = trailGuideNumber(data, 'electric.voltage');
  const amps = trailGuideStringArray(data, 'electric.amps');
  const waterHookup = trailGuideBoolean(data, 'water.hookup');
  const centralWater = trailGuideBoolean(data, 'water.potable_central');
  const sewerHookup = trailGuideBoolean(data, 'sewer.hookup');
  const dumpStation = trailGuideBoolean(data, 'dump_station.available');
  const showers = trailGuideBoolean(data, 'amenities.showers');
  const restrooms = trailGuideBoolean(data, 'amenities.restrooms');

  const electricParts = [
    electricScope === 'all_sites' ? 'Every site' : electricScope,
    voltage ? `${voltage}V` : null,
    amps?.length ? amps.map((amp) => `${amp}A`).join(' · ') : null,
  ].filter(Boolean);

  return [
    electric == null ? null : {
      icon: '⚡',
      label: 'Electric',
      value: electric ? (electricParts.join(' · ') || 'Available') : 'No electric hookup',
    },
    waterHookup == null && centralWater == null ? null : {
      icon: '💧',
      label: 'Water',
      value: waterHookup ? 'Hookup at site' : 'No site hookup',
      note: centralWater ? 'Central potable water available' : null,
    },
    sewerHookup == null && dumpStation == null ? null : {
      icon: '🚽',
      label: 'Sewer',
      value: sewerHookup ? 'Hookup at site' : 'No site hookup',
      note: dumpStation ? 'Dump station available' : null,
    },
    showers == null && restrooms == null ? null : {
      icon: '🚿',
      label: 'Facilities',
      value: [showers ? 'Showers' : null, restrooms ? 'Restrooms' : null].filter(Boolean).join(' + ') || 'Limited facilities',
    },
  ].filter((row): row is DetailRow => Boolean(row));
}

function buildGoodToKnow(data: TrailGuideStructuredData): DetailRow[] {
  const checkIn = trailGuideString(data, 'check_in.time');
  const checkOut = trailGuideString(data, 'check_out.time');
  const quietHours = trailGuideString(data, 'quiet_hours.range');
  const maxPeople = trailGuideNumber(data, 'occupancy.max_people');
  const pets = trailGuideBoolean(data, 'pets.allowed');
  const petMax = trailGuideNumber(data, 'pets.max_per_site');
  const petFee = trailGuideNumber(data, 'pets.fee');
  const shorelinePets = trailGuideBoolean(data, 'pets.shoreline_allowed');
  const fourWheelDrive = trailGuideBoolean(data, 'beach_driving.four_wheel_drive_recommended');

  return [
    checkIn || checkOut ? {
      icon: '🕐',
      label: 'Check-in / out',
      value: `${checkIn ?? 'Check source'} → ${checkOut ?? 'Check source'}`,
    } : null,
    quietHours ? {
      icon: '🌙',
      label: 'Quiet hours',
      value: quietHours,
    } : null,
    maxPeople != null ? {
      icon: '👥',
      label: 'Site capacity',
      value: `Up to ${maxPeople} people`,
    } : null,
    pets != null ? {
      icon: '🐕',
      label: 'Pets',
      value: pets ? `Allowed${petMax ? ` · Up to ${petMax}` : ''}` : 'Not allowed',
      note: pets && petFee != null
        ? `${money(petFee)} per pet per stay${shorelinePets === false ? ' · No shoreline access' : ''}`
        : shorelinePets === false ? 'No shoreline access' : null,
    } : null,
    fourWheelDrive ? {
      icon: '🚙',
      label: 'Beach driving',
      value: '4WD strongly recommended',
      note: 'Soft sand can make Atlantic-side access difficult.',
    } : null,
  ].filter((row): row is DetailRow => Boolean(row));
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

  return candidates
    .filter(([field]) => trailGuideBoolean(data, field) === true)
    .map(([, label]) => label);
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

  const campingRows = useMemo(() => data && category === 'Camping' ? buildCampingRows(data) : [], [category, data]);
  const goodToKnowRows = useMemo(() => data ? buildGoodToKnow(data) : [], [data]);
  const amenities = useMemo(() => data ? amenityLabels(data) : [], [data]);

  const tentPrice = trailGuideNumber(data, 'pricing.tent_total') ?? trailGuideNumber(data, 'pricing.tent_base');
  const rvPrice = trailGuideNumber(data, 'pricing.rv_total') ?? trailGuideNumber(data, 'pricing.rv_base');
  const tentCamping = trailGuideBoolean(data, 'camping.tent');
  const rvCamping = trailGuideBoolean(data, 'camping.rv');
  const pets = trailGuideBoolean(data, 'pets.allowed');
  const fireRings = trailGuideBoolean(data, 'fires.rings_only');
  const source = trailGuidePrimarySource(data);
  const sourceDate = formatSourceDate(source?.sourceDate);
  const hasStructuredData = Boolean(data && Object.keys(data.facts).length);

  if (!hasStructuredData) {
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Know before you go</Text>
          <Text style={styles.sectionHint}>Only what matters</Text>
        </View>
        <View style={styles.rows}>
          {fallbackDetails.slice(0, 3).map((detail, index) => (
            <View key={detail} style={styles.fallbackRow}>
              <View style={styles.iconBox}><Text style={styles.iconText}>{index === 0 ? '🥾' : index === 1 ? '🌦️' : '🎒'}</Text></View>
              <Text style={styles.fallbackText}>{detail}</Text>
            </View>
          ))}
        </View>
        {formattedAddress || weekdayDescription ? (
          <>
            <Pressable onPress={() => setShowMore((current) => !current)} style={styles.moreButton}>
              <Text style={styles.moreText}>{showMore ? 'Hide place details' : 'More place details'}</Text>
              <AppIcon name={showMore ? 'chevron-up' : 'chevron-forward'} color="#D7B45A" size={17} />
            </Pressable>
            {showMore ? (
              <View style={styles.infoPanel}>
                {formattedAddress ? <Text style={styles.infoLine}>{formattedAddress}</Text> : null}
                {weekdayDescription ? <Text style={styles.infoLine}>{weekdayDescription}</Text> : null}
                <Text style={styles.infoSource}>Live place info from Google Places</Text>
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    );
  }

  const quickFacts = [
    tentCamping ? 'Tent camping' : null,
    rvCamping ? 'RV camping' : null,
    pets ? 'Pets allowed' : null,
    fireRings ? 'Fire rings' : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <View style={styles.section}>
      {campingRows.length ? (
        <>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Campsite essentials</Text>
            <Text style={styles.sectionHint}>The details that decide whether your setup works</Text>
          </View>

          {(tentPrice != null || rvPrice != null) ? (
            <View style={styles.priceBand}>
              <Text style={styles.priceLabel}>NIGHTLY CAMPING</Text>
              <View style={styles.priceValues}>
                {tentPrice != null ? <Text style={styles.priceValue}>{money(tentPrice)} tent</Text> : null}
                {rvPrice != null ? <Text style={styles.priceValue}>{money(rvPrice)} RV</Text> : null}
              </View>
            </View>
          ) : null}

          <View style={styles.rows}>
            {campingRows.map((row) => (
              <View key={row.label} style={styles.detailRow}>
                <View style={styles.iconBox}><Text style={styles.iconText}>{row.icon}</Text></View>
                <View style={styles.flex}>
                  <Text style={styles.detailLabel}>{row.label}</Text>
                  <Text style={styles.detailValue}>{row.value}</Text>
                  {row.note ? <Text style={styles.detailNote}>{row.note}</Text> : null}
                </View>
              </View>
            ))}
          </View>

          {quickFacts.length ? (
            <View style={styles.chips}>
              {quickFacts.map((fact) => <View key={fact} style={styles.chip}><Text style={styles.chipText}>{fact}</Text></View>)}
            </View>
          ) : null}
        </>
      ) : null}

      {goodToKnowRows.length ? (
        <View style={styles.goodSection}>
          <Text style={styles.subsectionTitle}>Good to know</Text>
          <View style={styles.rows}>
            {goodToKnowRows.map((row) => (
              <View key={row.label} style={styles.detailRow}>
                <View style={styles.iconBox}><Text style={styles.iconText}>{row.icon}</Text></View>
                <View style={styles.flex}>
                  <Text style={styles.detailLabel}>{row.label}</Text>
                  <Text style={styles.detailValue}>{row.value}</Text>
                  {row.note ? <Text style={styles.detailNote}>{row.note}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <Pressable onPress={() => setShowMore((current) => !current)} style={styles.moreButton}>
        <Text style={styles.moreText}>{showMore ? 'Hide all details' : 'See all amenities & source details'}</Text>
        <AppIcon name={showMore ? 'chevron-up' : 'chevron-forward'} color="#D7B45A" size={17} />
      </Pressable>

      {showMore ? (
        <View style={styles.infoPanel}>
          {amenities.length ? (
            <>
              <Text style={styles.infoHeading}>Amenities & activities</Text>
              <View style={styles.chips}>{amenities.map((item) => <View key={item} style={styles.chip}><Text style={styles.chipText}>{item}</Text></View>)}</View>
            </>
          ) : null}
          {data.address || formattedAddress ? <Text style={styles.infoLine}>{data.address || formattedAddress}</Text> : null}
          {weekdayDescription ? <Text style={styles.infoLine}>{weekdayDescription}</Text> : null}
          <Text style={styles.infoLine}>Data completeness: {data.completenessScore}%</Text>
        </View>
      ) : null}

      {source ? (
        <Pressable onPress={() => void Linking.openURL(source.sourceUrl)} style={styles.sourceStrip}>
          <View style={styles.sourceDot} />
          <View style={styles.flex}>
            <Text style={styles.sourceTitle}>Verified from {data.operatorName || source.sourceName}</Text>
            <Text style={styles.sourceMeta}>{sourceDate ? `Source dated ${sourceDate} · ` : ''}Tap to view official source</Text>
          </View>
          <AppIcon name="open" color="#8EBE82" size={15} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 22 },
  sectionHeaderRow: { marginBottom: 9 },
  sectionTitle: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' },
  sectionHint: { color: '#78847D', fontSize: 9, marginTop: 2, lineHeight: 13 },
  rows: { gap: 0 },
  detailRow: { minHeight: 58, borderBottomWidth: 1, borderBottomColor: '#26312B', flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  fallbackRow: { minHeight: 50, borderBottomWidth: 1, borderBottomColor: '#26312B', flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  iconBox: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#18221D', alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 15 },
  flex: { flex: 1 },
  detailLabel: { color: '#7F8C84', fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  detailValue: { color: '#E5EBE7', fontSize: 12, fontWeight: '900', marginTop: 2 },
  detailNote: { color: '#9AA69F', fontSize: 9, lineHeight: 14, marginTop: 2 },
  fallbackText: { flex: 1, color: '#C7D0CA', fontSize: 11, lineHeight: 16, fontWeight: '700' },
  priceBand: { borderRadius: 14, borderWidth: 1, borderColor: '#61552E', backgroundColor: '#252313', paddingHorizontal: 12, paddingVertical: 10, marginBottom: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  priceLabel: { color: '#A89661', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  priceValues: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 },
  priceValue: { color: '#F0D577', fontSize: 11, fontWeight: '900' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: '#354139', backgroundColor: '#151B17', paddingHorizontal: 9, paddingVertical: 5 },
  chipText: { color: '#BFC9C2', fontSize: 9, fontWeight: '800' },
  goodSection: { marginTop: 20 },
  subsectionTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900', marginBottom: 5 },
  moreButton: { minHeight: 44, marginTop: 10, borderRadius: 12, borderWidth: 1, borderColor: '#2E3932', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  moreText: { color: '#D7B45A', fontSize: 10, fontWeight: '900' },
  infoPanel: { marginTop: 7, borderRadius: 12, backgroundColor: '#101713', padding: 12, gap: 8 },
  infoHeading: { color: '#D8E0DB', fontSize: 10, fontWeight: '900' },
  infoLine: { color: '#C6D0C9', fontSize: 10, lineHeight: 15 },
  infoSource: { color: '#68746D', fontSize: 8, marginTop: 2 },
  sourceStrip: { marginTop: 9, minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: '#2A4632', backgroundColor: '#102017', paddingHorizontal: 11, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 9 },
  sourceDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#79D26A' },
  sourceTitle: { color: '#CFE5D3', fontSize: 10, fontWeight: '900' },
  sourceMeta: { color: '#76907D', fontSize: 8, marginTop: 2 },
});
