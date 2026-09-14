import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  eventBuilderConfigToSettings,
  resolveEventBuilderConfig,
  type EventBuilderConfig,
} from '../../src/hosting/eventBuilderConfig';
import {
  getActiveOrganization,
  hasOrganizationPermission,
  updateOrganizationEventBuilderSettings,
  type OrganizationWorkspace,
} from '../../src/platform/organizations';

function lines(values: string[]) {
  return values.join('\n');
}

function parseLines(value: string) {
  return [...new Set(value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))];
}

export default function EventBuilderSettingsScreen() {
  const [organization, setOrganization] = useState<OrganizationWorkspace | null>(null);
  const [config, setConfig] = useState<EventBuilderConfig | null>(null);
  const [eventTypes, setEventTypes] = useState('');
  const [tags, setTags] = useState('');
  const [difficultyTypes, setDifficultyTypes] = useState('');
  const [working, setWorking] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const nextOrganization = await getActiveOrganization();
        if (!nextOrganization) throw new Error('No active organization is available.');
        const allowed = await hasOrganizationPermission(nextOrganization.id, 'organization.settings.manage');
        const nextConfig = resolveEventBuilderConfig(nextOrganization);
        if (!mounted) return;
        setOrganization(nextOrganization);
        setCanManage(allowed);
        setConfig(nextConfig);
        setEventTypes(lines(nextConfig.eventTypes));
        setTags(lines(nextConfig.tags));
        setDifficultyTypes(lines(nextConfig.difficultyEventTypes));
      } catch (caught) {
        if (mounted) setError(caught instanceof Error ? caught.message : 'Unable to load event builder settings.');
      }
    })();
    return () => { mounted = false; };
  }, []);

  function patch(next: Partial<EventBuilderConfig>) {
    setConfig((current) => current ? { ...current, ...next } : current);
  }

  function patchLabel(key: keyof EventBuilderConfig['labels'], value: string) {
    setConfig((current) => current ? { ...current, labels: { ...current.labels, [key]: value } } : current);
  }

  async function save() {
    if (!organization || !config || !canManage) return;
    setWorking(true);
    setError('');
    setNotice('');
    try {
      const nextEventTypes = parseLines(eventTypes);
      if (!nextEventTypes.length) throw new Error('Add at least one event type.');
      const nextTags = parseLines(tags);
      const nextDifficultyTypes = parseLines(difficultyTypes).filter((item) => nextEventTypes.includes(item));
      const nextDefaultEventType = nextEventTypes.includes(config.defaultEventType)
        ? config.defaultEventType
        : nextEventTypes[0] ?? 'Social';
      const nextConfig: EventBuilderConfig = {
        ...config,
        eventTypes: nextEventTypes,
        tags: nextTags,
        difficultyEventTypes: nextDifficultyTypes,
        defaultEventType: nextDefaultEventType,
        defaultState: config.defaultState.trim().toUpperCase(),
        labels: {
          organizer: config.labels.organizer.trim() || 'Organizer',
          tags: config.labels.tags.trim() || 'Tags',
          memberAccess: config.labels.memberAccess.trim() || 'Members only',
          capacity: config.labels.capacity.trim() || 'Capacity',
          meetingInstructions: config.labels.meetingInstructions.trim() || 'Arrival or meeting instructions',
        },
      };
      const saved = await updateOrganizationEventBuilderSettings(
        organization.id,
        eventBuilderConfigToSettings(nextConfig),
      );
      const resolved = resolveEventBuilderConfig({ ...organization, eventBuilderSettings: saved });
      setConfig(resolved);
      setEventTypes(lines(resolved.eventTypes));
      setTags(lines(resolved.tags));
      setDifficultyTypes(lines(resolved.difficultyEventTypes));
      setNotice('Event builder settings saved.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save event builder settings.');
    } finally {
      setWorking(false);
    }
  }

  if (!config && !error) {
    return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /><Text style={styles.muted}>Loading event builder settings…</Text></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Host Setup</Text></Pressable>
        <Text style={styles.eyebrow}>EVENT BUILDER</Text>
        <Text style={styles.title}>Configure event creation</Text>
        <Text style={styles.subtitle}>Control the choices and language your team sees when it builds an event. These settings belong to this organization only.</Text>

        {organization ? <View style={styles.workspace}><Text style={styles.workspaceLabel}>WORKSPACE</Text><Text style={styles.workspaceName}>{organization.name}</Text></View> : null}

        {!canManage && organization ? (
          <View style={styles.warning}><Text style={styles.warningText}>You can view these settings, but only organization settings managers can change them.</Text></View>
        ) : null}

        {config ? (
          <>
            <Panel title="Event types" copy="One type per line. The first type becomes the fallback if the current default is removed.">
              <TextArea value={eventTypes} onChangeText={setEventTypes} editable={canManage} placeholder={'Social\nMeeting\nWorkshop'} />
              <Text style={styles.label}>Default event type</Text>
              <View style={styles.chips}>
                {parseLines(eventTypes).map((item) => (
                  <Chip key={item} label={item} active={config.defaultEventType === item} disabled={!canManage} onPress={() => patch({ defaultEventType: item })} />
                ))}
              </View>
            </Panel>

            <Panel title="Tags" copy="Tags help organizers describe an event without forcing it into several event types.">
              <TextArea value={tags} onChangeText={setTags} editable={canManage} placeholder={'Networking\nEducation\nFamily Friendly'} />
            </Panel>

            <Panel title="Conditional difficulty" copy="Only list event types where Easy, Moderate, and Challenging make sense. Leave this empty for clients that do not use difficulty.">
              <TextArea value={difficultyTypes} onChangeText={setDifficultyTypes} editable={canManage} placeholder={'Hiking\nCycling'} />
            </Panel>

            <Panel title="Language" copy="Use the terms your organization already uses with staff and attendees.">
              <Field label="Organizer label" value={config.labels.organizer} onChangeText={(value: string) => patchLabel('organizer', value)} editable={canManage} />
              <Field label="Tags label" value={config.labels.tags} onChangeText={(value: string) => patchLabel('tags', value)} editable={canManage} />
              <Field label="Member access label" value={config.labels.memberAccess} onChangeText={(value: string) => patchLabel('memberAccess', value)} editable={canManage} />
              <Field label="Capacity label" value={config.labels.capacity} onChangeText={(value: string) => patchLabel('capacity', value)} editable={canManage} />
              <Field label="Meeting instructions label" value={config.labels.meetingInstructions} onChangeText={(value: string) => patchLabel('meetingInstructions', value)} editable={canManage} />
            </Panel>

            <Panel title="Defaults" copy="Set useful starting values without making them required.">
              <View style={styles.twoCol}>
                <View style={styles.flex}><Field label="Default state" value={config.defaultState} onChangeText={(value: string) => patch({ defaultState: value })} editable={canManage} placeholder="FL" /></View>
                <View style={styles.flex}><Field label="Default capacity" value={config.defaultCapacity == null ? '' : String(config.defaultCapacity)} onChangeText={(value: string) => patch({ defaultCapacity: value.trim() ? Number.parseInt(value, 10) || null : null })} editable={canManage} keyboardType="number-pad" placeholder="No limit" /></View>
              </View>
              <Text style={styles.label}>Community visibility option</Text>
              <View style={styles.segment}>
                <Pressable disabled={!canManage} style={[styles.segmentButton, !config.showCommunityVisibility && styles.segmentActive]} onPress={() => patch({ showCommunityVisibility: false })}><Text style={[styles.segmentText, !config.showCommunityVisibility && styles.segmentTextActive]}>Hidden</Text></Pressable>
                <Pressable disabled={!canManage} style={[styles.segmentButton, config.showCommunityVisibility && styles.segmentActive]} onPress={() => patch({ showCommunityVisibility: true })}><Text style={[styles.segmentText, config.showCommunityVisibility && styles.segmentTextActive]}>Available</Text></Pressable>
              </View>
              <Text style={styles.helper}>Enable this only when the organization uses Go Melanated-style community groups for event access.</Text>
            </Panel>

            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {canManage ? <Pressable disabled={working} style={[styles.primary, working && styles.disabled]} onPress={() => void save()}>{working ? <ActivityIndicator color="#172017" /> : <Text style={styles.primaryText}>Save Event Builder</Text>}</Pressable> : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Panel({ title, copy, children }: { title: string; copy: string; children: React.ReactNode }) {
  return <View style={styles.panel}><Text style={styles.panelTitle}>{title}</Text><Text style={styles.panelCopy}>{copy}</Text>{children}</View>;
}

function Field({ label, ...props }: any) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} placeholderTextColor="#68756D" style={styles.input} /></View>;
}

function TextArea(props: any) {
  return <TextInput {...props} multiline textAlignVertical="top" placeholderTextColor="#68756D" style={styles.textArea} />;
}

function Chip({ label, active, disabled, onPress }: { label: string; active: boolean; disabled: boolean; onPress: () => void }) {
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B100D' },
  center: { flex: 1, backgroundColor: '#0B100D', alignItems: 'center', justifyContent: 'center', gap: 8 },
  muted: { color: '#819087', fontSize: 10 },
  content: { padding: 18, paddingBottom: 90, maxWidth: 760, width: '100%', alignSelf: 'center' },
  back: { color: '#D7B45A', fontSize: 11, fontWeight: '900', marginBottom: 15 },
  eyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#FFF8E8', fontSize: 29, lineHeight: 35, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#8E9A92', fontSize: 11, lineHeight: 17, marginTop: 6 },
  workspace: { alignSelf: 'flex-start', marginTop: 13, borderRadius: 10, borderWidth: 1, borderColor: '#344039', backgroundColor: '#121914', paddingHorizontal: 10, paddingVertical: 7 },
  workspaceLabel: { color: '#68756D', fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  workspaceName: { color: '#E0E6E2', fontSize: 10, fontWeight: '900', marginTop: 2 },
  warning: { marginTop: 14, borderRadius: 12, borderWidth: 1, borderColor: '#66542A', backgroundColor: '#251F12', padding: 11 },
  warningText: { color: '#DDC87E', fontSize: 10, lineHeight: 15 },
  panel: { marginTop: 16, borderRadius: 16, borderWidth: 1, borderColor: '#2D3932', backgroundColor: '#111814', padding: 14 },
  panelTitle: { color: '#EEF2EF', fontSize: 15, fontWeight: '900' },
  panelCopy: { color: '#7D8A81', fontSize: 10, lineHeight: 15, marginTop: 4, marginBottom: 8 },
  field: { marginTop: 10 },
  label: { color: '#C9D1CC', fontSize: 9.5, fontWeight: '900', marginBottom: 6 },
  input: { minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: '#3A473F', backgroundColor: '#0B120E', color: '#FFF8E8', paddingHorizontal: 11, fontSize: 16 },
  textArea: { minHeight: 116, borderRadius: 11, borderWidth: 1, borderColor: '#3A473F', backgroundColor: '#0B120E', color: '#FFF8E8', padding: 11, fontSize: 16, lineHeight: 22 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { minHeight: 36, borderRadius: 18, borderWidth: 1, borderColor: '#3A473F', backgroundColor: '#121914', paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  chipActive: { borderColor: '#8A6A25', backgroundColor: '#322A14' },
  chipText: { color: '#AAB4AE', fontSize: 9.5, fontWeight: '900' },
  chipTextActive: { color: '#E7C464' },
  twoCol: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  segment: { flexDirection: 'row', borderRadius: 11, borderWidth: 1, borderColor: '#344039', overflow: 'hidden' },
  segmentButton: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D1410' },
  segmentActive: { backgroundColor: '#322A14' },
  segmentText: { color: '#9FA9A3', fontWeight: '900', fontSize: 10 },
  segmentTextActive: { color: '#E7C464' },
  helper: { color: '#718078', fontSize: 9, lineHeight: 14, marginTop: 7 },
  notice: { color: '#8FD09E', fontSize: 10.5, marginTop: 14 },
  error: { color: '#FFAAA0', fontSize: 10.5, lineHeight: 16, marginTop: 14 },
  primary: { minHeight: 48, borderRadius: 12, backgroundColor: '#D7B45A', alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  disabled: { opacity: 0.65 },
  primaryText: { color: '#172017', fontSize: 11, fontWeight: '900' },
});
