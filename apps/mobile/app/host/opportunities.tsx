import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  previewOpportunityFromUrl,
  type OpportunityPreview,
} from '../../src/hosting/opportunities';
import { AppIcon, type AppIconName } from '../../src/ui/AppIcon';

type Mode = 'link' | 'manual' | 'file';

const COLORS = {
  ink: '#0A0F0C',
  panel: '#141D17',
  panelSoft: '#18231C',
  line: '#2E3A33',
  lineGold: '#5C4A22',
  cream: '#FFF8E8',
  muted: '#9AA69E',
  dim: '#76827A',
  gold: '#D7B45A',
  orange: '#E7A05C',
  green: '#84C992',
  danger: '#EA806E',
};

const stages: { label: string; copy: string; icon: AppIconName }[] = [
  { label: 'Discovered', copy: 'New leads and ideas', icon: 'briefcase' },
  { label: 'Reviewing', copy: 'Imported details need review', icon: 'search' },
  { label: 'Applied / Contacted', copy: 'Application submitted or contact started', icon: 'open' },
  { label: 'Approved', copy: 'Accepted or confirmed', icon: 'checkmark' },
  { label: 'Scheduled', copy: 'Committed and on the calendar', icon: 'calendar' },
];

export default function HostOpportunitiesScreen() {
  const [mode, setMode] = useState<Mode>('link');
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<OpportunityPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  const cleanUrl = url.trim();
  const validUrl = /^https:\/\/\S+/i.test(cleanUrl);

  const changeMode = (next: Mode) => {
    setMode(next);
    setPreview(null);
    setError('');
  };

  const importOpportunity = async () => {
    if (!validUrl || importing) return;
    setImporting(true);
    setError('');
    setPreview(null);
    try {
      const result = await previewOpportunityFromUrl(cleanUrl);
      setPreview(result.preview);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to import this opportunity.');
    } finally {
      setImporting(false);
    }
  };

  const openSource = () => {
    const source = preview?.sourceUrl || cleanUrl;
    if (source) void Linking.openURL(source);
  };

  const attentionCount = preview ? 1 : 0;
  const reviewCount = preview ? 1 : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.replace('/host' as never)}>
          <Text style={styles.back}>‹ Host Center</Text>
        </Pressable>

        <View style={styles.hero}>
          <View style={styles.heroIcon}><AppIcon name="briefcase" color={COLORS.orange} size={26} /></View>
          <Text style={styles.eyebrow}>OPPORTUNITIES</Text>
          <Text style={styles.title}>Opportunities</Text>
          <Text style={styles.subtitle}>Find and track vending, partnerships, sponsorships, venues and future event opportunities.</Text>
        </View>

        <View style={styles.importCard}>
          <Text style={styles.sectionEyebrow}>ADD OPPORTUNITY</Text>
          <Text style={styles.sectionTitle}>Bring an opportunity in</Text>
          <View style={styles.modeRow}>
            <ModeButton label="Paste a link" icon="open" active={mode === 'link'} onPress={() => changeMode('link')} />
            <ModeButton label="Add manually" icon="add" active={mode === 'manual'} onPress={() => changeMode('manual')} />
            <ModeButton label="Flyer / file" icon="directory" active={mode === 'file'} onPress={() => changeMode('file')} />
          </View>

          {mode === 'link' ? (
            <View>
              <Text style={styles.inputLabel}>Paste event, vendor or venue link</Text>
              <Text style={styles.helper}>Paste a public HTTPS page. We will pull supported details into a review before anything is saved.</Text>
              <TextInput
                value={url}
                onChangeText={(value) => { setUrl(value); setPreview(null); setError(''); }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder="https://eventbrite.com/e/..."
                placeholderTextColor={COLORS.dim}
                style={styles.input}
                accessibilityLabel="Opportunity URL"
              />
              <Pressable
                disabled={!validUrl || importing}
                onPress={() => void importOpportunity()}
                style={[styles.importButton, (!validUrl || importing) && styles.importButtonDisabled]}
              >
                {importing ? <ActivityIndicator color={COLORS.ink} /> : <Text style={styles.importButtonText}>Import opportunity</Text>}
              </Pressable>
              {!validUrl && cleanUrl.length > 0 ? <Text style={styles.validation}>Enter a public HTTPS link.</Text> : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>
          ) : mode === 'manual' ? (
            <FeaturePlaceholder icon="add" title="Manual opportunity entry" copy="Manual opportunity fields are the next persistence step. This screen will remain the entry point." />
          ) : (
            <FeaturePlaceholder icon="directory" title="Flyer and file import" copy="Flyer, screenshot and vendor-packet extraction will live in this same review workflow." />
          )}
        </View>

        {preview ? <ReviewCard preview={preview} sourceUrl={cleanUrl} /> : null}

        <SectionHeader eyebrow="NEEDS ATTENTION" title={attentionCount ? 'Review imported opportunity' : 'Nothing needs attention'} count={attentionCount} />
        <View style={styles.panel}>
          {preview ? (
            <Pressable style={styles.attentionRow} onPress={openSource}>
              <View style={styles.attentionIcon}><AppIcon name="search" color={COLORS.orange} size={18} /></View>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{preview.title || 'Imported opportunity'}</Text>
                <Text style={styles.rowMeta}>Tap to open the original opportunity page.</Text>
              </View>
              <AppIcon name="chevron-forward" color={COLORS.dim} size={16} />
            </Pressable>
          ) : <FeaturePlaceholder icon="checkmark" title="No opportunity alerts" copy="Imported records, deadlines and follow-ups that need action will appear here." compact />}
        </View>

        <SectionHeader eyebrow="PIPELINE" title="Track each opportunity" />
        <View style={styles.panel}>
          {stages.map((stage, index) => (
            <View key={stage.label} style={[styles.pipelineRow, index > 0 && styles.divider]}>
              <View style={styles.pipelineIcon}><AppIcon name={stage.icon} color={COLORS.gold} size={17} /></View>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{stage.label}</Text>
                <Text style={styles.rowMeta}>{stage.copy}</Text>
              </View>
              <View style={styles.countPill}><Text style={styles.countText}>{stage.label === 'Reviewing' ? reviewCount : 0}</Text></View>
              <AppIcon name="chevron-forward" color={COLORS.dim} size={16} />
            </View>
          ))}
        </View>

        <SectionHeader eyebrow="UPCOMING DEADLINES" title={preview?.applicationDeadline ? 'Application deadline found' : 'No deadlines yet'} />
        <View style={styles.panel}>
          {preview?.applicationDeadline ? (
            <Pressable style={styles.deadlineRow} onPress={openSource}>
              <View style={styles.deadlineIcon}><AppIcon name="calendar" color={COLORS.gold} size={18} /></View>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{preview.title || 'Imported opportunity'}</Text>
                <Text style={styles.rowMeta}>{preview.applicationDeadline}</Text>
              </View>
              <AppIcon name="chevron-forward" color={COLORS.dim} size={16} />
            </Pressable>
          ) : <FeaturePlaceholder icon="calendar" title="Nothing scheduled" copy="Application deadlines, booth payments and follow-up dates will appear here when they exist." compact />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ModeButton({ label, icon, active, onPress }: { label: string; icon: AppIconName; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.modeButton, active && styles.modeButtonActive]}><AppIcon name={icon} color={active ? COLORS.gold : COLORS.muted} size={15} /><Text style={[styles.modeText, active && styles.modeTextActive]}>{label}</Text></Pressable>;
}

function ReviewCard({ preview, sourceUrl }: { preview: OpportunityPreview; sourceUrl: string }) {
  const targetUrl = preview.sourceUrl || sourceUrl;
  const rows = [
    ['Type', labelize(preview.opportunityType)],
    ['Starts', preview.eventStart],
    ['Ends', preview.eventEnd],
    ['Venue', preview.venueName],
    ['Address', preview.address],
    ['City / State', [preview.city, preview.state].filter(Boolean).join(', ')],
    ['Organizer', preview.organizer],
    ['Vendor fee', preview.vendorFeeText],
    ['Application deadline', preview.applicationDeadline],
    ['Contact name', preview.contactName],
    ['Contact email', preview.contactEmail],
    ['Contact phone', preview.contactPhone],
  ].filter(([, value]) => Boolean(value));

  return <View style={styles.reviewCard}>
    <View style={styles.reviewTop}><View style={styles.flex}><Text style={styles.reviewEyebrow}>REVIEW IMPORTED DETAILS</Text><Text style={styles.reviewTitle}>{preview.title || 'Imported opportunity'}</Text></View><View style={styles.reviewBadge}><Text style={styles.reviewBadgeText}>REVIEWING</Text></View></View>
    {preview.summary ? <Text style={styles.reviewSummary}>{preview.summary}</Text> : null}
    <View style={styles.details}>{rows.length ? rows.map(([label, value], index) => <View key={label} style={[styles.detailRow, index > 0 && styles.divider]}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>) : <Text style={styles.reviewSummary}>The source did not expose enough structured opportunity details. Open the original page below to review it.</Text>}</View>
    {preview.ticketDetails?.length ? <ReviewList title="Ticket details" items={preview.ticketDetails} /> : null}
    {preview.boothDetails?.length ? <ReviewList title="Booth details" items={preview.boothDetails} /> : null}
    {preview.requirements?.length ? <ReviewList title="Requirements" items={preview.requirements} /> : null}
    {preview.applicationUrl ? <LinkAction label="Open application page" url={preview.applicationUrl} /> : null}
    <Text style={styles.sourceLabel}>SOURCE</Text>
    <Pressable onPress={() => void Linking.openURL(targetUrl)} accessibilityRole="link">
      <Text style={styles.sourceUrl} numberOfLines={2}>{targetUrl}</Text>
    </Pressable>
    <Pressable style={styles.sourceButton} onPress={() => void Linking.openURL(targetUrl)}>
      <AppIcon name="open" color={COLORS.ink} size={15} />
      <Text style={styles.sourceButtonText}>View original page</Text>
    </Pressable>
    <Text style={styles.reviewNote}>Review every imported field against the original source before saving or applying.</Text>
  </View>;
}

function LinkAction({ label, url }: { label: string; url: string }) {
  return <Pressable style={styles.linkAction} onPress={() => void Linking.openURL(url)} accessibilityRole="link"><Text style={styles.linkActionText}>{label}</Text><AppIcon name="open" color={COLORS.gold} size={15} /></Pressable>;
}

function ReviewList({ title, items }: { title: string; items: string[] }) {
  return <View style={styles.reviewList}><Text style={styles.reviewListTitle}>{title.toUpperCase()}</Text>{items.slice(0, 8).map((item, index) => <Text key={`${title}-${index}`} style={styles.reviewListItem}>• {item}</Text>)}</View>;
}

function SectionHeader({ eyebrow, title, count }: { eyebrow: string; title: string; count?: number }) {
  return <View style={styles.sectionHeader}><View><Text style={styles.sectionEyebrow}>{eyebrow}</Text><Text style={styles.sectionTitle}>{title}</Text></View>{typeof count === 'number' ? <View style={styles.countPill}><Text style={styles.countText}>{count}</Text></View> : null}</View>;
}

function FeaturePlaceholder({ icon, title, copy, compact = false }: { icon: AppIconName; title: string; copy: string; compact?: boolean }) {
  return <View style={[styles.placeholder, compact && styles.placeholderCompact]}><View style={styles.placeholderIcon}><AppIcon name={icon} color={COLORS.green} size={18} /></View><View style={styles.flex}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowMeta}>{copy}</Text></View></View>;
}

function labelize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.ink },
  content: { padding: 18, paddingBottom: 78 },
  back: { color: COLORS.gold, fontWeight: '900', marginBottom: 14 },
  hero: { borderRadius: 22, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.panel, padding: 18 },
  heroIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#E7A05C22', alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  eyebrow: { color: COLORS.orange, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: COLORS.cream, fontSize: 30, fontWeight: '900', marginTop: 3 },
  subtitle: { color: COLORS.muted, fontSize: 11, lineHeight: 17, marginTop: 5, maxWidth: 560 },
  importCard: { borderRadius: 18, borderWidth: 1, borderColor: COLORS.lineGold, backgroundColor: '#171912', padding: 14, marginTop: 14 },
  sectionHeader: { minHeight: 54, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginTop: 15, marginBottom: 8 },
  sectionEyebrow: { color: COLORS.gold, fontSize: 8.5, fontWeight: '900', letterSpacing: 1.1 },
  sectionTitle: { color: COLORS.cream, fontSize: 15, fontWeight: '900', marginTop: 3 },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12, marginBottom: 14 },
  modeButton: { minHeight: 38, borderRadius: 11, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: COLORS.line },
  modeButtonActive: { borderColor: COLORS.lineGold, backgroundColor: '#302B18' },
  modeText: { color: COLORS.muted, fontSize: 9, fontWeight: '900' },
  modeTextActive: { color: COLORS.cream },
  inputLabel: { color: COLORS.cream, fontSize: 11.5, fontWeight: '900' },
  helper: { color: COLORS.muted, fontSize: 9, lineHeight: 14, marginTop: 4 },
  input: { minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: '#47534B', backgroundColor: '#101711', color: COLORS.cream, paddingHorizontal: 12, fontSize: 11, marginTop: 11 },
  importButton: { minHeight: 48, borderRadius: 12, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', marginTop: 9 },
  importButtonDisabled: { opacity: 0.42 },
  importButtonText: { color: COLORS.ink, fontSize: 10.5, fontWeight: '900' },
  validation: { color: COLORS.orange, fontSize: 9, marginTop: 7 },
  error: { color: COLORS.danger, fontSize: 9, lineHeight: 14, marginTop: 8 },
  panel: { borderRadius: 16, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.panel, overflow: 'hidden' },
  attentionRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  attentionIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#E7A05C18', alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  rowTitle: { color: COLORS.cream, fontSize: 11, fontWeight: '900' },
  rowMeta: { color: COLORS.muted, fontSize: 8.8, lineHeight: 13, marginTop: 3 },
  pipelineRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingVertical: 9 },
  pipelineIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#242A1A', alignItems: 'center', justifyContent: 'center' },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.line },
  countPill: { minWidth: 24, height: 22, borderRadius: 11, backgroundColor: COLORS.panelSoft, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  countText: { color: COLORS.muted, fontSize: 8.5, fontWeight: '900' },
  deadlineRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  deadlineIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#D7B45A18', alignItems: 'center', justifyContent: 'center' },
  reviewCard: { borderRadius: 18, borderWidth: 1, borderColor: '#37513F', backgroundColor: '#122119', padding: 14, marginTop: 14 },
  reviewTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, justifyContent: 'space-between' },
  reviewEyebrow: { color: COLORS.green, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  reviewTitle: { color: COLORS.cream, fontSize: 17, fontWeight: '900', marginTop: 4 },
  reviewBadge: { borderRadius: 9, backgroundColor: '#26341F', paddingHorizontal: 7, paddingVertical: 5 },
  reviewBadgeText: { color: COLORS.green, fontSize: 7, fontWeight: '900' },
  reviewSummary: { color: COLORS.muted, fontSize: 9.5, lineHeight: 15, marginTop: 9 },
  details: { borderRadius: 12, borderWidth: 1, borderColor: COLORS.line, backgroundColor: '#101A14', overflow: 'hidden', marginTop: 12 },
  detailRow: { minHeight: 48, paddingHorizontal: 10, paddingVertical: 9 },
  detailLabel: { color: COLORS.dim, fontSize: 7.5, fontWeight: '900', textTransform: 'uppercase' },
  detailValue: { color: COLORS.cream, fontSize: 10, fontWeight: '800', marginTop: 3 },
  reviewList: { marginTop: 12 },
  reviewListTitle: { color: COLORS.gold, fontSize: 8, fontWeight: '900', letterSpacing: .8 },
  reviewListItem: { color: COLORS.muted, fontSize: 9, lineHeight: 14, marginTop: 4 },
  sourceLabel: { color: COLORS.dim, fontSize: 7.5, fontWeight: '900', letterSpacing: .8, marginTop: 13 },
  sourceUrl: { color: COLORS.gold, fontSize: 8.5, lineHeight: 13, marginTop: 4, textDecorationLine: 'underline' },
  sourceButton: { minHeight: 44, borderRadius: 11, backgroundColor: COLORS.gold, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 10 },
  sourceButtonText: { color: COLORS.ink, fontSize: 10, fontWeight: '900' },
  linkAction: { minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: COLORS.lineGold, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, marginTop: 12 },
  linkActionText: { color: COLORS.cream, fontSize: 9.5, fontWeight: '900' },
  reviewNote: { color: COLORS.dim, fontSize: 8, lineHeight: 12, marginTop: 10 },
  placeholder: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: COLORS.line, backgroundColor: '#111914' },
  placeholderCompact: { minHeight: 76, borderWidth: 0, backgroundColor: 'transparent' },
  placeholderIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#1B2B20', alignItems: 'center', justifyContent: 'center' },
});
