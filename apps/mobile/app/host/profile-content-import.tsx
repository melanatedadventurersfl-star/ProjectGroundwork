import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, SafeAreaView, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { getHostOrganization, type HostOrganization } from '../../src/hosting/hostProfiles';
import {
  applyHostContentImport,
  discardHostContentImport,
  faqTemplateCsv,
  markContentDuplicates,
  policyTemplateCsv,
  previewHostContentImport,
  type HostContentImportMode,
  type HostContentImportResult,
  type HostContentImportTarget,
  type HostContentMergeMode,
  type ImportedFAQ,
  type ImportedPolicy,
} from '../../src/hosting/hostProfileContentImport';

const C = { bg:'#0A0F0C', panel:'#131B16', raised:'#19231C', line:'#2D3A32', cream:'#FFF8E8', muted:'#95A29A', gold:'#D7B45A', green:'#7CCB92', red:'#E8A09A' };
const FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
  'text/html',
  'image/jpeg',
  'image/png',
  'image/webp',
];

type ReviewItem = (ImportedFAQ | ImportedPolicy) & { duplicate?: boolean };

export default function HostProfileContentImportScreen() {
  const params = useLocalSearchParams<{ organizationId?: string; target?: string }>();
  const organizationId = String(params.organizationId ?? '');
  const target: HostContentImportTarget = params.target === 'policies' ? 'policies' : 'faq';
  const noun = target === 'faq' ? 'FAQ' : 'policy';
  const plural = target === 'faq' ? 'FAQs' : 'policies';

  const [org,setOrg] = useState<HostOrganization|null>(null);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [mode,setMode] = useState<HostContentImportMode>('files');
  const [files,setFiles] = useState<DocumentPicker.DocumentPickerAsset[]>([]);
  const [sourceUrl,setSourceUrl] = useState('');
  const [sourceText,setSourceText] = useState('');
  const [result,setResult] = useState<HostContentImportResult|null>(null);
  const [reviewItems,setReviewItems] = useState<ReviewItem[]>([]);
  const [selectedIds,setSelectedIds] = useState<string[]>([]);
  const [mergeMode,setMergeMode] = useState<HostContentMergeMode>('merge');

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!organizationId) { setError('Host profile is missing.'); setLoading(false); return; }
      try {
        const next = await getHostOrganization(organizationId);
        if (active) setOrg(next);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Unable to load this host profile.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  },[organizationId]);

  const selectedItems = useMemo(() => reviewItems.filter((item) => selectedIds.includes(item.id)),[reviewItems,selectedIds]);
  const hasEventScope = result?.scope === 'event' || result?.scope === 'mixed';
  const hardEventBlock = result?.scope === 'event';

  async function chooseFiles() {
    const picked = await DocumentPicker.getDocumentAsync({ multiple:true, copyToCacheDirectory:true, type:FILE_TYPES });
    if (!picked.canceled) {
      setFiles(picked.assets.slice(0,8));
      setResult(null);
      setReviewItems([]);
      setSelectedIds([]);
    }
  }

  async function analyze() {
    if (!organizationId || !org) return;
    setBusy(true);
    setError('');
    try {
      const next = await previewHostContentImport({
        organizationId,
        target,
        mode,
        files:mode === 'files' ? files.map((file) => ({ uri:file.uri, name:file.name, mimeType:file.mimeType, size:file.size })) : undefined,
        sourceUrl:mode === 'website' ? sourceUrl : undefined,
        sourceText:mode === 'pasted_text' ? sourceText : undefined,
      });
      const existing = target === 'faq' ? org.faq : org.policies;
      const marked = markContentDuplicates(target,next.items,existing) as ReviewItem[];
      setResult(next);
      setReviewItems(marked);
      setSelectedIds(marked.filter((item) => {
        if (next.scope === 'event') return false;
        if (item.publish === false) return false;
        if (target === 'policies' && (item as ImportedPolicy).appliesTo === 'event') return false;
        if (next.scope === 'mixed' && target === 'faq') return false;
        return true;
      }).map((item) => item.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Unable to import ${plural}.`);
    } finally {
      setBusy(false);
    }
  }

  function toggleItem(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current,id]);
  }

  function updateFaq(id:string, patch:Partial<ImportedFAQ>) {
    setReviewItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function updatePolicy(id:string, patch:Partial<ImportedPolicy>) {
    setReviewItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  async function apply() {
    if (!result || !organizationId || hardEventBlock || !selectedItems.length) return;
    setBusy(true);
    setError('');
    try {
      await applyHostContentImport({ organizationId, importId:result.importId, target, items:selectedItems, mergeMode });
      router.back();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Unable to apply ${plural}.`);
    } finally {
      setBusy(false);
    }
  }

  async function discard() {
    if (result) await discardHostContentImport(result.importId,organizationId).catch(() => undefined);
    setResult(null);
    setReviewItems([]);
    setSelectedIds([]);
  }

  async function exportTemplate() {
    const csv = target === 'faq' ? faqTemplateCsv() : policyTemplateCsv();
    const filename = target === 'faq' ? 'host-faq-template.csv' : 'host-policy-template.csv';
    if (Platform.OS === 'web') {
      const doc = (globalThis as any).document;
      const URLApi = (globalThis as any).URL;
      const BlobApi = (globalThis as any).Blob;
      if (doc && URLApi && BlobApi) {
        const blob = new BlobApi([csv],{type:'text/csv;charset=utf-8'});
        const url = URLApi.createObjectURL(blob);
        const anchor = doc.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        URLApi.revokeObjectURL(url);
        return;
      }
    }
    await Share.share({ title:filename, message:csv });
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color={C.gold} size="large"/><Text style={styles.muted}>Loading importer…</Text></SafeAreaView>;
  if (!org) return <SafeAreaView style={styles.center}><Text style={styles.error}>{error || 'Host profile not found.'}</Text></SafeAreaView>;

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <View style={styles.top}><Pressable onPress={()=>router.back()}><Text style={styles.back}>‹ Host Profile</Text></Pressable><Text style={styles.hostName}>{org.name}</Text></View>
    <Text style={styles.eyebrow}>HOST PROFILE CONTENT</Text>
    <Text style={styles.title}>Import {plural}</Text>
    <Text style={styles.subtitle}>Bring in existing material, review every item, then decide how it should join the host profile.</Text>

    {error?<View style={styles.errorCard}><Text style={styles.error}>{error}</Text></View>:null}

    <View style={styles.templateCard}>
      <View style={styles.flex}><Text style={styles.cardTitle}>Start from our template</Text><Text style={styles.muted}>{target==='faq'?'Category, question, answer, display order, publish':'Policy type, title, policy text, applies to, effective date, publish'}</Text></View>
      <Pressable style={styles.smallButton} onPress={()=>void exportTemplate()}><Text style={styles.smallButtonText}>{Platform.OS==='web'?'Download template':'Share template'}</Text></Pressable>
    </View>

    <Text style={styles.label}>Source</Text>
    <View style={styles.tabs}>{(['files','website','pasted_text'] as HostContentImportMode[]).map((item)=><Pressable key={item} style={[styles.tab,mode===item&&styles.tabActive]} onPress={()=>{setMode(item);setResult(null);setReviewItems([]);setSelectedIds([])}}><Text style={[styles.tabText,mode===item&&styles.tabTextActive]}>{item==='files'?'Upload':item==='website'?'Website':'Paste text'}</Text></Pressable>)}</View>

    <View style={styles.card}>
      {mode==='files'?<><Pressable style={styles.upload} onPress={()=>void chooseFiles()}><Text style={styles.uploadTitle}>Choose files</Text><Text style={styles.muted}>PDF, Word, Excel, CSV, text, HTML, JPG, PNG, WebP</Text></Pressable>{files.map((file)=><Text key={`${file.name}-${file.size}`} style={styles.file}>• {file.name}</Text>)}</>:null}
      {mode==='website'?<Field label="Public webpage" value={sourceUrl} onChangeText={setSourceUrl} placeholder="https://example.com/faq" autoCapitalize="none"/>:null}
      {mode==='pasted_text'?<Field label={`Paste ${noun} content`} value={sourceText} onChangeText={setSourceText} multiline placeholder={target==='faq'?'Question: ...\nAnswer: ...':'Refund policy:\nPaste the exact policy wording here.'}/>:null}
      <Pressable disabled={busy || (mode==='files'?!files.length:mode==='website'?!sourceUrl.trim():!sourceText.trim())} style={[styles.primary,busy&&styles.disabled]} onPress={()=>void analyze()}>{busy?<ActivityIndicator color="#142017"/>:<Text style={styles.primaryText}>Analyze {plural}</Text>}</Pressable>
    </View>

    {result?<>
      <View style={[styles.scopeCard,hasEventScope&&styles.scopeWarn]}>
        <Text style={styles.scopeTitle}>{scopeLabel(result.scope)}</Text>
        <Text style={styles.muted}>{Math.round(result.scopeConfidence*100)}% scope confidence</Text>
        {result.scopeReasons.map((reason)=><Text key={reason} style={styles.note}>• {reason}</Text>)}
        {result.extractionMessage?<Text style={styles.note}>{result.extractionMessage}</Text>:null}
        {hasEventScope?<><Text style={styles.warning}>Event-specific content was detected. It will not be selected for the reusable host profile automatically.</Text><Pressable style={styles.secondary} onPress={()=>router.push('/host/import-event?mode=files' as never)}><Text style={styles.secondaryText}>Open Event Builder</Text></Pressable></>:null}
      </View>

      <View style={styles.reviewTop}><View style={styles.flex}><Text style={styles.sectionTitle}>Review {plural}</Text><Text style={styles.muted}>{selectedIds.length} of {reviewItems.length} selected</Text></View><Pressable onPress={()=>setSelectedIds(reviewItems.filter((item)=>target!=='policies'||(item as ImportedPolicy).appliesTo!=='event').map((item)=>item.id))}><Text style={styles.link}>Select eligible</Text></Pressable></View>

      {reviewItems.length?reviewItems.map((item,index)=>{
        const selected=selectedIds.includes(item.id);
        const eventItem=target==='policies'&&(item as ImportedPolicy).appliesTo==='event';
        return <View key={item.id} style={[styles.itemCard,selected&&styles.itemSelected,eventItem&&styles.itemEvent]}>
          <Pressable disabled={eventItem||hardEventBlock} style={styles.selectRow} onPress={()=>toggleItem(item.id)}><View style={[styles.checkbox,selected&&styles.checkboxOn]}><Text style={styles.check}>{selected?'✓':''}</Text></View><Text style={styles.itemIndex}>{target==='faq'?'FAQ':'Policy'} {index+1}</Text>{item.duplicate?<Text style={styles.duplicate}>POSSIBLE DUPLICATE</Text>:null}{eventItem?<Text style={styles.eventBadge}>EVENT</Text>:null}</Pressable>
          {target==='faq'?<><Field label="Question" value={(item as ImportedFAQ).question} onChangeText={(value:string)=>updateFaq(item.id,{question:value})}/><Field label="Answer" value={(item as ImportedFAQ).answer} onChangeText={(value:string)=>updateFaq(item.id,{answer:value})} multiline/>{(item as ImportedFAQ).category?<Text style={styles.meta}>Category: {(item as ImportedFAQ).category}</Text>:null}</>:<><Field label="Policy title" value={(item as ImportedPolicy).title} onChangeText={(value:string)=>updatePolicy(item.id,{title:value})}/><Field label="Policy wording" value={(item as ImportedPolicy).body} onChangeText={(value:string)=>updatePolicy(item.id,{body:value})} multiline/><Text style={styles.meta}>Type: {(item as ImportedPolicy).policyType||'Other'} · Applies to: {(item as ImportedPolicy).appliesTo}</Text>{(item as ImportedPolicy).effectiveDate?<Text style={styles.meta}>Effective: {(item as ImportedPolicy).effectiveDate}</Text>:null}</>}
          <Text style={styles.source}>Source: {item.sourceLabel}</Text>
        </View>
      }):<View style={styles.empty}><Text style={styles.muted}>No structured {plural} were identified. Try the template, a clearer source, or pasted text.</Text></View>}

      <Text style={styles.label}>When existing {plural} are present</Text>
      <View style={styles.mergeRow}>{(['merge','append','replace'] as HostContentMergeMode[]).map((item)=><Pressable key={item} style={[styles.merge,mergeMode===item&&styles.mergeActive]} onPress={()=>setMergeMode(item)}><Text style={[styles.mergeTitle,mergeMode===item&&styles.mergeTitleActive]}>{item==='merge'?'Merge':item==='append'?'Append new':'Replace all'}</Text><Text style={styles.mergeCopy}>{item==='merge'?'Update matches and keep the rest.':item==='append'?'Skip matching questions or titles.':'Use only the selected imported items.'}</Text></Pressable>)}</View>

      {result.confidenceNotes.map((note)=><Text key={note} style={styles.note}>• {note}</Text>)}
      <View style={styles.actions}><Pressable disabled={busy} style={styles.secondary} onPress={()=>void discard()}><Text style={styles.secondaryText}>Discard import</Text></Pressable><Pressable disabled={busy||hardEventBlock||!selectedItems.length} style={[styles.primary,styles.flex,(hardEventBlock||!selectedItems.length)&&styles.disabled]} onPress={()=>void apply()}>{busy?<ActivityIndicator color="#142017"/>:<Text style={styles.primaryText}>Apply {selectedItems.length} selected</Text>}</Pressable></View>
    </>:null}
  </ScrollView></SafeAreaView>;
}

function scopeLabel(scope:string){if(scope==='host')return 'Reusable host content';if(scope==='event')return 'Event-specific content';if(scope==='mixed')return 'Mixed host and event content';return 'Scope needs review'}
function Field({label,multiline=false,...props}:any){return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} multiline={multiline} textAlignVertical={multiline?'top':'center'} placeholderTextColor="#657269" style={[styles.input,multiline&&styles.multiline]}/></View>}

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:C.bg},center:{flex:1,backgroundColor:C.bg,alignItems:'center',justifyContent:'center',gap:12,padding:24},content:{padding:20,paddingBottom:80,gap:16},top:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},back:{color:C.gold,fontWeight:'800',fontSize:16},hostName:{color:C.muted,fontSize:13,maxWidth:'55%'},eyebrow:{color:C.gold,fontSize:12,fontWeight:'900',letterSpacing:1.4},title:{color:C.cream,fontSize:30,fontWeight:'900'},subtitle:{color:C.muted,fontSize:15,lineHeight:22,maxWidth:700},card:{backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:18,padding:16,gap:12},templateCard:{backgroundColor:C.raised,borderWidth:1,borderColor:C.line,borderRadius:18,padding:16,flexDirection:'row',alignItems:'center',gap:12},cardTitle:{color:C.cream,fontSize:16,fontWeight:'900'},flex:{flex:1},muted:{color:C.muted,lineHeight:20},label:{color:C.cream,fontSize:13,fontWeight:'800'},tabs:{flexDirection:'row',gap:8,flexWrap:'wrap'},tab:{borderWidth:1,borderColor:C.line,borderRadius:999,paddingHorizontal:14,paddingVertical:9},tabActive:{backgroundColor:C.gold,borderColor:C.gold},tabText:{color:C.muted,fontWeight:'800'},tabTextActive:{color:'#142017'},field:{gap:7},input:{borderWidth:1,borderColor:C.line,backgroundColor:C.bg,borderRadius:12,paddingHorizontal:12,paddingVertical:11,color:C.cream,fontSize:15},multiline:{minHeight:110},upload:{borderWidth:1,borderStyle:'dashed',borderColor:C.gold,borderRadius:14,padding:18,gap:5},uploadTitle:{color:C.gold,fontWeight:'900',fontSize:16},file:{color:C.cream,fontSize:13},primary:{backgroundColor:C.gold,borderRadius:13,paddingHorizontal:16,paddingVertical:13,alignItems:'center',justifyContent:'center'},primaryText:{color:'#142017',fontWeight:'900'},secondary:{borderWidth:1,borderColor:C.line,borderRadius:13,paddingHorizontal:14,paddingVertical:11,alignItems:'center'},secondaryText:{color:C.cream,fontWeight:'800'},smallButton:{borderWidth:1,borderColor:C.gold,borderRadius:12,paddingHorizontal:12,paddingVertical:10},smallButtonText:{color:C.gold,fontWeight:'900',fontSize:12},disabled:{opacity:.42},errorCard:{backgroundColor:'#2A1716',borderColor:'#643531',borderWidth:1,borderRadius:14,padding:13},error:{color:C.red,lineHeight:20},scopeCard:{backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:18,padding:16,gap:8},scopeWarn:{borderColor:'#8A6A28'},scopeTitle:{color:C.cream,fontWeight:'900',fontSize:18},warning:{color:'#E7C878',lineHeight:20,fontWeight:'700'},note:{color:C.muted,lineHeight:20},reviewTop:{flexDirection:'row',alignItems:'center',gap:12},sectionTitle:{color:C.cream,fontSize:22,fontWeight:'900'},link:{color:C.gold,fontWeight:'900'},itemCard:{backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:18,padding:16,gap:12},itemSelected:{borderColor:C.green},itemEvent:{opacity:.76},selectRow:{flexDirection:'row',alignItems:'center',gap:9},checkbox:{width:24,height:24,borderWidth:1,borderColor:C.line,borderRadius:7,alignItems:'center',justifyContent:'center'},checkboxOn:{backgroundColor:C.green,borderColor:C.green},check:{color:'#102016',fontWeight:'900'},itemIndex:{color:C.cream,fontWeight:'900'},duplicate:{color:'#E7C878',fontSize:10,fontWeight:'900',marginLeft:'auto'},eventBadge:{color:C.red,fontSize:10,fontWeight:'900',marginLeft:'auto'},meta:{color:C.muted,fontSize:12},source:{color:C.gold,fontSize:11},empty:{backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:16,padding:18},mergeRow:{gap:9},merge:{backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:14,padding:13,gap:3},mergeActive:{borderColor:C.gold},mergeTitle:{color:C.cream,fontWeight:'900'},mergeTitleActive:{color:C.gold},mergeCopy:{color:C.muted,fontSize:12},actions:{flexDirection:'row',gap:10,alignItems:'center'},
});
