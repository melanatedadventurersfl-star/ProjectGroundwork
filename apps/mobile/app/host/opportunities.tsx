import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  discoverOpportunities,
  findHostOpportunityBySourceUrl,
  listHostOpportunities,
  previewOpportunityFromUrl,
  refreshImportedOpportunity,
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
type Source = { id:string; label:string; copy:string };

const C = { ink:'#0A0F0C', panel:'#141D17', soft:'#18231C', line:'#2E3A33', cream:'#FFF8E8', muted:'#9AA69E', dim:'#76827A', gold:'#D7B45A', orange:'#E7A05C', green:'#84C992', danger:'#EA806E' };
const SOURCES:Source[] = [
  { id:'city_jacksonville',label:'City of Jacksonville',copy:'Community and city event calendar' },
  { id:'visit_jacksonville',label:'Visit Jacksonville',copy:'Regional events and festivals' },
  { id:'jacksonville_beach',label:'Jacksonville Beach',copy:'Beaches events, markets and festivals' },
];
const STAGES = ['discovered','reviewing','applied','approved','scheduled'] as const;

export default function HostOpportunitiesScreen() {
  const [tab,setTab] = useState<PageTab>('discover');
  const [mode,setMode] = useState<ImportMode>('link');
  const [url,setUrl] = useState('');
  const [preview,setPreview] = useState<OpportunityPreview | null>(null);
  const [existingPreview,setExistingPreview] = useState<SavedOpportunity | null>(null);
  const [previewSourceLabel,setPreviewSourceLabel] = useState('External source');
  const [importing,setImporting] = useState(false);
  const [sourceLoading,setSourceLoading] = useState('');
  const [discovered,setDiscovered] = useState<Array<DiscoveredOpportunity & { sourceId:string; sourceLabel:string }>>([]);
  const [saved,setSaved] = useState<SavedOpportunity[]>([]);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');

  useEffect(() => { void refreshSaved(); }, []);
  async function refreshSaved() { try { setSaved(await listHostOpportunities()); } catch { setSaved([]); } }

  const savedOnly = saved.filter(x => x.stage === 'saved');
  const pipeline = saved.filter(x => x.stage !== 'saved' && x.stage !== 'archived');
  const reviewing = saved.filter(x => x.stage === 'reviewing').length;
  const attention = useMemo(() => saved.filter(needsAttention),[saved]);

  async function runDiscovery(source:Source) {
    if (sourceLoading) return;
    setSourceLoading(source.id); setError(''); setNotice('');
    try {
      const result = await discoverOpportunities(source.id);
      setDiscovered(current => [...result.events.map(event => ({...event,sourceId:result.sourceId,sourceLabel:result.sourceLabel})),...current.filter(item => item.sourceId !== source.id)]);
      setNotice(result.events.length ? `${result.events.length} events found from ${result.sourceLabel}.` : `No upcoming events were found from ${result.sourceLabel}.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to discover events from this source.'); }
    finally { setSourceLoading(''); }
  }

  async function importOpportunity() {
    const cleanUrl = url.trim();
    if (!/^https:\/\/\S+/i.test(cleanUrl) || importing) return;
    setImporting(true); setError(''); setNotice(''); setPreview(null); setExistingPreview(null);
    try {
      const result = await previewOpportunityFromUrl(cleanUrl);
      setPreview(result.preview); setPreviewSourceLabel(result.sourceLabel || 'External source');
      const existing = await findHostOpportunityBySourceUrl(result.preview.sourceUrl);
      setExistingPreview(existing);
      if (existing) setNotice(`Already saved in ${existing.stage === 'saved' ? 'Saved' : 'Pipeline'}. You can refresh its details below.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to import this opportunity.'); }
    finally { setImporting(false); }
  }

  async function saveDiscovery(event:DiscoveredOpportunity & {sourceId:string;sourceLabel:string},track=false) {
    try {
      const row = await saveDiscoveredOpportunity(event,event.sourceId,event.sourceLabel);
      if (track) await setOpportunityStage(row.id,'reviewing');
      await refreshSaved(); setError('');
      if (track) { setTab('pipeline'); setNotice(`Added “${displayText(row.title)}” to Reviewing.`); }
      else { setTab('saved'); setNotice(`Saved “${displayText(row.title)}”. Open it below to add notes or a follow-up.`); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to save this opportunity.'); }
  }

  async function savePreview(tags:string[],track=false) {
    if (!preview) return;
    try {
      const row = await saveImportedOpportunity(preview,previewSourceLabel,tags);
      if (track) await setOpportunityStage(row.id,'reviewing');
      await refreshSaved(); setExistingPreview(track ? {...row,stage:'reviewing'} : row); setError('');
      if (track) { setTab('pipeline'); setNotice(`Saved “${displayText(row.title)}” and added it to Reviewing.`); }
      else { setTab('saved'); setNotice(`Saved “${displayText(row.title)}”. Open the record below to manage it.`); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to save this opportunity.'); }
  }

  async function refreshPreview() {
    if (!preview || !existingPreview) return;
    try {
      const row = await refreshImportedOpportunity(existingPreview.id,preview,previewSourceLabel);
      await refreshSaved(); setExistingPreview(row); setError(''); setTab(row.stage === 'saved' ? 'saved' : 'pipeline');
      setNotice(`Updated “${displayText(row.title)}”. Tags, notes, follow-up, and pipeline status were kept.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to refresh the saved opportunity.'); }
  }

  async function persistTags(item:SavedOpportunity,tags:string[]) {
    try { await updateOpportunityTags(item.id,tags); await refreshSaved(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to update tags.'); }
  }

  function openDetails(item:SavedOpportunity) { router.push(`/host/opportunity/${item.id}` as never); }
  function scheduleOuting(event:{title:string;summary?:string;startsAt?:string|null;endsAt?:string|null;venueName?:string;city?:string;state?:string;sourceUrl:string;organizer?:string;ticketUrl?:string}) {
    const p = new URLSearchParams();
    p.set('fromOpportunity','1'); p.set('title',displayText(event.title)); p.set('summary',displayText(event.summary || '')); p.set('startsAt',event.startsAt || ''); p.set('endsAt',event.endsAt || ''); p.set('venueName',displayText(event.venueName || '')); p.set('city',event.city || ''); p.set('state',event.state || 'FL'); p.set('sourceUrl',event.sourceUrl); p.set('organizer',displayText(event.organizer || '')); p.set('ticketUrl',event.ticketUrl || '');
    router.push(`/host/create-from-opportunity?${p.toString()}` as never);
  }

  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => router.replace('/host' as never)}><Text style={s.back}>‹ Host Center</Text></Pressable>
    <View style={s.hero}><View style={s.heroIcon}><AppIcon name="briefcase" color={C.orange} size={26}/></View><Text style={s.eyebrow}>OPPORTUNITIES</Text><Text style={s.title}>Opportunities</Text><Text style={s.subtitle}>Find events, save ideas, decide what is worth pursuing, then act.</Text></View>

    <View style={s.statusStrip}><Stat label="Saved" value={savedOnly.length}/><Stat label="Reviewing" value={reviewing}/><Stat label="Needs attention" value={attention.length}/></View>
    <View style={s.tabs}><Tab label="Discover" active={tab==='discover'} onPress={()=>setTab('discover')}/><Tab label={`Saved ${savedOnly.length}`} active={tab==='saved'} onPress={()=>setTab('saved')}/><Tab label={`Pipeline ${pipeline.length}`} active={tab==='pipeline'} onPress={()=>setTab('pipeline')}/></View>
    {error ? <Message error text={error}/> : null}{notice ? <Message text={notice}/> : null}

    {tab==='discover' ? <>
      <View style={s.importCard}><Text style={s.sectionEyebrow}>ADD OPPORTUNITY</Text><Text style={s.sectionTitle}>Bring an opportunity in</Text><View style={s.modeRow}><ModeButton label="Paste a link" icon="open" active={mode==='link'} onPress={()=>setMode('link')}/><ModeButton label="Add manually" icon="add" active={mode==='manual'} onPress={()=>setMode('manual')}/><ModeButton label="Flyer / file" icon="directory" active={mode==='file'} onPress={()=>setMode('file')}/></View>
      {mode==='link' ? <><TextInput value={url} onChangeText={value=>{setUrl(value);setPreview(null);setExistingPreview(null);}} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="Paste Eventbrite or another event link" placeholderTextColor={C.dim} style={s.input}/><Pressable disabled={!/^https:\/\/\S+/i.test(url.trim())||importing} style={[s.primary,(!/^https:\/\/\S+/i.test(url.trim())||importing)&&s.disabled]} onPress={()=>void importOpportunity()}>{importing?<ActivityIndicator color={C.ink}/>:<Text style={s.primaryText}>Import opportunity</Text>}</Pressable></> : <Text style={s.placeholderText}>{mode==='manual'?'Manual entry will save into the same opportunity workspace.':'Flyer and file extraction will use this same review flow.'}</Text>}</View>
      {preview ? <ImportedCard preview={preview} sourceLabel={previewSourceLabel} existing={existingPreview} onSave={tags=>void savePreview(tags)} onTrack={tags=>void savePreview(tags,true)} onRefresh={()=>void refreshPreview()} onSchedule={()=>scheduleOuting({title:preview.title,summary:preview.summary,startsAt:preview.eventStart,endsAt:preview.eventEnd,venueName:preview.venueName,city:preview.city,state:preview.state,sourceUrl:preview.sourceUrl,organizer:preview.organizer,ticketUrl:preview.ticketUrl||preview.applicationUrl})}/> : null}

      <Text style={s.sectionEyebrow}>SUGGESTED OPPORTUNITIES</Text><Text style={s.sectionTitle}>Find events around Jacksonville</Text>
      <View style={s.sourceList}>{SOURCES.map(source=><Pressable key={source.id} style={s.sourceCard} onPress={()=>void runDiscovery(source)}><View style={s.sourceIcon}><AppIcon name="search" color={C.gold} size={18}/></View><View style={s.flex}><Text style={s.rowTitle}>{source.label}</Text><Text style={s.rowMeta}>{source.copy}</Text></View>{sourceLoading===source.id?<ActivityIndicator color={C.gold}/>:<Text style={s.findText}>Find events</Text>}</Pressable>)}</View>
      <View style={s.eventList}>{discovered.map(event=><DiscoveryCard key={`${event.sourceId}-${event.sourceUrl}`} event={event} onSave={()=>void saveDiscovery(event)} onTrack={()=>void saveDiscovery(event,true)} onSchedule={()=>scheduleOuting(event)}/>)}</View>
    </> : null}

    {tab==='saved' ? <><AttentionPanel items={attention.filter(x=>x.stage==='saved')} onOpen={openDetails}/><Text style={s.sectionEyebrow}>SAVED</Text><Text style={s.sectionTitle}>Ideas you are considering</Text><OpportunityList items={savedOnly} empty="No saved opportunities yet." onOpen={openDetails} onSchedule={scheduleOuting} onTrack={async item=>{await setOpportunityStage(item.id,'reviewing');await refreshSaved();setTab('pipeline');setNotice(`Moved “${displayText(item.title)}” to Reviewing.`);}} onTags={persistTags}/></> : null}

    {tab==='pipeline' ? <><AttentionPanel items={attention.filter(x=>x.stage!=='saved')} onOpen={openDetails}/><Text style={s.sectionEyebrow}>PIPELINE</Text><Text style={s.sectionTitle}>Opportunities you are pursuing</Text>{STAGES.map(stage=>{const items=pipeline.filter(x=>x.stage===stage);return <View key={stage} style={s.stage}><View style={s.stageHeader}><Text style={s.stageTitle}>{labelize(stage)}</Text><Text style={s.stageCount}>{items.length}</Text></View>{items.map(item=><SavedCard key={item.id} item={item} onOpen={()=>openDetails(item)} onSchedule={()=>scheduleOuting(savedToOuting(item))} onTags={tags=>void persistTags(item,tags)}/>)}</View>;})}</> : null}
  </ScrollView></SafeAreaView>;
}

function ImportedCard({preview,sourceLabel,existing,onSave,onTrack,onRefresh,onSchedule}:{preview:OpportunityPreview;sourceLabel:string;existing:SavedOpportunity|null;onSave:(tags:string[])=>void;onTrack:(tags:string[])=>void;onRefresh:()=>void;onSchedule:()=>void}) {
  const suggested = suggestTags(preview);
  const [tags,setTags] = useState<string[]>(existing?.tags || []);
  return <View style={s.reviewCard}>
    {preview.imageUrl?<Image source={{uri:preview.imageUrl}} style={s.previewImage} resizeMode="cover"/>:null}
    <View style={s.badges}><Badge text={preview.sourceUrl.includes('eventbrite.')?'Eventbrite sourced':sourceLabel}/>{existing?<Badge text={`Already in ${existing.stage==='saved'?'Saved':'Pipeline'}`}/>:<Badge text="Not saved yet"/>}</View>
    <Text style={s.reviewTitle}>{displayText(preview.title||'Imported opportunity')}</Text>
    {preview.eventStart?<Text style={s.eventDate}>{formatDate(preview.eventStart)}</Text>:null}
    {[preview.venueName,preview.address,[preview.city,preview.state].filter(Boolean).join(', ')].filter(Boolean).map((v,i)=><Text key={i} style={s.eventLocation}>{displayText(String(v))}</Text>)}
    {preview.organizer?<Text style={s.organizer}>Hosted by {displayText(preview.organizer)}</Text>:null}
    {preview.ticketDetails?.length?<Text style={s.ticketLine}>{displayText(preview.ticketDetails.join(' · '))}</Text>:null}
    {preview.summary?<Text style={s.cardBody}>{displayText(preview.summary)}</Text>:null}
    <Text style={s.tagLabel}>SUGGESTED TAGS</Text><View style={s.tagRow}>{suggested.map(tag=><Pressable key={tag} style={[s.tagChip,tags.includes(tag)&&s.tagChipActive]} onPress={()=>setTags(tags.includes(tag)?tags.filter(x=>x!==tag):[...tags,tag])}><Text style={s.tagText}>{tag}</Text></Pressable>)}</View>
    <TagEditor tags={tags} onChange={setTags}/>
    <View style={s.actionPanel}><Text style={s.actionEyebrow}>{existing?'ALREADY SAVED':'WHAT DO YOU WANT TO DO?'}</Text><Text style={s.actionCopy}>{existing?'Refresh the saved copy with the newest details. Your notes, tags, follow-up, and stage stay intact.':'Save it for later, move it into the business pipeline, or create a Go Melanated meetup from it.'}</Text>
      {existing?<Pressable style={s.saveButton} onPress={onRefresh}><Text style={s.saveButtonText}>Refresh saved details</Text></Pressable>:<Pressable style={s.saveButton} onPress={()=>onSave(tags)}><Text style={s.saveButtonText}>Save opportunity</Text></Pressable>}
      <View style={s.actions}>{!existing?<SmallAction label="Track in pipeline" onPress={()=>onTrack(tags)}/>:null}<SmallAction label="Schedule outing" onPress={onSchedule} featured/><SmallAction label="View original" onPress={()=>void Linking.openURL(preview.sourceUrl)}/></View>
    </View>
  </View>;
}

function DiscoveryCard({event,onSave,onTrack,onSchedule}:{event:DiscoveredOpportunity & {sourceId:string;sourceLabel:string};onSave:()=>void;onTrack:()=>void;onSchedule:()=>void}) { return <View style={s.card}>{event.imageUrl?<Image source={{uri:event.imageUrl}} style={s.savedImage}/>:null}<View style={s.badges}><Badge text={event.sourceLabel}/><RelevanceBadge value={event.relevanceLabel}/></View><Text style={s.cardTitle}>{displayText(event.title)}</Text><Text style={s.cardMeta}>{[formatDate(event.startsAt),displayText(event.venueName),event.city,event.state].filter(Boolean).join(' · ')}</Text>{event.summary?<Text style={s.cardBody}>{displayText(event.summary)}</Text>:null}<ActionRow onOpen={()=>void Linking.openURL(event.sourceUrl)} onSave={onSave} onTrack={onTrack} onSchedule={onSchedule}/></View>; }
function OpportunityList({items,empty,onOpen,onSchedule,onTrack,onTags}:{items:SavedOpportunity[];empty:string;onOpen:(item:SavedOpportunity)=>void;onSchedule:(event:ReturnType<typeof savedToOuting>)=>void;onTrack:(item:SavedOpportunity)=>void;onTags:(item:SavedOpportunity,tags:string[])=>void}) { return <View style={s.eventList}>{items.length?items.map(item=><SavedCard key={item.id} item={item} onOpen={()=>onOpen(item)} onSchedule={()=>onSchedule(savedToOuting(item))} onTrack={()=>void onTrack(item)} onTags={tags=>onTags(item,tags)}/>):<Text style={s.empty}>{empty}</Text>}</View>; }
function SavedCard({item,onOpen,onSchedule,onTrack,onTags}:{item:SavedOpportunity;onOpen:()=>void;onSchedule:()=>void;onTrack?:()=>void;onTags:(tags:string[])=>void}) { const [tags,setTags]=useState(item.tags||[]); return <View style={s.card}>{item.image_url?<Image source={{uri:item.image_url}} style={s.savedImage}/>:null}<View style={s.badges}><VerificationBadge item={item}/><RelevanceBadge value={item.relevance_label}/>{item.follow_up_at?<Badge text={`Follow up ${shortDate(item.follow_up_at)}`}/>:null}</View><Pressable onPress={onOpen}><Text style={s.cardTitle}>{displayText(item.title)}</Text><Text style={s.cardMeta}>{[formatDate(item.starts_at),displayText(item.venue_name),item.city,item.state].filter(Boolean).join(' · ')}</Text>{item.summary?<Text style={s.cardBody}>{displayText(item.summary)}</Text>:null}<Text style={s.openDetails}>Open details →</Text></Pressable><TagEditor tags={tags} onChange={next=>{setTags(next);onTags(next);}} compact/><View style={s.actions}><SmallAction label="Schedule outing" onPress={onSchedule} featured/>{onTrack?<SmallAction label="Track opportunity" onPress={onTrack}/>:null}<SmallAction label="View source" onPress={()=>void Linking.openURL(item.source_url)}/></View></View>; }
function AttentionPanel({items,onOpen}:{items:SavedOpportunity[];onOpen:(item:SavedOpportunity)=>void}) { if(!items.length)return null; return <View style={s.attention}><Text style={s.sectionEyebrow}>NEEDS ATTENTION</Text>{items.slice(0,4).map(item=><Pressable key={item.id} style={s.attentionRow} onPress={()=>onOpen(item)}><View style={s.flex}><Text style={s.rowTitle}>{displayText(item.title)}</Text><Text style={s.rowMeta}>{attentionReason(item)}</Text></View><Text style={s.findText}>Open</Text></Pressable>)}</View>; }
function Stat({label,value}:{label:string;value:number}) { return <View style={s.stat}><Text style={s.statValue}>{value}</Text><Text style={s.statLabel}>{label}</Text></View>; }
function Message({text,error=false}:{text:string;error?:boolean}) { return <View style={[s.message,error?s.messageError:s.messageSuccess]}><Text style={error?s.error:s.notice}>{text}</Text></View>; }
function TagEditor({tags,onChange,compact=false}:{tags:string[];onChange:(tags:string[])=>void;compact?:boolean}) { const [input,setInput]=useState(''); const add=()=>{const tag=input.trim();if(!tag||tags.includes(tag))return;onChange([...tags,tag]);setInput('');}; return <View style={[s.tagBox,compact&&s.tagBoxCompact]}><View style={s.tagRow}>{tags.map(tag=><Pressable key={tag} style={s.tagChip} onPress={()=>onChange(tags.filter(x=>x!==tag))}><Text style={s.tagText}>{tag} ×</Text></Pressable>)}</View><View style={s.tagInputRow}><TextInput value={input} onChangeText={setInput} onSubmitEditing={add} placeholder="Add tag" placeholderTextColor={C.dim} style={s.tagInput}/><Pressable style={s.tagAdd} onPress={add}><Text style={s.tagAddText}>Add</Text></Pressable></View></View>; }
function Tab({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}) { return <Pressable style={[s.tab,active&&s.tabActive]} onPress={onPress}><Text style={[s.tabText,active&&s.tabTextActive]}>{label}</Text></Pressable>; }
function ModeButton({label,icon,active,onPress}:{label:string;icon:AppIconName;active:boolean;onPress:()=>void}) { return <Pressable onPress={onPress} style={[s.modeButton,active&&s.modeButtonActive]}><AppIcon name={icon} color={active?C.gold:C.muted} size={14}/><Text style={[s.modeText,active&&s.modeTextActive]}>{label}</Text></Pressable>; }
function ActionRow({onOpen,onSave,onTrack,onSchedule}:{onOpen:()=>void;onSave:()=>void;onTrack:()=>void;onSchedule:()=>void}) { return <View style={s.actions}><SmallAction label="View" onPress={onOpen}/><SmallAction label="Save" onPress={onSave}/><SmallAction label="Track" onPress={onTrack}/><SmallAction label="Schedule outing" onPress={onSchedule} featured/></View>; }
function SmallAction({label,onPress,featured=false}:{label:string;onPress:()=>void;featured?:boolean}) { return <Pressable onPress={onPress} style={[s.smallAction,featured&&s.smallActionFeatured]}><Text style={[s.smallActionText,featured&&s.smallActionTextFeatured]}>{label}</Text></Pressable>; }
function Badge({text}:{text:string}) { return <View style={s.badge}><Text style={s.badgeText}>{text}</Text></View>; }
function VerificationBadge({item}:{item:SavedOpportunity}) { return <Badge text={item.verification_status==='go_melanated_verified'?'✓ Go Melanated Verified':item.verification_status==='platform_sourced'?`${item.source_label} sourced`:'External source'}/>; }
function RelevanceBadge({value}:{value:OpportunityRelevance}) { if(!value)return null; return <View style={s.relevanceBadge}><Text style={s.relevanceText}>{labelize(value)}</Text></View>; }
function savedToOuting(item:SavedOpportunity) { return {title:displayText(item.title),summary:displayText(item.summary),startsAt:item.starts_at,endsAt:item.ends_at,venueName:displayText(item.venue_name),city:item.city,state:item.state,sourceUrl:item.source_url,organizer:displayText(item.organizer_name),ticketUrl:item.ticket_url}; }
function needsAttention(item:SavedOpportunity) { const now=Date.now(),horizon=now+14*86400000; const dates=[item.follow_up_at,item.application_deadline].filter(Boolean).map(v=>new Date(v as string).getTime()).filter(Number.isFinite); return dates.some(d=>d<=horizon); }
function attentionReason(item:SavedOpportunity) { const now=Date.now(); const follow=item.follow_up_at?new Date(item.follow_up_at).getTime():Infinity; const deadline=item.application_deadline?new Date(item.application_deadline).getTime():Infinity; if(follow<=deadline&&Number.isFinite(follow))return follow<now?'Follow-up is due':'Follow-up '+shortDate(item.follow_up_at!); if(Number.isFinite(deadline))return deadline<now?'Application deadline passed':'Application deadline '+shortDate(item.application_deadline!); return 'Needs review'; }
function suggestTags(p:OpportunityPreview) { const text=`${p.title} ${p.summary}`.toLowerCase(); const out=[p.city||'',labelize(p.opportunityType)]; if(text.includes('rnb')||text.includes('r&b'))out.push('RnB'); if(text.includes('night'))out.push('Nightlife'); if(text.includes('family'))out.push('Family-friendly'); if(text.includes('outdoor'))out.push('Outdoor'); return Array.from(new Set(out.filter(Boolean))).slice(0,5); }
function shortDate(v:string) { const d=new Date(v); return Number.isNaN(d.getTime())?'':d.toLocaleDateString('en-US',{month:'short',day:'numeric'}); }
function formatDate(v?:string|null) { if(!v)return''; const d=new Date(v); return Number.isNaN(d.getTime())?v:d.toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}); }
function labelize(v:string) { return v.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()); }
function displayText(v:string) { return v.replace(/&#x([0-9a-f]+);/gi,(_,hex)=>String.fromCodePoint(parseInt(hex,16))).replace(/&#(\d+);/g,(_,dec)=>String.fromCodePoint(parseInt(dec,10))).replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'"); }

const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:C.ink},content:{padding:18,paddingBottom:80},back:{color:C.gold,fontWeight:'900',marginBottom:14},hero:{borderRadius:22,borderWidth:1,borderColor:C.line,backgroundColor:C.panel,padding:18},heroIcon:{width:48,height:48,borderRadius:15,backgroundColor:'#E7A05C22',alignItems:'center',justifyContent:'center',marginBottom:13},eyebrow:{color:C.orange,fontSize:9,fontWeight:'900',letterSpacing:1.1},title:{color:C.cream,fontSize:30,fontWeight:'900',marginTop:3},subtitle:{color:C.muted,fontSize:11,lineHeight:17,marginTop:5},statusStrip:{flexDirection:'row',gap:8,marginTop:12},stat:{flex:1,borderWidth:1,borderColor:C.line,borderRadius:14,backgroundColor:C.panel,padding:11},statValue:{color:C.cream,fontSize:18,fontWeight:'900'},statLabel:{color:C.muted,fontSize:8,marginTop:2,fontWeight:'800'},tabs:{flexDirection:'row',gap:6,marginTop:10},tab:{flex:1,minHeight:42,borderRadius:12,borderWidth:1,borderColor:C.line,alignItems:'center',justifyContent:'center',backgroundColor:C.panel},tabActive:{borderColor:'#7B6326',backgroundColor:'#302B18'},tabText:{color:C.muted,fontSize:9,fontWeight:'900'},tabTextActive:{color:C.gold},sectionEyebrow:{color:C.gold,fontSize:8.5,fontWeight:'900',letterSpacing:1.1,marginTop:18},sectionTitle:{color:C.cream,fontSize:17,fontWeight:'900',marginTop:4,marginBottom:9},sourceList:{gap:8},sourceCard:{minHeight:66,borderRadius:15,borderWidth:1,borderColor:C.line,backgroundColor:C.panel,flexDirection:'row',alignItems:'center',gap:10,padding:12},sourceIcon:{width:36,height:36,borderRadius:11,backgroundColor:'#D7B45A18',alignItems:'center',justifyContent:'center'},flex:{flex:1,minWidth:0},rowTitle:{color:C.cream,fontSize:11,fontWeight:'900'},rowMeta:{color:C.muted,fontSize:8.5,lineHeight:13,marginTop:3},findText:{color:C.gold,fontSize:8.5,fontWeight:'900'},eventList:{gap:9,marginTop:10},card:{borderRadius:17,borderWidth:1,borderColor:C.line,backgroundColor:C.panel,padding:13},reviewCard:{borderRadius:18,borderWidth:1,borderColor:'#6B5726',backgroundColor:C.panel,padding:15,marginTop:12,overflow:'hidden'},previewImage:{width:'100%',height:190,borderRadius:12,marginBottom:12},savedImage:{width:'100%',height:140,borderRadius:11,marginBottom:10},reviewTitle:{color:C.cream,fontSize:20,fontWeight:'900',marginTop:9,lineHeight:25},eventDate:{color:C.gold,fontSize:11,fontWeight:'900',marginTop:10},eventLocation:{color:C.cream,fontSize:9.5,marginTop:3},organizer:{color:C.muted,fontSize:9.5,fontWeight:'800',marginTop:9},ticketLine:{color:C.gold,fontSize:9.5,fontWeight:'800',marginTop:8},cardTitle:{color:C.cream,fontSize:15,fontWeight:'900',marginTop:7},cardMeta:{color:C.gold,fontSize:9,lineHeight:14,marginTop:5},cardBody:{color:C.muted,fontSize:9.5,lineHeight:15,marginTop:7},openDetails:{color:C.gold,fontSize:8.5,fontWeight:'900',marginTop:9},badges:{flexDirection:'row',flexWrap:'wrap',gap:5},badge:{borderRadius:9,backgroundColor:'#283027',paddingHorizontal:7,paddingVertical:5},badgeText:{color:'#C8D1CB',fontSize:7.5,fontWeight:'900'},relevanceBadge:{borderRadius:9,backgroundColor:'#3B2D16',paddingHorizontal:7,paddingVertical:5},relevanceText:{color:'#E7C464',fontSize:7.5,fontWeight:'900'},tagBox:{marginTop:12,paddingTop:10,borderTopWidth:1,borderTopColor:C.line},tagBoxCompact:{paddingTop:8,marginTop:9},tagLabel:{color:C.gold,fontSize:8,fontWeight:'900',letterSpacing:.8,marginTop:12},tagRow:{flexDirection:'row',flexWrap:'wrap',gap:5,marginTop:7},tagChip:{borderRadius:10,backgroundColor:'#243128',paddingHorizontal:8,paddingVertical:5},tagChipActive:{backgroundColor:'#4A3B1A'},tagText:{color:C.cream,fontSize:8,fontWeight:'800'},tagInputRow:{flexDirection:'row',gap:6,marginTop:7},tagInput:{flex:1,minHeight:38,borderRadius:10,borderWidth:1,borderColor:C.line,backgroundColor:'#101711',color:C.cream,paddingHorizontal:10,fontSize:9},tagAdd:{minHeight:38,borderRadius:10,borderWidth:1,borderColor:'#6B5726',paddingHorizontal:10,alignItems:'center',justifyContent:'center'},tagAddText:{color:C.gold,fontSize:8.5,fontWeight:'900'},actionPanel:{marginTop:15,borderRadius:14,backgroundColor:'#101711',borderWidth:1,borderColor:'#5C4A22',padding:12},actionEyebrow:{color:C.orange,fontSize:8.5,fontWeight:'900',letterSpacing:.9},actionCopy:{color:C.muted,fontSize:9,lineHeight:14,marginTop:4},saveButton:{minHeight:46,borderRadius:11,backgroundColor:C.gold,alignItems:'center',justifyContent:'center',marginTop:10},saveButtonText:{color:C.ink,fontSize:10,fontWeight:'900'},actions:{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:10},smallAction:{minHeight:34,borderRadius:10,borderWidth:1,borderColor:C.line,paddingHorizontal:10,alignItems:'center',justifyContent:'center'},smallActionFeatured:{backgroundColor:C.gold,borderColor:C.gold},smallActionText:{color:C.cream,fontSize:8.5,fontWeight:'900'},smallActionTextFeatured:{color:C.ink},importCard:{borderRadius:18,borderWidth:1,borderColor:'#5C4A22',backgroundColor:'#171912',padding:14,marginTop:16},modeRow:{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:10,marginBottom:12},modeButton:{minHeight:36,borderRadius:10,flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:9,borderWidth:1,borderColor:C.line},modeButtonActive:{borderColor:'#7B6326',backgroundColor:'#302B18'},modeText:{color:C.muted,fontSize:8.5,fontWeight:'900'},modeTextActive:{color:C.cream},input:{minHeight:50,borderRadius:12,borderWidth:1,borderColor:'#47534B',backgroundColor:'#101711',color:C.cream,paddingHorizontal:12,fontSize:11},primary:{minHeight:46,borderRadius:12,backgroundColor:C.gold,alignItems:'center',justifyContent:'center',marginTop:9},disabled:{opacity:.42},primaryText:{color:C.ink,fontSize:10,fontWeight:'900'},placeholderText:{color:C.muted,fontSize:9,lineHeight:14,marginTop:8},message:{marginTop:10,borderRadius:10,borderWidth:1,padding:10},messageError:{borderColor:'#743E38',backgroundColor:'#2A1514'},messageSuccess:{borderColor:'#315C3A',backgroundColor:'#102318'},error:{color:C.danger,fontSize:9,lineHeight:14},notice:{color:C.green,fontSize:9,lineHeight:14,fontWeight:'800'},empty:{color:C.muted,fontSize:10,lineHeight:16,padding:18,textAlign:'center'},stage:{borderRadius:16,borderWidth:1,borderColor:C.line,backgroundColor:'#101711',padding:10,marginTop:9},stageHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:3,paddingBottom:4},stageTitle:{color:C.gold,fontSize:10,fontWeight:'900'},stageCount:{color:C.muted,fontSize:9,fontWeight:'900'},attention:{marginTop:12,borderWidth:1,borderColor:'#6B5726',borderRadius:16,padding:12,backgroundColor:'#171912'},attentionRow:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:9,borderTopWidth:1,borderTopColor:C.line}
});
