import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createEventFromDraft, previewHostImport, type EventDraft, type ImportPreviewResult } from '../../src/hosting/creation';
import { uploadAndPreviewHostImport } from '../../src/hosting/importUploads';
import { applyReviewedImportUpdate, diffImportedEvent, loadExistingEventForImport, type EventUpdateField, type ExistingEventSnapshot } from '../../src/hosting/importUpdates';

type FileInputMode = 'upload' | 'paste' | 'link';
type UploadPreviewResult = ImportPreviewResult & { files?: { name: string; mimeType: string; size: number | null }[] };

const pickerTypes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'text/plain',
  'text/html',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

export default function ImportEventScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const fileMode = params.mode === 'files';
  const [inputMode, setInputMode] = useState<FileInputMode>('upload');
  const [selectedFiles, setSelectedFiles] = useState<DocumentPicker.DocumentPickerAsset[]>([]);
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [result, setResult] = useState<UploadPreviewResult | null>(null);
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [existing, setExisting] = useState<ExistingEventSnapshot | null>(null);
  const [selectedChanges, setSelectedChanges] = useState<EventUpdateField[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const counts = useMemo(() => draft ? {
    schedule: draft.schedule.length,
    tickets: draft.tickets.length,
    meals: draft.meals.length,
    policies: draft.policies.length,
    photos: draft.photos.length,
  } : null, [draft]);

  const changes = useMemo(() => existing && draft ? diffImportedEvent(existing, draft) : [], [existing, draft]);

  async function chooseFiles() {
    setError('');
    const picked = await DocumentPicker.getDocumentAsync({ multiple: true, type: pickerTypes, copyToCacheDirectory: true });
    if (picked.canceled) return;
    setSelectedFiles((current) => {
      const seen = new Set(current.map((file) => `${file.name}-${file.size ?? 0}`));
      const additions = picked.assets.filter((file) => !seen.has(`${file.name}-${file.size ?? 0}`));
      return [...current, ...additions].slice(0, 12);
    });
  }

  function removeFile(index: number) {
    setSelectedFiles((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  async function analyze() {
    setLoading(true);
    setError('');
    setExisting(null);
    setSelectedChanges([]);
    try {
      let next: UploadPreviewResult;
      if (fileMode && inputMode === 'upload') {
        next = await uploadAndPreviewHostImport(selectedFiles.map((file) => ({ uri: file.uri, name: file.name, mimeType: file.mimeType, size: file.size })));
      } else {
        const mode = fileMode ? (inputMode === 'paste' ? 'pasted_text' : 'file_url') : 'event_site';
        next = await previewHostImport({ mode, sourceUrl: mode === 'pasted_text' ? undefined : sourceUrl, sourceText: mode === 'pasted_text' ? sourceText : undefined });
      }
      setResult(next);
      setDraft(next.preview);
      if (next.duplicate?.adventureId) {
        const match = await loadExistingEventForImport(next.duplicate.adventureId);
        setExisting(match);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to import these event materials.');
    } finally {
      setLoading(false);
    }
  }

  function setField<K extends keyof EventDraft>(key: K, value: EventDraft[K]) {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  }

  function toggleChange(field: EventUpdateField) {
    setSelectedChanges((current) => current.includes(field) ? current.filter((value) => value !== field) : [...current, field]);
  }

  async function save() {
    if (!draft || !result) return;
    setSaving(true);
    setError('');
    try {
      if (existing) {
        const updated = await applyReviewedImportUpdate({ existing, draft, importId: result.importId, fields: selectedChanges });
        if (updated.campaignSlug) router.replace(`/host/campaigns/${updated.campaignSlug}` as never);
        else router.replace(`/host/manage/${updated.adventureId}` as never);
      } else {
        const created = await createEventFromDraft(draft, { importId: result.importId });
        router.replace(`/host/campaigns/${created.campaign.slug}` as never);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : existing ? 'Unable to apply these reviewed changes.' : 'Unable to create this imported event.');
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setResult(null);
    setDraft(null);
    setExisting(null);
    setSelectedChanges([]);
    setSelectedFiles([]);
    setError('');
  }

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Create Event</Text></Pressable>
    <Text style={styles.eyebrow}>{fileMode ? 'IMPORT FILES' : 'IMPORT EVENT SITE'}</Text>
    <Text style={styles.title}>{fileMode ? 'Upload your event materials.' : 'Paste the event page.'}</Text>
    <Text style={styles.subtitle}>{fileMode ? 'Choose documents, images, or one ZIP package. Go Melanated reads them together and builds one event draft for you to review.' : 'Use a public Eventbrite, Meetup, ticketing, venue, or organization event page.'}</Text>

    {!result ? <>
      {fileMode ? <View style={styles.toggle}>
        <ModeButton active={inputMode === 'upload'} label="Upload" onPress={() => setInputMode('upload')} />
        <ModeButton active={inputMode === 'paste'} label="Paste" onPress={() => setInputMode('paste')} />
        <ModeButton active={inputMode === 'link'} label="Link" onPress={() => setInputMode('link')} />
      </View> : null}

      {fileMode && inputMode === 'upload' ? <>
        <Pressable style={styles.uploadCard} onPress={() => void chooseFiles()}>
          <View style={styles.uploadIcon}><Text style={styles.uploadIconText}>⇧</Text></View>
          <Text style={styles.uploadTitle}>Choose Files</Text>
          <Text style={styles.uploadText}>PDF, Word, ZIP, text, HTML, JPG, PNG, WebP, HEIC</Text>
          <Text style={styles.uploadLimit}>Up to 12 files, 10 MB each</Text>
        </Pressable>
        {selectedFiles.length ? <View style={styles.fileList}>
          <View style={styles.fileListHeader}><Text style={styles.fileListTitle}>{selectedFiles.length} file{selectedFiles.length === 1 ? '' : 's'} ready</Text><Pressable onPress={() => void chooseFiles()}><Text style={styles.addMore}>Add more</Text></Pressable></View>
          {selectedFiles.map((file, index) => <View key={`${file.name}-${index}`} style={styles.fileRow}>
            <View style={styles.fileBadge}><Text style={styles.fileBadgeText}>{file.name.split('.').pop()?.slice(0, 4).toUpperCase() || 'FILE'}</Text></View>
            <View style={styles.fileCopy}><Text numberOfLines={1} style={styles.fileName}>{file.name}</Text><Text style={styles.fileMeta}>{formatBytes(file.size)}</Text></View>
            <Pressable hitSlop={10} onPress={() => removeFile(index)}><Text style={styles.remove}>×</Text></Pressable>
          </View>)}
        </View> : null}
      </> : null}

      {fileMode && inputMode === 'paste' ? <TextInput value={sourceText} onChangeText={setSourceText} multiline placeholder="Paste event description, schedule, ticket details, policies, meals, or notes…" placeholderTextColor="#69736D" style={[styles.input, styles.textArea]} /> : null}
      {(!fileMode || inputMode === 'link') ? <TextInput value={sourceUrl} onChangeText={setSourceUrl} autoCapitalize="none" keyboardType="url" placeholder={fileMode ? 'https://…/event-package.pdf' : 'https://eventbrite.com/e/…'} placeholderTextColor="#69736D" style={styles.input} /> : null}

      <View style={styles.ruleCard}><Text style={styles.ruleTitle}>Go Melanated builds a draft, not a live event</Text><Text style={styles.ruleText}>Dates, ticket prices, policies, capacity, and guest-facing copy stay reviewable. Conflicts and missing information are flagged instead of silently guessed.</Text></View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={loading || (fileMode && inputMode === 'upload' && !selectedFiles.length)} style={[styles.primary, fileMode && inputMode === 'upload' && !selectedFiles.length && styles.primaryDisabled]} onPress={() => void analyze()}>{loading ? <ActivityIndicator color="#172017" /> : <Text style={styles.primaryText}>{fileMode && inputMode === 'upload' ? 'Upload & Build Event Draft' : 'Analyze Source'}</Text>}</Pressable>
    </> : null}

    {result && draft && counts ? <>
      <View style={styles.sourceCard}><Text style={styles.kicker}>SOURCE PACKAGE</Text><Text style={styles.sourceTitle}>{result.sourceLabel}</Text><Text style={styles.sourceMeta}>{result.extractionSource === 'ai' ? 'Structured extraction complete' : result.extractionSource === 'source' ? 'Built from source files' : 'Basic extraction only'}</Text></View>
      {result.files?.length ? <PreviewList title="Files analyzed" items={result.files.map((file) => `${file.name} · ${formatBytes(file.size)}`)} /> : null}

      {existing ? <View style={styles.matchCard}>
        <Text style={styles.matchEyebrow}>EXISTING EVENT FOUND</Text>
        <Text style={styles.matchTitle}>{existing.title}</Text>
        <Text style={styles.matchText}>This import will not create another event. Select only the changes you want to apply. Registrations, payments, check-ins, completed work, and assignments stay untouched.</Text>
        <Pressable onPress={() => router.push(`/host/manage/${existing.id}` as never)}><Text style={styles.duplicateAction}>Open current event →</Text></Pressable>
      </View> : result.duplicate ? <View style={styles.duplicateCard}><Text style={styles.duplicateTitle}>Previous import found</Text><Text style={styles.duplicateText}>A previous preview exists, but no existing event was linked to it.</Text></View> : null}

      {existing ? <>
        <Text style={styles.section}>UPDATE PREVIEW</Text>
        <Text style={styles.updateHelp}>{changes.length ? `${changes.length} changed field${changes.length === 1 ? '' : 's'} found. Nothing is selected by default.` : 'No core event fields changed.'}</Text>
        {changes.map((change) => {
          const selected = selectedChanges.includes(change.field);
          return <Pressable key={change.field} style={[styles.changeCard, selected && styles.changeCardSelected]} onPress={() => toggleChange(change.field)}>
            <View style={[styles.check, selected && styles.checkSelected]}><Text style={styles.checkText}>{selected ? '✓' : ''}</Text></View>
            <View style={styles.changeCopy}><Text style={styles.changeLabel}>{change.label}</Text><Text style={styles.changeCurrent}>Current: {change.current}</Text><Text style={styles.changeImported}>Imported: {change.imported}</Text></View>
          </Pressable>;
        })}
      </> : null}

      <Text style={styles.section}>{existing ? 'IMPORTED DETAILS' : 'IMPORT PREVIEW'}</Text>
      <Field label="Title" value={draft.title} onChangeText={(value: string) => setField('title', value)} />
      <Field label="Summary" value={draft.summary} onChangeText={(value: string) => setField('summary', value)} />
      <Field label="Description" value={draft.description} onChangeText={(value: string) => setField('description', value)} multiline />
      <View style={styles.row}><View style={styles.flex}><Field label="Starts" value={draft.startsAt} onChangeText={(value: string) => setField('startsAt', value)} placeholder="YYYY-MM-DDTHH:MM" /></View><View style={styles.flex}><Field label="Ends" value={draft.endsAt} onChangeText={(value: string) => setField('endsAt', value)} placeholder="YYYY-MM-DDTHH:MM" /></View></View>
      <Field label="Venue" value={draft.venueName} onChangeText={(value: string) => setField('venueName', value)} />
      <Field label="Address" value={draft.address} onChangeText={(value: string) => setField('address', value)} />
      <View style={styles.row}><View style={styles.flex}><Field label="City" value={draft.city} onChangeText={(value: string) => setField('city', value)} /></View><View style={styles.state}><Field label="State" value={draft.state} onChangeText={(value: string) => setField('state', value.toUpperCase())} /></View></View>
      <Field label="Capacity" value={draft.capacity == null ? '' : String(draft.capacity)} onChangeText={(value: string) => setField('capacity', value ? Number.parseInt(value, 10) || null : null)} keyboardType="number-pad" />

      <View style={styles.countGrid}><Metric label="Schedule" value={counts.schedule} /><Metric label="Tickets" value={counts.tickets} /><Metric label="Meals" value={counts.meals} /><Metric label="Policies" value={counts.policies} /><Metric label="Media" value={counts.photos} /></View>
      {draft.tickets.length ? <PreviewList title="Ticket details found" items={draft.tickets.map((ticket) => `${ticket.label}${ticket.priceText ? ` · ${ticket.priceText}` : ''}`)} /> : null}
      {draft.schedule.length ? <PreviewList title="Schedule found" items={draft.schedule.map((item) => `${item.time}${item.time ? ' · ' : ''}${item.title}`)} /> : null}
      {draft.meals.length ? <PreviewList title="Meals found" items={draft.meals} /> : null}
      {draft.policies.length ? <PreviewList title="Policies found" items={draft.policies} /> : null}
      {draft.confidenceNotes.length ? <PreviewList title="Needs review" items={draft.confidenceNotes} /> : null}

      {!existing ? <View style={styles.warning}><Text style={styles.warningTitle}>Imported ticket details are reference only</Text><Text style={styles.warningText}>The event starts with a $0 General Admission shell. Configure and approve actual ticket tiers before publishing.</Text></View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={saving || (existing != null && selectedChanges.length === 0)} style={[styles.primary, existing != null && selectedChanges.length === 0 && styles.primaryDisabled]} onPress={() => void save()}>{saving ? <ActivityIndicator color="#172017" /> : <Text style={styles.primaryText}>{existing ? `Apply ${selectedChanges.length} Reviewed Change${selectedChanges.length === 1 ? '' : 's'}` : 'Create Reviewed Draft Event'}</Text>}</Pressable>
      <Pressable style={styles.secondary} onPress={reset}><Text style={styles.secondaryText}>Start over</Text></Pressable>
    </> : null}
  </ScrollView></SafeAreaView>;
}

function ModeButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) { return <Pressable style={[styles.toggleButton, active && styles.toggleActive]} onPress={onPress}><Text style={[styles.toggleText, active && styles.toggleTextActive]}>{label}</Text></Pressable>; }
function Field({ label, multiline = false, ...props }: any) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} multiline={multiline} placeholderTextColor="#69736D" style={[styles.input, multiline && styles.textArea]} textAlignVertical={multiline ? 'top' : 'center'} /></View>; }
function Metric({ label, value }: { label: string; value: number }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function PreviewList({ title, items }: { title: string; items: string[] }) { return <View style={styles.previewCard}><Text style={styles.previewTitle}>{title}</Text>{items.slice(0, 12).map((item, index) => <Text key={`${title}-${index}`} style={styles.previewLine}>• {item}</Text>)}</View>; }
function formatBytes(size?: number | null) { if (!size) return 'Size unavailable'; if (size < 1024) return `${size} B`; if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`; return `${(size / (1024 * 1024)).toFixed(1)} MB`; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' }, content: { padding: 20, paddingBottom: 70 }, back: { color: '#C8D1CB', fontSize: 12, fontWeight: '900', marginBottom: 18 }, eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }, title: { color: '#FFF8E8', fontSize: 34, lineHeight: 40, fontWeight: '900', marginTop: 4 }, subtitle: { color: '#9DA7A0', fontSize: 13, lineHeight: 20, marginTop: 7, marginBottom: 18 },
  toggle: { flexDirection: 'row', borderRadius: 13, borderWidth: 1, borderColor: '#344039', overflow: 'hidden', marginBottom: 14 }, toggleButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, toggleActive: { backgroundColor: '#443616' }, toggleText: { color: '#8F9A93', fontSize: 11, fontWeight: '900' }, toggleTextActive: { color: '#E7C464' },
  uploadCard: { minHeight: 178, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#5B6D60', backgroundColor: '#131A15', alignItems: 'center', justifyContent: 'center', padding: 20 }, uploadIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#2D381F', alignItems: 'center', justifyContent: 'center' }, uploadIconText: { color: '#D7B45A', fontSize: 24, fontWeight: '900' }, uploadTitle: { color: '#FFF8E8', fontSize: 17, fontWeight: '900', marginTop: 10 }, uploadText: { color: '#8F9A93', fontSize: 10.5, textAlign: 'center', marginTop: 5 }, uploadLimit: { color: '#6E7972', fontSize: 9.5, marginTop: 5 },
  fileList: { borderRadius: 15, borderWidth: 1, borderColor: '#303A34', backgroundColor: '#151B17', padding: 12, marginTop: 10 }, fileListHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }, fileListTitle: { color: '#FFF8E8', fontSize: 11, fontWeight: '900' }, addMore: { color: '#D7B45A', fontSize: 10, fontWeight: '900' }, fileRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#27312B', paddingVertical: 7, gap: 10 }, fileBadge: { width: 42, height: 32, borderRadius: 9, backgroundColor: '#253028', alignItems: 'center', justifyContent: 'center' }, fileBadgeText: { color: '#C8D1CB', fontSize: 8, fontWeight: '900' }, fileCopy: { flex: 1 }, fileName: { color: '#DDE3DF', fontSize: 11, fontWeight: '800' }, fileMeta: { color: '#707B74', fontSize: 9, marginTop: 2 }, remove: { color: '#B9C1BC', fontSize: 24, lineHeight: 24 },
  input: { minHeight: 50, borderRadius: 13, borderWidth: 1, borderColor: '#344039', backgroundColor: '#141A16', color: '#FFF8E8', paddingHorizontal: 12, fontSize: 13 }, textArea: { minHeight: 150, paddingTop: 12 }, ruleCard: { borderRadius: 14, borderWidth: 1, borderColor: '#4B3F20', backgroundColor: '#1C1910', padding: 13, marginTop: 14 }, ruleTitle: { color: '#FFF8E8', fontSize: 12, fontWeight: '900' }, ruleText: { color: '#9F967F', fontSize: 10.5, lineHeight: 16, marginTop: 4 }, error: { color: '#FF8A80', fontSize: 11, lineHeight: 17, marginTop: 14 },
  primary: { minHeight: 52, borderRadius: 14, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 18 }, primaryDisabled: { opacity: .4 }, primaryText: { color: '#172017', fontSize: 14, fontWeight: '900' }, sourceCard: { borderRadius: 16, borderWidth: 1, borderColor: '#5A4D26', backgroundColor: '#1B1810', padding: 15 }, kicker: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: .8 }, sourceTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900', marginTop: 5 }, sourceMeta: { color: '#887F69', fontSize: 9.5, marginTop: 4 },
  duplicateCard: { borderRadius: 14, borderWidth: 1, borderColor: '#735B28', backgroundColor: '#241C0F', padding: 13, marginTop: 10 }, duplicateTitle: { color: '#F0D47B', fontSize: 12, fontWeight: '900' }, duplicateText: { color: '#BBAA7D', fontSize: 10.5, lineHeight: 16, marginTop: 4 }, duplicateAction: { color: '#D7B45A', fontSize: 10, fontWeight: '900', marginTop: 8 },
  matchCard: { borderRadius: 16, borderWidth: 1.5, borderColor: '#A8842D', backgroundColor: '#211B0E', padding: 15, marginTop: 10 }, matchEyebrow: { color: '#E3BE56', fontSize: 9, fontWeight: '900', letterSpacing: 1 }, matchTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900', marginTop: 5 }, matchText: { color: '#B6AA89', fontSize: 10.5, lineHeight: 16, marginTop: 5 }, updateHelp: { color: '#98A29C', fontSize: 10.5, lineHeight: 16, marginTop: 7 },
  changeCard: { flexDirection: 'row', gap: 10, borderRadius: 14, borderWidth: 1, borderColor: '#303A34', backgroundColor: '#151B17', padding: 12, marginTop: 8 }, changeCardSelected: { borderColor: '#D7B45A', backgroundColor: '#1D1B11' }, check: { width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: '#66726A', alignItems: 'center', justifyContent: 'center' }, checkSelected: { backgroundColor: '#D7B45A', borderColor: '#D7B45A' }, checkText: { color: '#172017', fontSize: 13, fontWeight: '900' }, changeCopy: { flex: 1 }, changeLabel: { color: '#FFF8E8', fontSize: 11, fontWeight: '900' }, changeCurrent: { color: '#808C84', fontSize: 9.5, lineHeight: 14, marginTop: 3 }, changeImported: { color: '#D9C47F', fontSize: 9.5, lineHeight: 14, marginTop: 2 },
  section: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: .9, marginTop: 22 }, field: { marginTop: 13 }, label: { color: '#D5DBD7', fontSize: 11, fontWeight: '800', marginBottom: 6 }, row: { flexDirection: 'row', gap: 10 }, flex: { flex: 1 }, state: { width: 90 },
  countGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 }, metric: { minWidth: '30%', flexGrow: 1, borderRadius: 13, borderWidth: 1, borderColor: '#303A34', backgroundColor: '#151B17', padding: 11 }, metricValue: { color: '#FFF8E8', fontSize: 18, fontWeight: '900' }, metricLabel: { color: '#7F8A83', fontSize: 9, marginTop: 2 }, previewCard: { borderRadius: 14, borderWidth: 1, borderColor: '#303A34', backgroundColor: '#151B17', padding: 13, marginTop: 10 }, previewTitle: { color: '#FFF8E8', fontSize: 12, fontWeight: '900', marginBottom: 6 }, previewLine: { color: '#9AA49E', fontSize: 10.5, lineHeight: 16, marginBottom: 2 },
  warning: { borderRadius: 14, borderWidth: 1, borderColor: '#684139', backgroundColor: '#211715', padding: 13, marginTop: 14 }, warningTitle: { color: '#F0C1B9', fontSize: 11, fontWeight: '900' }, warningText: { color: '#B3918B', fontSize: 10, lineHeight: 15, marginTop: 4 }, secondary: { minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 8 }, secondaryText: { color: '#C3CBC6', fontSize: 11, fontWeight: '900' },
});
