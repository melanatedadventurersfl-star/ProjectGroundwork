import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getHostProfileEditorData,
  saveHostProfileEditorData,
  type HostProfileEditorData,
} from '../../src/hosts/publicProfileApi';
import { AppIcon } from '../../src/ui/AppIcon';

const COLORS = {
  bg: '#0A0F0C',
  panel: '#131B16',
  raised: '#19231C',
  line: '#2D3A32',
  cream: '#FFF8E8',
  muted: '#95A29A',
  gold: '#D7B45A',
  green: '#84C992',
  danger: '#EA806E',
};

const EMPTY_FAQ = { question: '', answer: '' };
const EMPTY_POLICY = { label: '', url: '', text: '' };

export default function HostProfileEditorScreen() {
  const [form, setForm] = useState<HostProfileEditorData | null>(null);
  const [specialtyDraft, setSpecialtyDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setForm(await getHostProfileEditorData());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to open your host profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const completion = useMemo(() => {
    if (!form) return 0;
    const required = [form.organizationName, form.tagline, form.locationSummary, form.bio];
    const completed = required.filter((value) => value.trim().length > 0).length + (form.specialties.length ? 1 : 0);
    return Math.round((completed / 5) * 100);
  }, [form]);

  function patch(next: Partial<HostProfileEditorData>) {
    setSaved(false);
    setForm((current) => current ? { ...current, ...next } : current);
  }

  function addSpecialty() {
    if (!form) return;
    const clean = specialtyDraft.trim();
    if (!clean || form.specialties.some((item) => item.toLowerCase() === clean.toLowerCase()) || form.specialties.length >= 12) return;
    patch({ specialties: [...form.specialties, clean] });
    setSpecialtyDraft('');
  }

  async function save() {
    if (!form) return;
    if (!form.organizationName.trim()) {
      setError('Add a business or organization name before publishing your host profile.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await saveHostProfileEditorData(form);
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save your host profile.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color={COLORS.gold} size="large" /><Text style={styles.muted}>Opening host profile…</Text></SafeAreaView>;
  if (!form) return <SafeAreaView style={styles.center}><Text style={styles.error}>{error || 'Host profile unavailable.'}</Text><Pressable style={styles.secondaryButton} onPress={() => router.back()}><Text style={styles.secondaryButtonText}>Back</Text></Pressable></SafeAreaView>;

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.topbar}>
        <Pressable accessibilityLabel="Back" hitSlop={10} onPress={() => router.back()}><AppIcon name="chevron-back" color={COLORS.cream} size={24} /></Pressable>
        <View style={styles.topbarCopy}><Text style={styles.eyebrow}>PUBLIC HOST PROFILE</Text><Text style={styles.title}>Your Host Profile</Text></View>
        <Pressable style={styles.previewButton} onPress={() => router.push(`/host-profile/${form.hostProfileId}` as never)}><Text style={styles.previewButtonText}>Preview</Text></Pressable>
      </View>

      <View style={styles.progressCard}>
        <View style={styles.progressCopy}><Text style={styles.progressTitle}>{completion}% profile ready</Text><Text style={styles.progressBody}>Members see this page when they tap your name from an event.</Text></View>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${completion}%` }]} /></View>
      </View>

      <View style={styles.mediaCard}>
        <View style={styles.mediaIcon}><AppIcon name="photo" color={COLORS.gold} size={22} /></View>
        <View style={styles.mediaCopy}><Text style={styles.cardTitle}>Profile and cover photos</Text><Text style={styles.cardBody}>Your host page uses the profile and cover images from your member account.</Text></View>
        <Pressable onPress={() => router.push('/member/profile?edit=1' as never)}><Text style={styles.link}>Change photos</Text></Pressable>
      </View>

      <Section title="Identity" subtitle="The first things members see.">
        <Field label="Business or organization name" required value={form.organizationName} onChangeText={(organizationName) => patch({ organizationName })} placeholder="Melanated Adventurers" />
        <Field label="Tagline" value={form.tagline} onChangeText={(tagline) => patch({ tagline })} placeholder="Building community through adventure and connection." maxLength={120} />
        <Field label="About" value={form.bio} onChangeText={(bio) => patch({ bio })} placeholder="Tell members what you host and who your events are for." multiline maxLength={600} />
        <Field label="Public location" value={form.locationSummary} onChangeText={(locationSummary) => patch({ locationSummary })} placeholder="Jacksonville, Florida" maxLength={120} />
      </Section>

      <Section title="What you host" subtitle="Add up to 12 specialties. These appear as easy-to-scan chips.">
        <View style={styles.chips}>{form.specialties.map((specialty) => <Pressable key={specialty} style={styles.chip} onPress={() => patch({ specialties: form.specialties.filter((item) => item !== specialty) })}><Text style={styles.chipText}>{specialty}</Text><Text style={styles.chipRemove}>×</Text></Pressable>)}</View>
        <View style={styles.inlineAdd}><TextInput value={specialtyDraft} onChangeText={setSpecialtyDraft} onSubmitEditing={addSpecialty} placeholder="Camping, family events, hiking…" placeholderTextColor="#66736C" style={[styles.input, styles.inlineInput]} /><Pressable style={styles.addButton} onPress={addSpecialty}><AppIcon name="add" color="#172017" size={19} /></Pressable></View>
      </Section>

      <Section title="Contact" subtitle="Choose how members can reach you.">
        <ToggleRow label="Allow in-app messages" body="Members can contact you without seeing a private email address." value={form.acceptingMessages} onValueChange={(acceptingMessages) => patch({ acceptingMessages })} />
        <Field label="Public email" value={form.contactEmail} onChangeText={(contactEmail) => patch({ contactEmail })} placeholder="hello@example.com" keyboardType="email-address" autoCapitalize="none" />
        <ToggleRow label="Show email publicly" body="Keep this off if you want members to use in-app messaging instead." value={form.showEmail} onValueChange={(showEmail) => patch({ showEmail })} />
        <Field label="Website" value={form.websiteUrl} onChangeText={(websiteUrl) => patch({ websiteUrl })} placeholder="https://…" autoCapitalize="none" />
        <Field label="Instagram" value={form.instagramUrl} onChangeText={(instagramUrl) => patch({ instagramUrl })} placeholder="https://instagram.com/…" autoCapitalize="none" />
        <Field label="Facebook" value={form.facebookUrl} onChangeText={(facebookUrl) => patch({ facebookUrl })} placeholder="https://facebook.com/…" autoCapitalize="none" />
      </Section>

      <Section title="Availability" subtitle="Give members a quick sense of whether you are active right now.">
        <Field label="Availability status" value={form.availabilityStatus} onChangeText={(availabilityStatus) => patch({ availabilityStatus })} placeholder="Bookings open · Accepting event questions" maxLength={120} />
      </Section>

      <Section title="Frequently asked questions" subtitle="Optional. Keep the answers short and useful.">
        {form.faq.map((item, index) => <View key={`faq-${index}`} style={styles.repeatCard}>
          <Field label={`Question ${index + 1}`} value={item.question} onChangeText={(question) => patch({ faq: form.faq.map((faq, i) => i === index ? { ...faq, question } : faq) })} placeholder="Do I need my own gear?" />
          <Field label="Answer" value={item.answer} onChangeText={(answer) => patch({ faq: form.faq.map((faq, i) => i === index ? { ...faq, answer } : faq) })} placeholder="No. Rental options are listed on events when available." multiline />
          <Pressable onPress={() => patch({ faq: form.faq.filter((_, i) => i !== index) })}><Text style={styles.removeLink}>Remove question</Text></Pressable>
        </View>)}
        {form.faq.length < 10 ? <Pressable style={styles.outlineButton} onPress={() => patch({ faq: [...form.faq, { ...EMPTY_FAQ }] })}><AppIcon name="add" color={COLORS.gold} size={18} /><Text style={styles.outlineButtonText}>Add FAQ</Text></Pressable> : null}
      </Section>

      <Section title="Policies" subtitle="Optional links or short policy notes that apply across your events.">
        {form.policies.map((item, index) => <View key={`policy-${index}`} style={styles.repeatCard}>
          <Field label={`Policy ${index + 1}`} value={item.label} onChangeText={(label) => patch({ policies: form.policies.map((policy, i) => i === index ? { ...policy, label } : policy) })} placeholder="Cancellation policy" />
          <Field label="Link" value={item.url} onChangeText={(url) => patch({ policies: form.policies.map((policy, i) => i === index ? { ...policy, url } : policy) })} placeholder="https://…" autoCapitalize="none" />
          <Field label="Or short policy text" value={item.text} onChangeText={(text) => patch({ policies: form.policies.map((policy, i) => i === index ? { ...policy, text } : policy) })} placeholder="Transfers are allowed up to 48 hours before the event." multiline />
          <Pressable onPress={() => patch({ policies: form.policies.filter((_, i) => i !== index) })}><Text style={styles.removeLink}>Remove policy</Text></Pressable>
        </View>)}
        {form.policies.length < 10 ? <Pressable style={styles.outlineButton} onPress={() => patch({ policies: [...form.policies, { ...EMPTY_POLICY }] })}><AppIcon name="add" color={COLORS.gold} size={18} /><Text style={styles.outlineButtonText}>Add policy</Text></Pressable> : null}
      </Section>

      {error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text></View> : null}
      {saved ? <View style={styles.savedCard}><AppIcon name="checkmark" color={COLORS.green} size={19} /><Text style={styles.savedText}>Host profile saved.</Text></View> : null}

      <View style={styles.footerActions}>
        <Pressable disabled={saving} style={[styles.saveButton, saving && styles.disabled]} onPress={() => void save()}>{saving ? <ActivityIndicator color="#172017" /> : <><AppIcon name="checkmark" color="#172017" size={18} /><Text style={styles.saveButtonText}>Save Host Profile</Text></>}</Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => router.push(`/host-profile/${form.hostProfileId}` as never)}><Text style={styles.secondaryButtonText}>Preview Public Profile</Text></Pressable>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionSubtitle}>{subtitle}</Text><View style={styles.sectionBody}>{children}</View></View>;
}

function Field(props: ComponentProps<typeof TextInput> & { label: string; required?: boolean }) {
  const { label, required, multiline, ...inputProps } = props;
  return <View style={styles.field}><Text style={styles.label}>{label}{required ? ' *' : ''}</Text><TextInput {...inputProps} multiline={multiline} placeholderTextColor="#66736C" style={[styles.input, multiline && styles.textarea]} /></View>;
}

function ToggleRow({ label, body, value, onValueChange }: { label: string; body: string; value: boolean; onValueChange: (value: boolean) => void }) {
  return <View style={styles.toggleRow}><View style={styles.toggleCopy}><Text style={styles.toggleLabel}>{label}</Text><Text style={styles.toggleBody}>{body}</Text></View><Switch value={value} onValueChange={onValueChange} trackColor={{ false: '#303A34', true: '#76652D' }} thumbColor={value ? COLORS.gold : '#BBC4BE'} /></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  content: { padding: 18, paddingBottom: 80, maxWidth: 820, width: '100%', alignSelf: 'center' },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  topbarCopy: { flex: 1 },
  eyebrow: { color: COLORS.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: COLORS.cream, fontSize: 28, fontWeight: '900', marginTop: 2 },
  previewButton: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 9 },
  previewButtonText: { color: COLORS.cream, fontWeight: '800', fontSize: 11 },
  muted: { color: COLORS.muted },
  progressCard: { backgroundColor: '#18231D', borderWidth: 1, borderColor: '#324239', borderRadius: 18, padding: 16, gap: 12 },
  progressCopy: { gap: 3 },
  progressTitle: { color: COLORS.cream, fontWeight: '900', fontSize: 17 },
  progressBody: { color: COLORS.muted, fontSize: 11, lineHeight: 17 },
  progressTrack: { height: 6, borderRadius: 999, backgroundColor: '#2C3831', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.gold, borderRadius: 999 },
  mediaCard: { marginTop: 12, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  mediaIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#2B281A', alignItems: 'center', justifyContent: 'center' },
  mediaCopy: { flex: 1 },
  cardTitle: { color: COLORS.cream, fontSize: 13, fontWeight: '900' },
  cardBody: { color: COLORS.muted, fontSize: 10, lineHeight: 15, marginTop: 2 },
  link: { color: COLORS.gold, fontWeight: '900', fontSize: 10 },
  section: { marginTop: 26 },
  sectionTitle: { color: COLORS.cream, fontSize: 18, fontWeight: '900' },
  sectionSubtitle: { color: COLORS.muted, fontSize: 11, lineHeight: 17, marginTop: 3 },
  sectionBody: { marginTop: 12, gap: 13 },
  field: { gap: 6 },
  label: { color: '#C8D0CB', fontSize: 11, fontWeight: '800' },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.panel, color: COLORS.cream, paddingHorizontal: 13, paddingVertical: 11, fontSize: 13 },
  textarea: { minHeight: 92, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#27352C', borderWidth: 1, borderColor: '#415346', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipText: { color: '#E7EDE9', fontSize: 11, fontWeight: '800' },
  chipRemove: { color: COLORS.muted, fontSize: 15, lineHeight: 15 },
  inlineAdd: { flexDirection: 'row', gap: 8 },
  inlineInput: { flex: 1 },
  addButton: { width: 46, borderRadius: 12, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center' },
  toggleRow: { backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, borderRadius: 14, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleCopy: { flex: 1 },
  toggleLabel: { color: COLORS.cream, fontSize: 12, fontWeight: '900' },
  toggleBody: { color: COLORS.muted, fontSize: 10, lineHeight: 15, marginTop: 2 },
  repeatCard: { backgroundColor: COLORS.raised, borderWidth: 1, borderColor: COLORS.line, borderRadius: 16, padding: 13, gap: 12 },
  removeLink: { color: '#E89B8D', fontSize: 10, fontWeight: '800' },
  outlineButton: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#63582F', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  outlineButtonText: { color: COLORS.gold, fontSize: 11, fontWeight: '900' },
  errorCard: { backgroundColor: '#331D19', borderWidth: 1, borderColor: '#693A32', borderRadius: 13, padding: 12, marginTop: 18 },
  error: { color: '#FFB5AA', fontSize: 11, lineHeight: 17 },
  savedCard: { backgroundColor: '#172B20', borderWidth: 1, borderColor: '#315C40', borderRadius: 13, padding: 12, marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 8 },
  savedText: { color: '#BFE5C8', fontSize: 11, fontWeight: '800' },
  footerActions: { marginTop: 20, gap: 10 },
  saveButton: { minHeight: 50, borderRadius: 13, backgroundColor: COLORS.gold, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveButtonText: { color: '#172017', fontSize: 12, fontWeight: '900' },
  secondaryButton: { minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  secondaryButtonText: { color: COLORS.cream, fontSize: 11, fontWeight: '900' },
  disabled: { opacity: 0.55 },
});
