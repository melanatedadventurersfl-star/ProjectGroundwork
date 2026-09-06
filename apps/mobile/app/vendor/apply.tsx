import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getVendorAccess, submitVendorApplication, vendorAccessLabel, type VendorAccessRecord } from '../../src/vendor/vendorAccess';

export default function VendorApplyScreen() {
  const [record, setRecord] = useState<VendorAccessRecord | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [serviceArea, setServiceArea] = useState('');
  const [applicationNote, setApplicationNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void getVendorAccess().then(({ record: value }) => {
      if (!active) return;
      setRecord(value);
      if (value) {
        setBusinessName(value.business_name);
        setCategory(value.category);
        setServiceArea(value.service_area);
        setApplicationNote(value.application_note);
      }
    }).catch((caught) => {
      if (active) setError(caught instanceof Error ? caught.message : 'Unable to load vendor application.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const canSubmit = useMemo(() => Boolean(businessName.trim() && category.trim()), [businessName, category]);
  const locked = record?.status === 'pending' || record?.status === 'paused' || record?.status === 'revoked';

  async function submit() {
    if (!canSubmit || saving || locked) return;
    setSaving(true);
    setError('');
    try {
      const value = await submitVendorApplication({ businessName, category, serviceArea, applicationNote });
      setRecord(value);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to submit vendor application.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Loading vendor application…</Text></SafeAreaView>;

  if (record?.status === 'approved') return <SafeAreaView style={styles.center}><Text style={styles.eyebrow}>VENDOR CENTER</Text><Text style={styles.title}>Your vendor access is approved.</Text><Text style={styles.body}>You can switch into Vendor Center without signing in again.</Text><Pressable style={styles.primary} onPress={() => router.replace('/vendor' as never)}><Text style={styles.primaryText}>Open Vendor Center</Text></Pressable></SafeAreaView>;

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>VENDOR PATHWAY</Text>
      <Text style={styles.title}>Apply for Vendor Center</Text>
      <Text style={styles.body}>Vendor Center is for approved businesses that want to find opportunities, manage bookings and maintain a vendor profile in Go Melanated.</Text>

      {record ? <View style={styles.statusCard}><Text style={styles.statusLabel}>APPLICATION STATUS</Text><Text style={styles.statusTitle}>{vendorAccessLabel(record.status)}</Text><Text style={styles.statusBody}>{record.status === 'pending' ? 'Your application is in review. You can keep using the member app while you wait.' : record.status === 'needs_info' ? 'Update the fields below and resubmit your application.' : record.status === 'declined' ? 'You can revise the application and submit it again.' : 'Contact Go Melanated if you need help with this access status.'}</Text></View> : null}

      <View style={styles.form}>
        <Text style={styles.label}>Business name</Text>
        <TextInput editable={!locked} value={businessName} onChangeText={setBusinessName} placeholder="Your business" placeholderTextColor="#738078" style={styles.input} />
        <Text style={styles.label}>Vendor category</Text>
        <TextInput editable={!locked} value={category} onChangeText={setCategory} placeholder="Catering, photography, apparel…" placeholderTextColor="#738078" style={styles.input} />
        <Text style={styles.label}>Service area</Text>
        <TextInput editable={!locked} value={serviceArea} onChangeText={setServiceArea} placeholder="Jacksonville, Northeast Florida…" placeholderTextColor="#738078" style={styles.input} />
        <Text style={styles.label}>About your business</Text>
        <TextInput editable={!locked} value={applicationNote} onChangeText={setApplicationNote} placeholder="What do you offer and what kinds of events do you serve?" placeholderTextColor="#738078" multiline textAlignVertical="top" style={[styles.input, styles.textarea]} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!locked ? <Pressable disabled={!canSubmit || saving} style={[styles.primary, (!canSubmit || saving) && styles.disabled]} onPress={() => void submit()}>{saving ? <ActivityIndicator color="#172017" /> : <Text style={styles.primaryText}>{record ? 'Resubmit Application' : 'Submit Application'}</Text>}</Pressable> : null}
        <Pressable style={styles.secondary} onPress={() => router.replace('/(tabs)' as never)}><Text style={styles.secondaryText}>Return to Member App</Text></Pressable>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#09100C' }, center: { flex: 1, backgroundColor: '#09100C', alignItems: 'center', justifyContent: 'center', padding: 24 }, content: { width: '100%', maxWidth: 640, alignSelf: 'center', padding: 20, paddingBottom: 80 },
  eyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, title: { color: '#FFF8E8', fontSize: 30, lineHeight: 36, fontWeight: '900', marginTop: 4 }, body: { color: '#99A69E', fontSize: 12, lineHeight: 18, marginTop: 7, maxWidth: 560 }, muted: { color: '#8E9A92', fontSize: 11, marginTop: 8 },
  statusCard: { borderRadius: 16, borderWidth: 1, borderColor: '#625529', backgroundColor: '#1E1B10', padding: 14, marginTop: 18 }, statusLabel: { color: '#D7B45A', fontSize: 8, fontWeight: '900', letterSpacing: 1 }, statusTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900', marginTop: 4 }, statusBody: { color: '#99917B', fontSize: 10, lineHeight: 15, marginTop: 4 },
  form: { borderRadius: 20, borderWidth: 1, borderColor: '#314037', backgroundColor: '#121A15', padding: 16, marginTop: 18 }, label: { color: '#C8D0CB', fontSize: 9.5, fontWeight: '800', marginTop: 10, marginBottom: 5 }, input: { minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: '#35423A', backgroundColor: '#0D1410', paddingHorizontal: 12, color: '#FFF8E8', fontSize: 13 }, textarea: { minHeight: 110, paddingTop: 12 }, error: { color: '#FF9D92', fontSize: 10, lineHeight: 15, marginTop: 10 },
  primary: { minHeight: 50, borderRadius: 13, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 16, paddingHorizontal: 16 }, primaryText: { color: '#172017', fontSize: 12, fontWeight: '900' }, secondary: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: '#3A473F', alignItems: 'center', justifyContent: 'center', marginTop: 9 }, secondaryText: { color: '#D0D8D3', fontSize: 11, fontWeight: '900' }, disabled: { opacity: 0.42 },
});
