import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { archiveOpportunity, getHostOpportunity, updateOpportunityTags, updateOpportunityWorkspace, type OpportunityStage, type SavedOpportunity } from '../../../src/hosting/opportunities';

const C = { ink:'#0A0F0C', panel:'#141D17', line:'#2E3A33', cream:'#FFF8E8', muted:'#9AA69E', dim:'#76827A', gold:'#D7B45A', orange:'#E7A05C', green:'#84C992', danger:'#EA806E' };
const STAGES: OpportunityStage[] = ['saved','reviewing','applied','approved','scheduled'];

export default function OpportunityDetailScreen() {
  const { id } = useLocalSearchParams<{ id:string }>();
  const [item,setItem] = useState<SavedOpportunity | null>(null);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [notice,setNotice] = useState('');
  const [error,setError] = useState('');
  const [notes,setNotes] = useState('');
  const [followUp,setFollowUp] = useState('');
  const [tagInput,setTagInput] = useState('');

  useEffect(() => { void load(); }, [id]);
  async function load() {
    if (!id) return;
    setLoading(true); setError('');
    try { const row = await getHostOpportunity(id); setItem(row); setNotes(row.notes || ''); setFollowUp(toDateInput(row.follow_up_at)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load opportunity.'); }
    finally { setLoading(false); }
  }

  const metadata = (item?.metadata || {}) as Record<string, unknown>;
  const ticketDetails = Array.isArray(metadata.ticketDetails) ? metadata.ticketDetails.filter((v):v is string => typeof v === 'string') : [];
  const contact = [metadata.contactName,metadata.contactEmail,metadata.contactPhone].filter((v) => typeof v === 'string' && v).join(' · ');
  const verification = item?.verification_status === 'go_melanated_verified' ? '✓ Go Melanated Verified' : item?.verification_status === 'platform_sourced' ? `${item.source_label} sourced` : 'External source';
  const relevance = item?.relevance_label ? labelize(item.relevance_label) : 'No cultural relevance label';
  const due = useMemo(() => item?.follow_up_at ? new Date(item.follow_up_at) : null,[item?.follow_up_at]);

  async function saveWorkspace() {
    if (!item) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const followUpAt = parseDateInput(followUp);
      const row = await updateOpportunityWorkspace(item.id,{ notes, followUpAt });
      setItem(row); setNotice('Notes and follow-up saved.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to save changes.'); }
    finally { setSaving(false); }
  }

  async function move(stage: OpportunityStage) {
    if (!item) return;
    try { const row = await updateOpportunityWorkspace(item.id,{ stage }); setItem(row); setNotice(`Moved to ${labelize(stage)}.`); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to update status.'); }
  }

  async function addTag() {
    if (!item) return;
    const tag = tagInput.trim(); if (!tag) return;
    try { const row = await updateOpportunityTags(item.id,[...(item.tags || []),tag]); setItem(row); setTagInput(''); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to add tag.'); }
  }
  async function removeTag(tag:string) { if (!item) return; try { setItem(await updateOpportunityTags(item.id,(item.tags || []).filter((x) => x !== tag))); } catch {} }

  function schedule() {
    if (!item) return;
    const p = new URLSearchParams();
    p.set('fromOpportunity','1'); p.set('title',item.title); p.set('summary',item.summary || ''); p.set('startsAt',item.starts_at || ''); p.set('endsAt',item.ends_at || '');
    p.set('venueName',item.venue_name || ''); p.set('city',item.city || ''); p.set('state',item.state || 'FL'); p.set('sourceUrl',item.source_url); p.set('organizer',item.organizer_name || ''); p.set('ticketUrl',item.ticket_url || '');
    router.push(`/host/create-from-opportunity?${p.toString()}` as never);
  }

  async function archive() { if (!item) return; await archiveOpportunity(item.id); router.replace('/host/opportunities' as never); }

  if (loading) return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator color={C.gold}/></View></SafeAreaView>;
  if (!item) return <SafeAreaView style={s.safe}><View style={s.content}><Pressable onPress={() => router.back()}><Text style={s.back}>‹ Opportunities</Text></Pressable><Text style={s.error}>{error || 'Opportunity not found.'}</Text></View></SafeAreaView>;

  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => router.back()}><Text style={s.back}>‹ Opportunities</Text></Pressable>
    {item.image_url ? <Image source={{uri:item.image_url}} style={s.heroImage} resizeMode="cover" /> : null}
    <View style={s.badges}><Badge text={verification}/><Badge text={relevance}/><Badge text={labelize(item.stage)}/></View>
    <Text style={s.title}>{item.title}</Text>
    {item.starts_at ? <Text style={s.date}>{formatDate(item.starts_at)}</Text> : null}
    {[item.venue_name,item.address,[item.city,item.state].filter(Boolean).join(', ')].filter(Boolean).map((v,i)=><Text key={i} style={s.location}>{v}</Text>)}
    {item.organizer_name ? <Text style={s.organizer}>Hosted by {item.organizer_name}</Text> : null}
    {item.summary ? <Text style={s.summary}>{item.summary}</Text> : null}

    <View style={s.actionCard}><Text style={s.eyebrow}>NEXT ACTION</Text><Pressable style={s.primary} onPress={schedule}><Text style={s.primaryText}>Schedule outing</Text></Pressable><View style={s.row}><Action label="View source" onPress={() => void Linking.openURL(item.source_url)}/>{item.ticket_url ? <Action label="Tickets" onPress={() => void Linking.openURL(item.ticket_url)}/> : null}</View></View>

    <Section title="Source and trust"><Fact label="Source" value={item.source_label}/><Fact label="Verification" value={verification}/><Fact label="Community relevance" value={relevance}/>{item.relevance_basis ? <Fact label="Why marked" value={item.relevance_basis}/> : null}</Section>
    {ticketDetails.length || item.vendor_fee_text ? <Section title="Tickets and cost">{item.vendor_fee_text ? <Fact label="Vendor fee" value={item.vendor_fee_text}/> : null}{ticketDetails.map((x,i)=><Text key={i} style={s.list}>• {x}</Text>)}</Section> : null}
    {contact ? <Section title="Contact"><Text style={s.body}>{contact}</Text></Section> : null}

    <Section title="Tags"><View style={s.tags}>{(item.tags || []).map(tag=><Pressable key={tag} style={s.tag} onPress={() => void removeTag(tag)}><Text style={s.tagText}>{tag} ×</Text></Pressable>)}</View><View style={s.row}><TextInput value={tagInput} onChangeText={setTagInput} placeholder="Add tag" placeholderTextColor={C.dim} style={s.input}/><Pressable style={s.outline} onPress={() => void addTag()}><Text style={s.outlineText}>Add</Text></Pressable></View></Section>

    <Section title="Host notes"><TextInput value={notes} onChangeText={setNotes} multiline placeholder="Add a note, contact plan, idea, or context..." placeholderTextColor={C.dim} style={[s.input,s.notes]}/><Text style={s.help}>Private to the host workspace.</Text></Section>
    <Section title="Follow-up"><TextInput value={followUp} onChangeText={setFollowUp} placeholder="YYYY-MM-DD" placeholderTextColor={C.dim} style={s.input}/>{due ? <Text style={s.help}>Current follow-up: {due.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</Text> : null}<Pressable style={s.primary} onPress={() => void saveWorkspace()}>{saving ? <ActivityIndicator color={C.ink}/> : <Text style={s.primaryText}>Save notes and follow-up</Text>}</Pressable></Section>

    <Section title="Pipeline status"><View style={s.stageWrap}>{STAGES.map(stage=><Pressable key={stage} onPress={() => void move(stage)} style={[s.stage,item.stage === stage && s.stageActive]}><Text style={[s.stageText,item.stage === stage && s.stageTextActive]}>{labelize(stage)}</Text></Pressable>)}</View></Section>
    {notice ? <Text style={s.notice}>{notice}</Text> : null}{error ? <Text style={s.error}>{error}</Text> : null}
    <Pressable onPress={() => void archive()} style={s.archive}><Text style={s.archiveText}>Archive opportunity</Text></Pressable>
  </ScrollView></SafeAreaView>;
}

function Section({title,children}:{title:string;children:ReactNode}) { return <View style={s.section}><Text style={s.eyebrow}>{title.toUpperCase()}</Text>{children}</View>; }
function Fact({label,value}:{label:string;value:string}) { return <View style={s.fact}><Text style={s.factLabel}>{label}</Text><Text style={s.factValue}>{value}</Text></View>; }
function Badge({text}:{text:string}) { return <View style={s.badge}><Text style={s.badgeText}>{text}</Text></View>; }
function Action({label,onPress}:{label:string;onPress:()=>void}) { return <Pressable style={s.outline} onPress={onPress}><Text style={s.outlineText}>{label}</Text></Pressable>; }
function labelize(v:string) { return v.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()); }
function formatDate(v:string) { const d=new Date(v); return Number.isNaN(d.getTime()) ? v : d.toLocaleString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}); }
function toDateInput(v:string|null) { if (!v) return ''; const d=new Date(v); return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0,10); }
function parseDateInput(v:string) { if (!v.trim()) return null; if (!/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) throw new Error('Use YYYY-MM-DD for the follow-up date.'); const d=new Date(`${v.trim()}T12:00:00`); if (Number.isNaN(d.getTime())) throw new Error('Enter a valid follow-up date.'); return d.toISOString(); }

const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:C.ink},content:{padding:18,paddingBottom:80},center:{flex:1,alignItems:'center',justifyContent:'center'},back:{color:C.gold,fontWeight:'900',marginBottom:14},heroImage:{width:'100%',height:210,borderRadius:22,backgroundColor:C.panel,marginBottom:14},badges:{flexDirection:'row',flexWrap:'wrap',gap:6},badge:{backgroundColor:'#283027',paddingHorizontal:9,paddingVertical:6,borderRadius:10},badgeText:{color:'#D5DDD7',fontSize:8,fontWeight:'900'},title:{color:C.cream,fontSize:28,fontWeight:'900',lineHeight:33,marginTop:12},date:{color:C.gold,fontSize:13,fontWeight:'900',marginTop:12},location:{color:C.cream,fontSize:11,lineHeight:17,marginTop:2},organizer:{color:C.muted,fontSize:10,marginTop:10,fontWeight:'800'},summary:{color:C.muted,fontSize:11,lineHeight:18,marginTop:14},actionCard:{marginTop:18,borderWidth:1,borderColor:'#5C4A22',borderRadius:17,padding:14,backgroundColor:'#101711'},eyebrow:{color:C.orange,fontSize:9,fontWeight:'900',letterSpacing:.9,marginBottom:9},primary:{minHeight:46,borderRadius:12,backgroundColor:C.gold,alignItems:'center',justifyContent:'center',paddingHorizontal:14,marginTop:7},primaryText:{color:C.ink,fontWeight:'900',fontSize:10},row:{flexDirection:'row',gap:8,marginTop:9,alignItems:'center'},outline:{minHeight:40,borderRadius:11,borderWidth:1,borderColor:C.line,paddingHorizontal:14,alignItems:'center',justifyContent:'center'},outlineText:{color:C.cream,fontSize:9,fontWeight:'900'},section:{marginTop:16,borderRadius:17,borderWidth:1,borderColor:C.line,backgroundColor:C.panel,padding:14},fact:{paddingVertical:8,borderTopWidth:1,borderTopColor:C.line},factLabel:{color:C.dim,fontSize:8,fontWeight:'900',textTransform:'uppercase'},factValue:{color:C.cream,fontSize:10,fontWeight:'800',marginTop:3},body:{color:C.cream,fontSize:10,lineHeight:16},list:{color:C.muted,fontSize:9.5,lineHeight:15,marginTop:4},tags:{flexDirection:'row',flexWrap:'wrap',gap:6},tag:{borderRadius:10,backgroundColor:'#26342B',paddingHorizontal:9,paddingVertical:6},tagText:{color:C.cream,fontSize:8.5,fontWeight:'800'},input:{flex:1,minHeight:44,borderRadius:11,borderWidth:1,borderColor:C.line,backgroundColor:'#101711',color:C.cream,paddingHorizontal:11,fontSize:10},notes:{minHeight:110,paddingTop:11,textAlignVertical:'top'},help:{color:C.dim,fontSize:8.5,lineHeight:13,marginTop:7},stageWrap:{flexDirection:'row',flexWrap:'wrap',gap:7},stage:{borderWidth:1,borderColor:C.line,borderRadius:10,paddingHorizontal:10,paddingVertical:8},stageActive:{backgroundColor:'#302B18',borderColor:'#7B6326'},stageText:{color:C.muted,fontSize:8.5,fontWeight:'900'},stageTextActive:{color:C.gold},notice:{color:C.green,fontSize:9,marginTop:12},error:{color:C.danger,fontSize:9,marginTop:12},archive:{marginTop:20,minHeight:42,alignItems:'center',justifyContent:'center'},archiveText:{color:C.danger,fontWeight:'900',fontSize:9}
});
