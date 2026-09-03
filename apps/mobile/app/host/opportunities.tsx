import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  discoverOpportunities,
  listHostOpportunities,
  previewOpportunityFromUrl,
  saveDiscoveredOpportunity,
  saveImportedOpportunity,
  setOpportunityStage,
  updateOpportunityTags,
  type DiscoveredOpportunity,
  type OpportunityPreview,
  type OpportunityRelevance,
  type SavedOpportunity,
} from '../../src/hosting/opportunities';
import { AppIcon, type AppIconName } from '../../src/ui/AppIcon';

type PageTab = 'discover' | 'saved' | 'pipeline';
type ImportMode = 'link' | 'manual' | 'file';
type Source = { id: string; label: string; copy: string };

const COLORS = { ink:'#0A0F0C', panel:'#141D17', panelSoft:'#18231C', line:'#2E3A33', cream:'#FFF8E8', muted:'#9AA69E', dim:'#76827A', gold:'#D7B45A', orange:'#E7A05C', green:'#84C992', danger:'#EA806E' };
const SOURCES: Source[] = [
  { id:'city_jacksonville', label:'City of Jacksonville', copy:'Community and city event calendar' },
  { id:'visit_jacksonville', label:'Visit Jacksonville', copy:'Regional events and festivals' },
  { id:'jacksonville_beach', label:'Jacksonville Beach', copy:'Beaches events, markets and festivals' },
];
const STAGES = ['discovered','reviewing','applied','approved','scheduled'] as const;

export default function HostOpportunitiesScreen() {
  const [tab,setTab] = useState<PageTab>('discover');
  const [mode,setMode] = useState<ImportMode>('link');
  const [url,setUrl] = useState('');
  const [preview,setPreview] = useState<OpportunityPreview | null>(null);
  const [previewSourceLabel,setPreviewSourceLabel] = useState('External source');
  const [importing,setImporting] = useState(false);
  const [sourceLoading,setSourceLoading] = useState('');
  const [discovered,setDiscovered] = useState<Array<DiscoveredOpportunity & { sourceId:string; sourceLabel:string }>>([]);
  const [saved,setSaved] = useState<SavedOpportunity[]>([]);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');

  useEffect(() => { void refreshSaved(); }, []);

  async function refreshSaved() {
    try { setSaved(await listHostOpportunities()); } catch { setSaved([]); }
  }

  async function runDiscovery(source: Source) {
    if (sourceLoading) return;
    setSourceLoading(source.id); setError(''); setNotice('');
    try {
      const result = await discoverOpportunities(source.id);
      setDiscovered((current) => [...result.events.map((event) => ({ ...event, sourceId:result.sourceId, sourceLabel:result.sourceLabel })), ...current.filter((item) => item.sourceId !== source.id)]);
      setNotice(result.events.length ? `${result.events.length} events found from ${result.sourceLabel}.` : `No upcoming events were found from ${result.sourceLabel}.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to discover events from this source.'); }
    finally { setSourceLoading(''); }
  }

  async function importOpportunity() {
    const cleanUrl = url.trim();
    if (!/^https:\/\/\S+/i.test(cleanUrl) || importing) return;
    setImporting(true); setError(''); setNotice(''); setPreview(null);
    try {
      const result = await previewOpportunityFromUrl(cleanUrl);
      setPreview(result.preview); setPreviewSourceLabel(result.sourceLabel || 'External source');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to import this opportunity.'); }
    finally { setImporting(false); }
  }

  async function saveDiscovery(event: DiscoveredOpportunity & { sourceId:string; sourceLabel:string }, track = false) {
    try {
      const row = await saveDiscoveredOpportunity(event,event.sourceId,event.sourceLabel);
      if (track) await setOpportunityStage(row.id,'reviewing');
      await refreshSaved();
      setNotice(track ? 'Opportunity added to Reviewing.' : 'Opportunity saved.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to save this opportunity.'); }
  }

  async function savePreview(tags: string[], track = false) {
    if (!preview) return;
    try {
      const row = await saveImportedOpportunity(preview,previewSourceLabel,tags);
      if (track) await setOpportunityStage(row.id,'reviewing');
      await refreshSaved();
      setNotice(track ? 'Opportunity saved and added to Reviewing.' : 'Opportunity saved.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to save this opportunity.'); }
  }

  async function persistTags(item: SavedOpportunity, tags: string[]) {
    try { await updateOpportunityTags(item.id,tags); await refreshSaved(); setNotice('Tags updated.'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to update tags.'); }
  }

  function scheduleOuting(event: { title:string; summary?:string; startsAt?:string | null; endsAt?:string | null; venueName?:string; city?:string; state?:string; sourceUrl:string; organizer?:string; ticketUrl?:string }) {
    const params = new URLSearchParams();
    params.set('fromOpportunity','1'); params.set('title',event.title); params.set('summary',event.summary || ''); params.set('startsAt',event.startsAt || ''); params.set('endsAt',event.endsAt || ''); params.set('venueName',event.venueName || ''); params.set('city',event.city || ''); params.set('state',event.state || 'FL'); params.set('sourceUrl',event.sourceUrl); params.set('organizer',event.organizer || ''); params.set('ticketUrl',event.ticketUrl || '');
    router.push(`/host/create-from-opportunity?${params.toString()}` as never);
  }

  const pipeline = saved.filter((item) => item.stage !== 'saved' && item.stage !== 'archived');

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => router.replace('/host' as never)}><Text style={styles.back}>‹ Host Center</Text></Pressable>
    <View style={styles.hero}><View style={styles.heroIcon}><AppIcon name="briefcase" color={COLORS.orange} size={26} /></View><Text style={styles.eyebrow}>OPPORTUNITIES</Text><Text style={styles.title}>Opportunities</Text><Text style={styles.subtitle}>Discover outside events, save ideas, pursue opportunities or turn an event into a Go Melanated outing.</Text></View>

    <View style={styles.tabs}><Tab label="Discover" active={tab === 'discover'} onPress={() => setTab('discover')} /><Tab label={`Saved ${saved.filter((item) => item.stage === 'saved').length}`} active={tab === 'saved'} onPress={() => setTab('saved')} /><Tab label={`Pipeline ${pipeline.length}`} active={tab === 'pipeline'} onPress={() => setTab('pipeline')} /></View>
    {error ? <Text style={styles.error}>{error}</Text> : null}{notice ? <Text style={styles.notice}>{notice}</Text> : null}

    {tab === 'discover' ? <>
      <Text style={styles.sectionEyebrow}>LOCAL SOURCES</Text><Text style={styles.sectionTitle}>Find events around Jacksonville</Text>
      <View style={styles.sourceList}>{SOURCES.map((source) => <Pressable key={source.id} style={styles.sourceCard} onPress={() => void runDiscovery(source)}><View style={styles.sourceIcon}><AppIcon name="search" color={COLORS.gold} size={18} /></View><View style={styles.flex}><Text style={styles.rowTitle}>{source.label}</Text><Text style={styles.rowMeta}>{source.copy}</Text></View>{sourceLoading === source.id ? <ActivityIndicator color={COLORS.gold} /> : <Text style={styles.findText}>Find events</Text>}</Pressable>)}</View>
      <View style={styles.eventList}>{discovered.map((event) => <DiscoveryCard key={`${event.sourceId}-${event.sourceUrl}`} event={event} onSave={() => void saveDiscovery(event)} onTrack={() => void saveDiscovery(event,true)} onSchedule={() => scheduleOuting(event)} />)}</View>

      <View style={styles.importCard}><Text style={styles.sectionEyebrow}>ADD FROM ANY SITE</Text><Text style={styles.sectionTitle}>Paste an event or opportunity</Text><View style={styles.modeRow}><ModeButton label="Paste a link" icon="open" active={mode === 'link'} onPress={() => setMode('link')} /><ModeButton label="Add manually" icon="add" active={mode === 'manual'} onPress={() => setMode('manual')} /><ModeButton label="Flyer / file" icon="directory" active={mode === 'file'} onPress={() => setMode('file')} /></View>
      {mode === 'link' ? <><TextInput value={url} onChangeText={(value) => { setUrl(value); setPreview(null); }} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://eventbrite.com/e/..." placeholderTextColor={COLORS.dim} style={styles.input} /><Pressable disabled={!/^https:\/\/\S+/i.test(url.trim()) || importing} style={[styles.primary,(!/^https:\/\/\S+/i.test(url.trim()) || importing) && styles.disabled]} onPress={() => void importOpportunity()}>{importing ? <ActivityIndicator color={COLORS.ink} /> : <Text style={styles.primaryText}>Import opportunity</Text>}</Pressable></> : <Text style={styles.placeholderText}>{mode === 'manual' ? 'Manual entry will use the same saved opportunity record.' : 'Flyer and file extraction will use the same review flow.'}</Text>}</View>

      {preview ? <ImportedCard preview={preview} sourceLabel={previewSourceLabel} onSave={(tags) => void savePreview(tags)} onTrack={(tags) => void savePreview(tags,true)} onSchedule={() => scheduleOuting({ title:preview.title,summary:preview.summary,startsAt:preview.eventStart,endsAt:preview.eventEnd,venueName:preview.venueName,city:preview.city,state:preview.state,sourceUrl:preview.sourceUrl,organizer:preview.organizer,ticketUrl:preview.applicationUrl })} /> : null}
    </> : null}

    {tab === 'saved' ? <OpportunityList items={saved.filter((item) => item.stage === 'saved')} empty="No saved opportunities yet." onSchedule={scheduleOuting} onTrack={async (item) => { await setOpportunityStage(item.id,'reviewing'); await refreshSaved(); }} onTags={persistTags} /> : null}

    {tab === 'pipeline' ? <><Text style={styles.sectionEyebrow}>PIPELINE</Text><Text style={styles.sectionTitle}>Opportunities you are pursuing</Text>{STAGES.map((stage) => { const items = pipeline.filter((item) => item.stage === stage); return <View key={stage} style={styles.stage}><View style={styles.stageHeader}><Text style={styles.stageTitle}>{labelize(stage)}</Text><Text style={styles.stageCount}>{items.length}</Text></View>{items.map((item) => <SavedCard key={item.id} item={item} onSchedule={() => scheduleOuting(savedToOuting(item))} onTags={(tags) => void persistTags(item,tags)} />)}</View>; })}</> : null}
  </ScrollView></SafeAreaView>;
}

function ImportedCard({ preview,sourceLabel,onSave,onTrack,onSchedule }:{ preview:OpportunityPreview; sourceLabel:string; onSave:(tags:string[])=>void; onTrack:(tags:string[])=>void; onSchedule:()=>void }) {
  const [tags,setTags] = useState<string[]>([]);
  const rows = [
    ['Type',labelize(preview.opportunityType)],['Starts',formatDate(preview.eventStart)],['Ends',formatDate(preview.eventEnd)],['Venue',preview.venueName],['Address',preview.address],['City / State',[preview.city,preview.state].filter(Boolean).join(', ')],['Organizer',preview.organizer],['Vendor fee',preview.vendorFeeText],['Application deadline',formatDate(preview.applicationDeadline)],['Contact',preview.contactName || preview.contactEmail || preview.contactPhone],
  ].filter(([,value]) => Boolean(value));
  return <View style={styles.reviewCard}>
    <View style={styles.badges}><Badge text={preview.sourceUrl.includes('eventbrite.') ? 'Eventbrite sourced' : sourceLabel} /><Badge text="Review before saving" /></View>
    <Text style={styles.reviewTitle}>{preview.title || 'Imported opportunity'}</Text>{preview.summary ? <Text style={styles.cardBody}>{preview.summary}</Text> : null}
    <View style={styles.details}>{rows.map(([label,value],index) => <View key={label} style={[styles.detailRow,index > 0 && styles.detailDivider]}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>)}</View>
    {preview.ticketDetails?.length ? <ReviewList title="Ticket details" items={preview.ticketDetails} /> : null}
    {preview.boothDetails?.length ? <ReviewList title="Booth details" items={preview.boothDetails} /> : null}
    {preview.requirements?.length ? <ReviewList title="Requirements" items={preview.requirements} /> : null}
    <TagEditor tags={tags} onChange={setTags} />
    <View style={styles.actionPanel}><Text style={styles.actionEyebrow}>WHAT DO YOU WANT TO DO?</Text><Text style={styles.actionCopy}>Save it for later, actively pursue it, or turn the outside event into a meetup.</Text>
      <Pressable style={styles.saveButton} onPress={() => onSave(tags)}><Text style={styles.saveButtonText}>Save opportunity</Text></Pressable>
      <View style={styles.actions}><SmallAction label="Track in pipeline" onPress={() => onTrack(tags)} /><SmallAction label="Schedule outing" onPress={onSchedule} featured /><SmallAction label="View original" onPress={() => void Linking.openURL(preview.sourceUrl)} /></View>
    </View>
  </View>;
}

function DiscoveryCard({ event,onSave,onTrack,onSchedule }:{ event:DiscoveredOpportunity & { sourceId:string; sourceLabel:string }; onSave:()=>void; onTrack:()=>void; onSchedule:()=>void }) { return <View style={styles.card}><View style={styles.badges}><Badge text={event.sourceLabel} /><RelevanceBadge value={event.relevanceLabel} /></View><Text style={styles.cardTitle}>{event.title}</Text><Text style={styles.cardMeta}>{[formatDate(event.startsAt),event.venueName,event.city,event.state].filter(Boolean).join(' · ')}</Text>{event.summary ? <Text style={styles.cardBody}>{event.summary}</Text> : null}{event.relevanceBasis ? <Text style={styles.basis}>Why it is marked: {event.relevanceBasis}</Text> : null}<ActionRow onOpen={() => void Linking.openURL(event.sourceUrl)} onSave={onSave} onTrack={onTrack} onSchedule={onSchedule} /></View>; }

function OpportunityList({ items,empty,onSchedule,onTrack,onTags }:{ items:SavedOpportunity[]; empty:string; onSchedule:(event:ReturnType<typeof savedToOuting>)=>void; onTrack:(item:SavedOpportunity)=>void; onTags:(item:SavedOpportunity,tags:string[])=>void }) { return <View style={styles.eventList}>{items.length ? items.map((item) => <SavedCard key={item.id} item={item} onSchedule={() => onSchedule(savedToOuting(item))} onTrack={() => void onTrack(item)} onTags={(tags) => onTags(item,tags)} />) : <Text style={styles.empty}>{empty}</Text>}</View>; }
function SavedCard({ item,onSchedule,onTrack,onTags }:{ item:SavedOpportunity; onSchedule:()=>void; onTrack?:()=>void; onTags:(tags:string[])=>void }) { const [tags,setTags] = useState(item.tags || []); return <View style={styles.card}><View style={styles.badges}><VerificationBadge item={item} /><RelevanceBadge value={item.relevance_label} /></View><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.cardMeta}>{[formatDate(item.starts_at),item.venue_name,item.city,item.state].filter(Boolean).join(' · ')}</Text>{item.summary ? <Text style={styles.cardBody}>{item.summary}</Text> : null}<TagEditor tags={tags} onChange={(next) => { setTags(next); onTags(next); }} compact /><View style={styles.actions}><SmallAction label="View" onPress={() => void Linking.openURL(item.source_url)} /><SmallAction label="Schedule outing" onPress={onSchedule} featured />{onTrack ? <SmallAction label="Track opportunity" onPress={onTrack} /> : null}</View></View>; }

function TagEditor({ tags,onChange,compact=false }:{ tags:string[]; onChange:(tags:string[])=>void; compact?:boolean }) { const [input,setInput] = useState(''); const addTag = () => { const tag = input.trim(); if (!tag || tags.includes(tag)) return; onChange([...tags,tag]); setInput(''); }; return <View style={[styles.tagBox,compact && styles.tagBoxCompact]}><Text style={styles.tagLabel}>TAGS</Text><View style={styles.tagRow}>{tags.map((tag) => <Pressable key={tag} style={styles.tagChip} onPress={() => onChange(tags.filter((item) => item !== tag))}><Text style={styles.tagText}>{tag} ×</Text></Pressable>)}</View><View style={styles.tagInputRow}><TextInput value={input} onChangeText={setInput} onSubmitEditing={addTag} placeholder="Add tag, e.g. nightlife" placeholderTextColor={COLORS.dim} style={styles.tagInput} returnKeyType="done" /><Pressable style={styles.tagAdd} onPress={addTag}><Text style={styles.tagAddText}>Add tag</Text></Pressable></View></View>; }
function ReviewList({ title,items }:{ title:string; items:string[] }) { return <View style={styles.reviewList}><Text style={styles.reviewListTitle}>{title.toUpperCase()}</Text>{items.slice(0,8).map((item,index) => <Text key={`${title}-${index}`} style={styles.reviewListItem}>• {item}</Text>)}</View>; }
function Tab({ label,active,onPress }:{ label:string; active:boolean; onPress:()=>void }) { return <Pressable style={[styles.tab,active && styles.tabActive]} onPress={onPress}><Text style={[styles.tabText,active && styles.tabTextActive]}>{label}</Text></Pressable>; }
function ModeButton({ label,icon,active,onPress }:{ label:string; icon:AppIconName; active:boolean; onPress:()=>void }) { return <Pressable onPress={onPress} style={[styles.modeButton,active && styles.modeButtonActive]}><AppIcon name={icon} color={active ? COLORS.gold : COLORS.muted} size={14} /><Text style={[styles.modeText,active && styles.modeTextActive]}>{label}</Text></Pressable>; }
function ActionRow({ onOpen,onSave,onTrack,onSchedule }:{ onOpen:()=>void; onSave:()=>void; onTrack:()=>void; onSchedule:()=>void }) { return <View style={styles.actions}><SmallAction label="View" onPress={onOpen} /><SmallAction label="Save" onPress={onSave} /><SmallAction label="Track" onPress={onTrack} /><SmallAction label="Schedule outing" onPress={onSchedule} featured /></View>; }
function SmallAction({ label,onPress,featured=false }:{ label:string; onPress:()=>void; featured?:boolean }) { return <Pressable onPress={onPress} style={[styles.smallAction,featured && styles.smallActionFeatured]}><Text style={[styles.smallActionText,featured && styles.smallActionTextFeatured]}>{label}</Text></Pressable>; }
function Badge({ text }:{ text:string }) { return <View style={styles.badge}><Text style={styles.badgeText}>{text}</Text></View>; }
function VerificationBadge({ item }:{ item:SavedOpportunity }) { return <Badge text={item.verification_status === 'go_melanated_verified' ? '✓ Go Melanated Verified' : item.verification_status === 'platform_sourced' ? `${item.source_label} sourced` : 'External source'} />; }
function RelevanceBadge({ value }:{ value:OpportunityRelevance }) { if (!value) return null; return <View style={styles.relevanceBadge}><Text style={styles.relevanceText}>{labelize(value)}</Text></View>; }
function savedToOuting(item:SavedOpportunity) { return { title:item.title,summary:item.summary,startsAt:item.starts_at,endsAt:item.ends_at,venueName:item.venue_name,city:item.city,state:item.state,sourceUrl:item.source_url,organizer:item.organizer_name,ticketUrl:item.ticket_url }; }
function formatDate(value?:string | null) { if (!value) return ''; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-US',{ month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit' }); }
function labelize(value:string) { return value.replace(/_/g,' ').replace(/\b\w/g,(letter) => letter.toUpperCase()); }

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:COLORS.ink},content:{padding:18,paddingBottom:80},back:{color:COLORS.gold,fontWeight:'900',marginBottom:14},hero:{borderRadius:22,borderWidth:1,borderColor:COLORS.line,backgroundColor:COLORS.panel,padding:18},heroIcon:{width:48,height:48,borderRadius:15,backgroundColor:'#E7A05C22',alignItems:'center',justifyContent:'center',marginBottom:13},eyebrow:{color:COLORS.orange,fontSize:9,fontWeight:'900',letterSpacing:1.1},title:{color:COLORS.cream,fontSize:30,fontWeight:'900',marginTop:3},subtitle:{color:COLORS.muted,fontSize:11,lineHeight:17,marginTop:5},tabs:{flexDirection:'row',gap:6,marginTop:14},tab:{flex:1,minHeight:42,borderRadius:12,borderWidth:1,borderColor:COLORS.line,alignItems:'center',justifyContent:'center',backgroundColor:COLORS.panel},tabActive:{borderColor:'#7B6326',backgroundColor:'#302B18'},tabText:{color:COLORS.muted,fontSize:9,fontWeight:'900'},tabTextActive:{color:COLORS.gold},sectionEyebrow:{color:COLORS.gold,fontSize:8.5,fontWeight:'900',letterSpacing:1.1,marginTop:18},sectionTitle:{color:COLORS.cream,fontSize:17,fontWeight:'900',marginTop:4,marginBottom:9},sourceList:{gap:8},sourceCard:{minHeight:66,borderRadius:15,borderWidth:1,borderColor:COLORS.line,backgroundColor:COLORS.panel,flexDirection:'row',alignItems:'center',gap:10,padding:12},sourceIcon:{width:36,height:36,borderRadius:11,backgroundColor:'#D7B45A18',alignItems:'center',justifyContent:'center'},flex:{flex:1,minWidth:0},rowTitle:{color:COLORS.cream,fontSize:11,fontWeight:'900'},rowMeta:{color:COLORS.muted,fontSize:8.5,lineHeight:13,marginTop:3},findText:{color:COLORS.gold,fontSize:8.5,fontWeight:'900'},eventList:{gap:9,marginTop:10},card:{borderRadius:17,borderWidth:1,borderColor:COLORS.line,backgroundColor:COLORS.panel,padding:13},reviewCard:{borderRadius:18,borderWidth:1,borderColor:'#6B5726',backgroundColor:COLORS.panel,padding:15,marginTop:12},reviewTitle:{color:COLORS.cream,fontSize:19,fontWeight:'900',marginTop:9},cardTitle:{color:COLORS.cream,fontSize:15,fontWeight:'900',marginTop:7},cardMeta:{color:COLORS.gold,fontSize:9,lineHeight:14,marginTop:5},cardBody:{color:COLORS.muted,fontSize:9.5,lineHeight:15,marginTop:7},basis:{color:COLORS.green,fontSize:8,lineHeight:12,marginTop:7},badges:{flexDirection:'row',flexWrap:'wrap',gap:5},badge:{borderRadius:9,backgroundColor:'#283027',paddingHorizontal:7,paddingVertical:5},badgeText:{color:'#C8D1CB',fontSize:7.5,fontWeight:'900'},relevanceBadge:{borderRadius:9,backgroundColor:'#3B2D16',paddingHorizontal:7,paddingVertical:5},relevanceText:{color:'#E7C464',fontSize:7.5,fontWeight:'900'},details:{marginTop:13,borderTopWidth:1,borderTopColor:COLORS.line},detailRow:{paddingVertical:9},detailDivider:{borderTopWidth:1,borderTopColor:COLORS.line},detailLabel:{color:COLORS.dim,fontSize:7,fontWeight:'900',letterSpacing:.7,textTransform:'uppercase'},detailValue:{color:COLORS.cream,fontSize:10,fontWeight:'800',marginTop:3},reviewList:{marginTop:12},reviewListTitle:{color:COLORS.gold,fontSize:8,fontWeight:'900',letterSpacing:.8},reviewListItem:{color:COLORS.muted,fontSize:9,lineHeight:14,marginTop:4},tagBox:{marginTop:14,paddingTop:12,borderTopWidth:1,borderTopColor:COLORS.line},tagBoxCompact:{paddingTop:8,marginTop:9},tagLabel:{color:COLORS.gold,fontSize:8,fontWeight:'900',letterSpacing:.8},tagRow:{flexDirection:'row',flexWrap:'wrap',gap:5,marginTop:7},tagChip:{borderRadius:10,backgroundColor:'#243128',paddingHorizontal:8,paddingVertical:5},tagText:{color:COLORS.cream,fontSize:8,fontWeight:'800'},tagInputRow:{flexDirection:'row',gap:6,marginTop:7},tagInput:{flex:1,minHeight:38,borderRadius:10,borderWidth:1,borderColor:COLORS.line,backgroundColor:'#101711',color:COLORS.cream,paddingHorizontal:10,fontSize:9},tagAdd:{minHeight:38,borderRadius:10,borderWidth:1,borderColor:'#6B5726',paddingHorizontal:10,alignItems:'center',justifyContent:'center'},tagAddText:{color:COLORS.gold,fontSize:8.5,fontWeight:'900'},actionPanel:{marginTop:15,borderRadius:14,backgroundColor:'#101711',borderWidth:1,borderColor:'#5C4A22',padding:12},actionEyebrow:{color:COLORS.orange,fontSize:8.5,fontWeight:'900',letterSpacing:.9},actionCopy:{color:COLORS.muted,fontSize:9,lineHeight:14,marginTop:4},saveButton:{minHeight:46,borderRadius:11,backgroundColor:COLORS.gold,alignItems:'center',justifyContent:'center',marginTop:10},saveButtonText:{color:COLORS.ink,fontSize:10,fontWeight:'900'},actions:{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:10},smallAction:{minHeight:34,borderRadius:10,borderWidth:1,borderColor:COLORS.line,paddingHorizontal:10,alignItems:'center',justifyContent:'center'},smallActionFeatured:{backgroundColor:COLORS.gold,borderColor:COLORS.gold},smallActionText:{color:COLORS.cream,fontSize:8.5,fontWeight:'900'},smallActionTextFeatured:{color:COLORS.ink},importCard:{borderRadius:18,borderWidth:1,borderColor:'#5C4A22',backgroundColor:'#171912',padding:14,marginTop:18},modeRow:{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:10,marginBottom:12},modeButton:{minHeight:36,borderRadius:10,flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:9,borderWidth:1,borderColor:COLORS.line},modeButtonActive:{borderColor:'#7B6326',backgroundColor:'#302B18'},modeText:{color:COLORS.muted,fontSize:8.5,fontWeight:'900'},modeTextActive:{color:COLORS.cream},input:{minHeight:50,borderRadius:12,borderWidth:1,borderColor:'#47534B',backgroundColor:'#101711',color:COLORS.cream,paddingHorizontal:12,fontSize:11},primary:{minHeight:46,borderRadius:12,backgroundColor:COLORS.gold,alignItems:'center',justifyContent:'center',marginTop:9},disabled:{opacity:.42},primaryText:{color:COLORS.ink,fontSize:10,fontWeight:'900'},placeholderText:{color:COLORS.muted,fontSize:9,lineHeight:14,marginTop:8},error:{color:COLORS.danger,fontSize:9,lineHeight:14,marginTop:10},notice:{color:COLORS.green,fontSize:9,lineHeight:14,marginTop:10},empty:{color:COLORS.muted,fontSize:10,lineHeight:16,padding:18,textAlign:'center'},stage:{borderRadius:16,borderWidth:1,borderColor:COLORS.line,backgroundColor:'#101711',padding:10,marginTop:9},stageHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:3,paddingBottom:4},stageTitle:{color:COLORS.gold,fontSize:10,fontWeight:'900'},stageCount:{color:COLORS.muted,fontSize:9,fontWeight:'900'}
});
