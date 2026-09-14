import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getActiveOrganization, type OrganizationWorkspace } from '../platform/organizations';
import { AppIcon } from '../ui/AppIcon';
import {
  discoverOpportunities,
  findHostOpportunityBySourceUrl,
  listHostOpportunities,
  previewOpportunityFromUrl,
  refreshImportedOpportunity,
  saveDiscoveredOpportunity,
  saveImportedOpportunity,
  setOpportunityStage,
  type DiscoveredOpportunity,
  type OpportunityPreview,
  type SavedOpportunity,
} from './opportunities';
import { listOpportunityDiscoverySources, type OpportunityDiscoverySource } from './opportunitySources';

type PageTab = 'discover' | 'saved' | 'pipeline';

type DiscoveryRow = DiscoveredOpportunity & {
  sourceId: string;
  sourceLabel: string;
};

const C = {
  bg: '#0A0F0C', panel: '#141D17', raised: '#18231C', line: '#2E3A33', cream: '#FFF8E8', muted: '#9AA69E', dim: '#76827A',
  gold: '#D7B45A', orange: '#E7A05C', green: '#84C992', danger: '#EA806E',
};

export default function TenantOpportunitiesScreen() {
  const [organization, setOrganization] = useState<OrganizationWorkspace | null>(null);
  const [sources, setSources] = useState<OpportunityDiscoverySource[]>([]);
  const [tab, setTab] = useState<PageTab>('discover');
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<OpportunityPreview | null>(null);
  const [previewSourceLabel, setPreviewSourceLabel] = useState('External source');
  const [existingPreview, setExistingPreview] = useState<SavedOpportunity | null>(null);
  const [discovered, setDiscovered] = useState<DiscoveryRow[]>([]);
  const [saved, setSaved] = useState<SavedOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [sourceLoading, setSourceLoading] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let mounted = true;
    void Promise.all([getActiveOrganization(), listOpportunityDiscoverySources(), listHostOpportunities()])
      .then(([active, nextSources, nextSaved]) => {
        if (!mounted) return;
        setOrganization(active);
        setSources(nextSources);
        setSaved(nextSaved);
      })
      .catch((caught) => {
        if (mounted) setError(caught instanceof Error ? caught.message : 'Unable to load opportunities.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  async function refreshSaved() {
    setSaved(await listHostOpportunities());
  }

  const savedOnly = useMemo(() => saved.filter((item) => item.stage === 'saved'), [saved]);
  const pipeline = useMemo(() => saved.filter((item) => item.stage !== 'saved' && item.stage !== 'archived'), [saved]);

  async function runDiscovery(source: OpportunityDiscoverySource) {
    if (sourceLoading) return;
    setSourceLoading(source.id);
    setError('');
    setNotice('');
    try {
      const result = await discoverOpportunities(source.id);
      setDiscovered((current) => [
        ...result.events.map((event) => ({ ...event, sourceId: result.sourceId, sourceLabel: result.sourceLabel })),
        ...current.filter((item) => item.sourceId !== source.id),
      ]);
      setNotice(result.events.length ? `${result.events.length} events found from ${result.sourceLabel}.` : `No upcoming events were found from ${result.sourceLabel}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to discover events from this source.');
    } finally {
      setSourceLoading('');
    }
  }

  async function importOpportunity() {
    const cleanUrl = url.trim();
    if (!/^https:\/\/\S+/i.test(cleanUrl) || importing) return;
    setImporting(true);
    setError('');
    setNotice('');
    setPreview(null);
    setExistingPreview(null);
    try {
      const result = await previewOpportunityFromUrl(cleanUrl);
      setPreview(result.preview);
      setPreviewSourceLabel(result.sourceLabel || 'External source');
      const existing = await findHostOpportunityBySourceUrl(result.preview.sourceUrl);
      setExistingPreview(existing);
      if (existing) setNotice(`This opportunity is already in ${existing.stage === 'saved' ? 'Saved' : 'Pipeline'}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to import this opportunity.');
    } finally {
      setImporting(false);
    }
  }

  async function saveDiscovery(event: DiscoveryRow, track = false) {
    try {
      const row = await saveDiscoveredOpportunity(event, event.sourceId, event.sourceLabel);
      if (track) await setOpportunityStage(row.id, 'reviewing');
      await refreshSaved();
      setTab(track ? 'pipeline' : 'saved');
      setNotice(track ? `Added “${row.title}” to Reviewing.` : `Saved “${row.title}”.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save this opportunity.');
    }
  }

  async function savePreview(track = false) {
    if (!preview) return;
    try {
      const row = await saveImportedOpportunity(preview, previewSourceLabel);
      if (track) await setOpportunityStage(row.id, 'reviewing');
      await refreshSaved();
      setExistingPreview(track ? { ...row, stage: 'reviewing' } : row);
      setTab(track ? 'pipeline' : 'saved');
      setNotice(track ? `Saved “${row.title}” and added it to Reviewing.` : `Saved “${row.title}”.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save this opportunity.');
    }
  }

  async function refreshPreview() {
    if (!preview || !existingPreview) return;
    try {
      const row = await refreshImportedOpportunity(existingPreview.id, preview, previewSourceLabel);
      await refreshSaved();
      setExistingPreview(row);
      setNotice(`Updated “${row.title}” while keeping its workspace state.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to refresh the saved opportunity.');
    }
  }

  function scheduleEvent(event: {
    title: string;
    summary?: string;
    startsAt?: string | null;
    endsAt?: string | null;
    venueName?: string;
    city?: string;
    state?: string;
    sourceUrl: string;
    organizer?: string;
    ticketUrl?: string;
  }) {
    const params = new URLSearchParams();
    params.set('fromOpportunity', '1');
    params.set('title', event.title || 'New Event');
    params.set('summary', event.summary || '');
    params.set('startsAt', event.startsAt || '');
    params.set('endsAt', event.endsAt || '');
    params.set('venueName', event.venueName || '');
    params.set('city', event.city || '');
    params.set('state', event.state || '');
    params.set('sourceUrl', event.sourceUrl);
    params.set('organizer', event.organizer || '');
    params.set('ticketUrl', event.ticketUrl || '');
    router.push(`/host/create-from-opportunity?${params.toString()}` as never);
  }

  if (loading) {
    return <SafeAreaView style={styles.center}><ActivityIndicator color={C.gold} size="large" /><Text style={styles.muted}>Loading opportunities…</Text></SafeAreaView>;
  }

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => router.replace('/host' as never)}><Text style={styles.back}>‹ Host Center</Text></Pressable>
      <View style={styles.hero}>
        <View style={styles.heroIcon}><AppIcon name="briefcase" color={C.orange} size={25} /></View>
        <Text style={styles.eyebrow}>{organization?.name?.toUpperCase() || 'ORGANIZATION'}</Text>
        <Text style={styles.title}>Opportunities</Text>
        <Text style={styles.subtitle}>Bring in leads, discover events from your organization’s approved sources, and move useful opportunities into action.</Text>
      </View>

      <View style={styles.tabs}>
        <Tab label="Discover" active={tab === 'discover'} onPress={() => setTab('discover')} />
        <Tab label={`Saved ${savedOnly.length}`} active={tab === 'saved'} onPress={() => setTab('saved')} />
        <Tab label={`Pipeline ${pipeline.length}`} active={tab === 'pipeline'} onPress={() => setTab('pipeline')} />
      </View>

      {error ? <Notice text={error} error /> : null}
      {notice ? <Notice text={notice} /> : null}

      {tab === 'discover' ? <>
        <View style={styles.panel}>
          <Text style={styles.sectionEyebrow}>ADD OPPORTUNITY</Text>
          <Text style={styles.sectionTitle}>Bring in a public link</Text>
          <Text style={styles.body}>Paste an event, vendor, venue, partnership, sponsorship, or other public opportunity link. You review extracted details before saving.</Text>
          <TextInput
            value={url}
            onChangeText={(value) => { setUrl(value); setPreview(null); setExistingPreview(null); }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="https://…"
            placeholderTextColor={C.dim}
            style={styles.input}
          />
          <Pressable disabled={!/^https:\/\/\S+/i.test(url.trim()) || importing} style={[styles.primary, (!/^https:\/\/\S+/i.test(url.trim()) || importing) && styles.disabled]} onPress={() => void importOpportunity()}>
            {importing ? <ActivityIndicator color={C.bg} /> : <Text style={styles.primaryText}>Import opportunity</Text>}
          </Pressable>
        </View>

        {preview ? <View style={styles.card}>
          {preview.imageUrl ? <Image source={{ uri: preview.imageUrl }} style={styles.image} resizeMode="cover" /> : null}
          <Text style={styles.cardEyebrow}>{previewSourceLabel.toUpperCase()}</Text>
          <Text style={styles.cardTitle}>{preview.title || 'Imported opportunity'}</Text>
          {preview.eventStart ? <Text style={styles.meta}>{formatDate(preview.eventStart)}</Text> : null}
          {[preview.venueName, [preview.city, preview.state].filter(Boolean).join(', ')].filter(Boolean).map((value) => <Text key={value} style={styles.meta}>{value}</Text>)}
          {preview.summary ? <Text style={styles.body}>{preview.summary}</Text> : null}
          <View style={styles.actions}>
            {existingPreview
              ? <Action label="Refresh saved details" onPress={() => void refreshPreview()} />
              : <><Action label="Save" onPress={() => void savePreview()} /><Action label="Track" onPress={() => void savePreview(true)} /></>}
            <Action label="Create event" onPress={() => scheduleEvent({ title: preview.title, summary: preview.summary, startsAt: preview.eventStart, endsAt: preview.eventEnd, venueName: preview.venueName, city: preview.city, state: preview.state, sourceUrl: preview.sourceUrl, organizer: preview.organizer, ticketUrl: preview.ticketUrl || preview.applicationUrl })} featured />
          </View>
        </View> : null}

        <Text style={styles.sectionEyebrow}>DISCOVERY SOURCES</Text>
        <Text style={styles.sectionTitle}>Approved for this organization</Text>
        {sources.length ? <View style={styles.sourceList}>
          {sources.map((source) => <Pressable key={source.id} style={styles.sourceCard} onPress={() => void runDiscovery(source)}>
            <View style={styles.sourceIcon}><AppIcon name="search" color={C.gold} size={18} /></View>
            <View style={styles.flex}><Text style={styles.rowTitle}>{source.label}</Text><Text style={styles.meta}>{source.copy}</Text></View>
            {sourceLoading === source.id ? <ActivityIndicator color={C.gold} /> : <Text style={styles.findText}>Find</Text>}
          </Pressable>)}
        </View> : <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No discovery sources configured</Text>
          <Text style={styles.body}>This client does not inherit another organization’s sources. You can still paste a public opportunity link above.</Text>
        </View>}

        {discovered.map((event) => <View key={`${event.sourceId}-${event.sourceUrl}`} style={styles.card}>
          {event.imageUrl ? <Image source={{ uri: event.imageUrl }} style={styles.image} resizeMode="cover" /> : null}
          <Text style={styles.cardEyebrow}>{event.sourceLabel.toUpperCase()}</Text>
          <Text style={styles.cardTitle}>{event.title}</Text>
          {event.startsAt ? <Text style={styles.meta}>{formatDate(event.startsAt)}</Text> : null}
          {[event.venueName, [event.city, event.state].filter(Boolean).join(', ')].filter(Boolean).map((value) => <Text key={value} style={styles.meta}>{value}</Text>)}
          {event.summary ? <Text style={styles.body}>{event.summary}</Text> : null}
          {event.relevanceLabel ? <Text style={styles.relevance}>Verified organization priority match</Text> : null}
          <View style={styles.actions}>
            <Action label="View source" onPress={() => void Linking.openURL(event.sourceUrl)} />
            <Action label="Save" onPress={() => void saveDiscovery(event)} />
            <Action label="Track" onPress={() => void saveDiscovery(event, true)} />
            <Action label="Create event" onPress={() => scheduleEvent(event)} featured />
          </View>
        </View>)}
      </> : null}

      {tab === 'saved' ? <OpportunityList items={savedOnly} empty="No saved opportunities for this organization." onOpen={(item) => router.push(`/host/opportunity/${item.id}` as never)} onCreate={scheduleEvent} /> : null}
      {tab === 'pipeline' ? <OpportunityList items={pipeline} empty="No opportunities in this organization’s pipeline." onOpen={(item) => router.push(`/host/opportunity/${item.id}` as never)} onCreate={scheduleEvent} /> : null}
    </ScrollView>
  </SafeAreaView>;
}

function OpportunityList({ items, empty, onOpen, onCreate }: { items: SavedOpportunity[]; empty: string; onOpen: (item: SavedOpportunity) => void; onCreate: (event: { title:string; summary?:string; startsAt?:string|null; endsAt?:string|null; venueName?:string; city?:string; state?:string; sourceUrl:string; organizer?:string; ticketUrl?:string }) => void }) {
  if (!items.length) return <View style={styles.empty}><Text style={styles.emptyTitle}>{empty}</Text></View>;
  return <View style={styles.list}>{items.map((item) => <View key={item.id} style={styles.card}>
    <Text style={styles.cardEyebrow}>{item.stage.toUpperCase()}</Text>
    <Text style={styles.cardTitle}>{item.title}</Text>
    {item.starts_at ? <Text style={styles.meta}>{formatDate(item.starts_at)}</Text> : null}
    {[item.venue_name, [item.city, item.state].filter(Boolean).join(', ')].filter(Boolean).map((value) => <Text key={value} style={styles.meta}>{value}</Text>)}
    {item.summary ? <Text style={styles.body}>{item.summary}</Text> : null}
    <View style={styles.actions}>
      <Action label="Open workspace" onPress={() => onOpen(item)} />
      <Action label="Create event" onPress={() => onCreate({ title:item.title, summary:item.summary, startsAt:item.starts_at, endsAt:item.ends_at, venueName:item.venue_name, city:item.city, state:item.state, sourceUrl:item.source_url, organizer:item.organizer_name, ticketUrl:item.ticket_url })} featured />
    </View>
  </View>)}</View>;
}

function Tab({ label, active, onPress }: { label:string; active:boolean; onPress:()=>void }) {
  return <Pressable style={[styles.tab, active && styles.tabActive]} onPress={onPress}><Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text></Pressable>;
}

function Action({ label, onPress, featured = false }: { label:string; onPress:()=>void; featured?:boolean }) {
  return <Pressable style={[styles.action, featured && styles.actionFeatured]} onPress={onPress}><Text style={[styles.actionText, featured && styles.actionTextFeatured]}>{label}</Text></Pressable>;
}

function Notice({ text, error = false }: { text:string; error?:boolean }) {
  return <View style={[styles.notice, error && styles.noticeError]}><Text style={[styles.noticeText, error && styles.noticeErrorText]}>{text}</Text></View>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit' });
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:C.bg},center:{flex:1,backgroundColor:C.bg,alignItems:'center',justifyContent:'center',gap:10,padding:24},content:{padding:20,paddingBottom:110,gap:12},
  back:{color:C.gold,fontWeight:'900',marginBottom:4},hero:{paddingVertical:8},heroIcon:{width:48,height:48,borderRadius:15,backgroundColor:'#2A1F16',alignItems:'center',justifyContent:'center',marginBottom:10},
  eyebrow:{color:C.orange,fontSize:10,fontWeight:'900',letterSpacing:1.1},title:{color:C.cream,fontSize:32,fontWeight:'900',marginTop:3},subtitle:{color:C.muted,fontSize:12,lineHeight:18,marginTop:6,maxWidth:680},
  tabs:{flexDirection:'row',gap:7,backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:15,padding:5},tab:{flex:1,minHeight:40,borderRadius:11,alignItems:'center',justifyContent:'center'},tabActive:{backgroundColor:C.raised},tabText:{color:C.muted,fontSize:10,fontWeight:'900'},tabTextActive:{color:C.cream},
  panel:{backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:18,padding:15,gap:10},sectionEyebrow:{color:C.gold,fontSize:9,fontWeight:'900',letterSpacing:1.1,marginTop:8},sectionTitle:{color:C.cream,fontSize:18,fontWeight:'900'},body:{color:C.muted,fontSize:11,lineHeight:17},
  input:{minHeight:46,borderWidth:1,borderColor:C.line,borderRadius:12,backgroundColor:C.bg,color:C.cream,paddingHorizontal:12,fontSize:12},primary:{minHeight:44,borderRadius:12,backgroundColor:C.gold,alignItems:'center',justifyContent:'center'},primaryText:{color:C.bg,fontSize:11,fontWeight:'900'},disabled:{opacity:.45},
  notice:{backgroundColor:'#15241A',borderWidth:1,borderColor:'#31513A',borderRadius:13,padding:11},noticeError:{backgroundColor:'#291714',borderColor:'#694037'},noticeText:{color:C.green,fontSize:11,lineHeight:16},noticeErrorText:{color:'#FFB4A9'},
  sourceList:{gap:8},sourceCard:{minHeight:70,borderRadius:15,borderWidth:1,borderColor:C.line,backgroundColor:C.panel,padding:12,flexDirection:'row',alignItems:'center',gap:11},sourceIcon:{width:38,height:38,borderRadius:12,backgroundColor:'#292516',alignItems:'center',justifyContent:'center'},flex:{flex:1},rowTitle:{color:C.cream,fontSize:13,fontWeight:'900'},findText:{color:C.gold,fontSize:10,fontWeight:'900'},meta:{color:C.muted,fontSize:10.5,lineHeight:15,marginTop:2},
  card:{backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:18,padding:14,gap:5,overflow:'hidden'},image:{height:170,borderRadius:13,backgroundColor:C.raised,marginBottom:6},cardEyebrow:{color:C.gold,fontSize:9,fontWeight:'900',letterSpacing:.9},cardTitle:{color:C.cream,fontSize:17,fontWeight:'900'},relevance:{color:C.green,fontSize:9.5,fontWeight:'800',marginTop:4},
  actions:{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:9},action:{minHeight:38,borderRadius:10,borderWidth:1,borderColor:C.line,paddingHorizontal:11,alignItems:'center',justifyContent:'center'},actionFeatured:{backgroundColor:C.gold,borderColor:C.gold},actionText:{color:C.cream,fontSize:10,fontWeight:'900'},actionTextFeatured:{color:C.bg},
  empty:{backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:16,padding:18},emptyTitle:{color:C.cream,fontSize:13,fontWeight:'900'},muted:{color:C.muted,fontSize:11},list:{gap:9},
});
