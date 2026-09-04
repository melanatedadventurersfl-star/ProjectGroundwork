import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getHostOrganization, type HostOrganization } from '../../src/hosting/hostProfiles';
import {
  deleteOrganizationSocialProfile,
  listOrganizationSocialProfiles,
  saveOrganizationSocialProfile,
  setOrganizationSocialProfileVisibility,
  setPrimaryOrganizationSocialProfile,
  socialKindLabel,
  type HostSocialKind,
  type HostSocialProfile,
} from '../../src/hosting/hostSocialProfiles';
import { AppIcon } from '../../src/ui/AppIcon';

const C = { bg:'#0A0F0C', panel:'#131B16', raised:'#19231C', line:'#2D3A32', cream:'#FFF8E8', muted:'#95A29A', dim:'#6F7D75', gold:'#D7B45A' };
const KINDS: HostSocialKind[] = ['facebook_group','facebook_page','instagram','custom'];

export default function SocialProfilesScreen() {
  const { organizationId } = useLocalSearchParams<{ organizationId: string }>();
  const [org, setOrg] = useState<HostOrganization | null>(null);
  const [items, setItems] = useState<HostSocialProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [kind, setKind] = useState<HostSocialKind>('facebook_group');
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [audienceCount, setAudienceCount] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isPrimary, setIsPrimary] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true); setError('');
    try {
      const [organization, profiles] = await Promise.all([
        getHostOrganization(organizationId),
        listOrganizationSocialProfiles(organizationId),
      ]);
      setOrg(organization); setItems(profiles);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load social profiles.');
    } finally { setLoading(false); }
  }, [organizationId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const primary = useMemo(() => items.find(item => item.is_primary) ?? null, [items]);

  function resetForm() {
    setEditingId(null); setKind('facebook_group'); setDisplayName(''); setHandle(''); setUrl('');
    setDescription(''); setImageUrl(''); setAudienceCount(''); setIsPublic(true); setIsPrimary(false);
  }

  function edit(item: HostSocialProfile) {
    setEditingId(item.id); setKind(item.kind); setDisplayName(item.display_name); setHandle(item.handle || '');
    setUrl(item.url); setDescription(item.description || ''); setImageUrl(item.image_url || '');
    setAudienceCount(item.audience_count == null ? '' : String(item.audience_count)); setIsPublic(item.is_public); setIsPrimary(item.is_primary);
  }

  async function save() {
    if (!organizationId) return;
    setSaving(true); setError('');
    try {
      await saveOrganizationSocialProfile({
        id: editingId || undefined,
        organizationId,
        kind,
        displayName,
        handle,
        url,
        description,
        imageUrl,
        audienceCount: audienceCount.trim() ? Number(audienceCount.replace(/,/g, '')) : null,
        audienceLabel: kind === 'facebook_group' ? 'members' : 'followers',
        isPublic,
        isPrimary,
      });
      resetForm(); await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save social profile.');
    } finally { setSaving(false); }
  }

  async function makePrimary(item: HostSocialProfile) {
    setSaving(true);
    try { await setPrimaryOrganizationSocialProfile(item.id); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to set primary social profile.'); }
    finally { setSaving(false); }
  }

  async function togglePublic(item: HostSocialProfile) {
    setSaving(true);
    try { await setOrganizationSocialProfileVisibility(item.id, !item.is_public); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to update visibility.'); }
    finally { setSaving(false); }
  }

  function remove(item: HostSocialProfile) {
    Alert.alert('Remove social profile?', `${item.display_name} will no longer appear on this host profile.`, [
      { text:'Cancel', style:'cancel' },
      { text:'Remove', style:'destructive', onPress:() => void (async()=>{
        setSaving(true);
        try { await deleteOrganizationSocialProfile(item.id); if (editingId === item.id) resetForm(); await load(); }
        catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to remove social profile.'); }
        finally { setSaving(false); }
      })() },
    ]);
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color={C.gold}/><Text style={styles.muted}>Loading social profiles…</Text></SafeAreaView>;

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Host profile</Text></Pressable>
    <Text style={styles.eyebrow}>SOCIAL PROFILE DATA</Text>
    <Text style={styles.title}>{org?.name || 'Host profile'}</Text>
    <Text style={styles.copy}>Add the social places that represent this organization. Manual entry always stays available. Imported data should be reviewed before it replaces any Go Melanated profile field.</Text>

    {error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text></View> : null}

    <View style={styles.infoCard}>
      <Text style={styles.infoTitle}>How sources work</Text>
      <Text style={styles.infoText}>Facebook Groups are manual profile sources because Meta no longer provides a third-party Groups API. Facebook Pages and Instagram are stored in the same model so a Meta connection can populate them later without changing the profile structure.</Text>
    </View>

    <Text style={styles.sectionTitle}>Social presence</Text>
    {items.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No social profiles added</Text><Text style={styles.muted}>Add a Facebook Group, Facebook Page, Instagram account, or another public profile.</Text></View> : null}
    {items.map(item => <View key={item.id} style={[styles.socialCard, item.is_primary && styles.primaryCard]}>
      <View style={styles.socialTop}>
        {item.image_url ? <Image source={{uri:item.image_url}} style={styles.avatar}/> : <View style={styles.avatarFallback}><AppIcon name={item.kind === 'instagram' ? 'camera' : 'community'} color={C.gold} size={20}/></View>}
        <View style={styles.flex}><View style={styles.badgeRow}><Text style={styles.kind}>{socialKindLabel(item.kind)}</Text>{item.is_primary ? <Text style={styles.primaryBadge}>PRIMARY</Text> : null}{item.connection_mode === 'meta' ? <Text style={styles.connectedBadge}>CONNECTED</Text> : <Text style={styles.manualBadge}>MANUAL</Text>}</View><Text style={styles.socialName}>{item.display_name}</Text>{item.handle ? <Text style={styles.handle}>{item.handle}</Text> : null}</View>
      </View>
      {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
      {item.audience_count != null ? <Text style={styles.audience}>{item.audience_count.toLocaleString()} {item.audience_label || (item.kind === 'facebook_group' ? 'members' : 'followers')}</Text> : null}
      <Text style={styles.url} numberOfLines={1}>{item.url}</Text>
      <View style={styles.actions}>
        {!item.is_primary ? <Pressable style={styles.action} onPress={() => void makePrimary(item)}><Text style={styles.actionText}>Make primary</Text></Pressable> : null}
        <Pressable style={styles.action} onPress={() => void togglePublic(item)}><Text style={styles.actionText}>{item.is_public ? 'Public' : 'Hidden'}</Text></Pressable>
        <Pressable style={styles.action} onPress={() => edit(item)}><Text style={styles.actionText}>Edit</Text></Pressable>
        <Pressable style={styles.action} onPress={() => remove(item)}><Text style={styles.removeText}>Remove</Text></Pressable>
      </View>
    </View>)}

    <Text style={styles.sectionTitle}>{editingId ? 'Edit social profile' : 'Add social profile'}</Text>
    <View style={styles.card}>
      <Text style={styles.label}>Type</Text>
      <View style={styles.kindRow}>{KINDS.map(value => <Pressable key={value} style={[styles.kindPill, kind === value && styles.kindPillActive]} onPress={() => setKind(value)}><Text style={[styles.kindPillText, kind === value && styles.kindPillTextActive]}>{socialKindLabel(value)}</Text></Pressable>)}</View>
      <Field label="Profile or community name" value={displayName} onChangeText={setDisplayName} placeholder={kind === 'facebook_group' ? 'Melanated Adventurers' : 'Account name'}/>
      <Field label="Handle or username" value={handle} onChangeText={setHandle} placeholder="@melanatedadventurers"/>
      <Field label="Profile URL" value={url} onChangeText={setUrl} placeholder="https://"/>
      <Field label="Description" value={description} onChangeText={setDescription} multiline placeholder="Short description shown with this social presence"/>
      <Field label="Image URL (optional)" value={imageUrl} onChangeText={setImageUrl} placeholder="https://"/>
      <Field label={kind === 'facebook_group' ? 'Member count (optional)' : 'Follower count (optional)'} value={audienceCount} onChangeText={setAudienceCount} keyboardType="number-pad" placeholder="3200"/>
      <Pressable style={styles.toggleRow} onPress={() => setIsPublic(value => !value)}><View><Text style={styles.toggleTitle}>Show publicly</Text><Text style={styles.muted}>Members can open this social profile from the public Host Profile.</Text></View><Text style={styles.toggleValue}>{isPublic ? 'ON' : 'OFF'}</Text></Pressable>
      <Pressable style={styles.toggleRow} onPress={() => setIsPrimary(value => !value)}><View><Text style={styles.toggleTitle}>Primary social presence</Text><Text style={styles.muted}>Feature this source first on the public profile.</Text></View><Text style={styles.toggleValue}>{isPrimary ? 'ON' : 'OFF'}</Text></Pressable>
      <View style={styles.formActions}><Pressable disabled={saving || !displayName.trim() || !url.trim()} style={[styles.save, (saving || !displayName.trim() || !url.trim()) && styles.disabled]} onPress={() => void save()}>{saving ? <ActivityIndicator color="#152018"/> : <Text style={styles.saveText}>{editingId ? 'Save changes' : 'Add social profile'}</Text>}</Pressable>{editingId ? <Pressable style={styles.cancel} onPress={resetForm}><Text style={styles.cancelText}>Cancel</Text></Pressable> : null}</View>
    </View>

    <Text style={styles.sectionTitle}>Connection status</Text>
    <View style={styles.card}>
      <ConnectionRow title="Facebook Group" status="Manual" detail="Groups can still be featured prominently, but Meta no longer exposes the Groups API to third-party apps."/>
      <ConnectionRow title="Facebook Page" status={items.some(item => item.kind === 'facebook_page' && item.connection_mode === 'meta') ? 'Connected' : 'Ready for Meta setup'} detail="Page profile data can be connected after Meta app credentials are configured."/>
      <ConnectionRow title="Instagram" status={items.some(item => item.kind === 'instagram' && item.connection_mode === 'meta') ? 'Connected' : 'Ready for Meta setup'} detail="Instagram professional-account profile data uses the same organization source model."/>
    </View>

    {primary ? <Text style={styles.footer}>Primary social presence: {primary.display_name}</Text> : null}
  </ScrollView></SafeAreaView>;
}

function Field({label,multiline=false,...props}:any){return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} multiline={multiline} textAlignVertical={multiline?'top':'center'} placeholderTextColor="#657269" style={[styles.input,multiline&&styles.multiline]}/></View>}
function ConnectionRow({title,status,detail}:{title:string;status:string;detail:string}){return <View style={styles.connection}><View style={styles.flex}><Text style={styles.connectionTitle}>{title}</Text><Text style={styles.connectionDetail}>{detail}</Text></View><Text style={styles.connectionStatus}>{status}</Text></View>}

const styles=StyleSheet.create({safe:{flex:1,backgroundColor:C.bg},center:{flex:1,backgroundColor:C.bg,alignItems:'center',justifyContent:'center',gap:10},content:{padding:20,paddingBottom:120},back:{color:C.gold,fontWeight:'900',marginBottom:12},eyebrow:{color:C.gold,fontSize:10,fontWeight:'900',letterSpacing:1.1},title:{color:C.cream,fontSize:30,fontWeight:'900',marginTop:3},copy:{color:C.muted,fontSize:12,lineHeight:18,marginTop:7,maxWidth:720},muted:{color:C.muted,fontSize:10,lineHeight:15},errorCard:{backgroundColor:'#251614',borderColor:'#6A3E38',borderWidth:1,borderRadius:14,padding:12,marginTop:12},error:{color:'#F0A199',fontSize:11},infoCard:{backgroundColor:'#172019',borderWidth:1,borderColor:'#3A493F',borderRadius:16,padding:14,marginTop:16},infoTitle:{color:C.cream,fontSize:12,fontWeight:'900'},infoText:{color:C.muted,fontSize:10,lineHeight:16,marginTop:5},sectionTitle:{color:C.cream,fontSize:19,fontWeight:'900',marginTop:24,marginBottom:9},empty:{backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:16,padding:16},emptyTitle:{color:C.cream,fontSize:13,fontWeight:'900',marginBottom:4},socialCard:{backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:17,padding:14,marginBottom:9},primaryCard:{borderColor:'#6C5A2A'},socialTop:{flexDirection:'row',gap:11,alignItems:'center'},avatar:{width:48,height:48,borderRadius:14,backgroundColor:C.raised},avatarFallback:{width:48,height:48,borderRadius:14,backgroundColor:'#292516',alignItems:'center',justifyContent:'center'},flex:{flex:1},badgeRow:{flexDirection:'row',gap:5,alignItems:'center',flexWrap:'wrap'},kind:{color:C.gold,fontSize:8,fontWeight:'900',letterSpacing:.5},primaryBadge:{color:'#152018',backgroundColor:C.gold,fontSize:7,fontWeight:'900',paddingHorizontal:6,paddingVertical:3,borderRadius:999},manualBadge:{color:C.muted,fontSize:7,fontWeight:'800',borderWidth:1,borderColor:C.line,paddingHorizontal:6,paddingVertical:3,borderRadius:999},connectedBadge:{color:'#BFE5CA',fontSize:7,fontWeight:'900',borderWidth:1,borderColor:'#315C3D',paddingHorizontal:6,paddingVertical:3,borderRadius:999},socialName:{color:C.cream,fontSize:14,fontWeight:'900',marginTop:4},handle:{color:C.muted,fontSize:9,marginTop:2},description:{color:'#CBD4CE',fontSize:10,lineHeight:16,marginTop:10},audience:{color:C.gold,fontSize:10,fontWeight:'900',marginTop:8},url:{color:C.dim,fontSize:9,marginTop:5},actions:{flexDirection:'row',gap:7,flexWrap:'wrap',marginTop:12},action:{minHeight:34,borderWidth:1,borderColor:C.line,borderRadius:10,paddingHorizontal:10,alignItems:'center',justifyContent:'center'},actionText:{color:C.cream,fontSize:9,fontWeight:'800'},removeText:{color:'#F0A199',fontSize:9,fontWeight:'800'},card:{backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:17,padding:14},field:{marginTop:12},label:{color:'#D4DAD6',fontSize:10,fontWeight:'800',marginBottom:6},input:{minHeight:46,borderWidth:1,borderColor:'#344039',backgroundColor:'#101611',color:C.cream,borderRadius:12,paddingHorizontal:12,fontSize:12},multiline:{minHeight:88,paddingTop:11},kindRow:{flexDirection:'row',flexWrap:'wrap',gap:7},kindPill:{minHeight:36,borderRadius:999,borderWidth:1,borderColor:C.line,paddingHorizontal:11,alignItems:'center',justifyContent:'center'},kindPillActive:{backgroundColor:'#292516',borderColor:'#675925'},kindPillText:{color:C.muted,fontSize:9,fontWeight:'800'},kindPillTextActive:{color:C.gold},toggleRow:{minHeight:58,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:C.line,marginTop:12,paddingTop:10},toggleTitle:{color:C.cream,fontSize:11,fontWeight:'900'},toggleValue:{color:C.gold,fontSize:10,fontWeight:'900'},formActions:{flexDirection:'row',gap:8,marginTop:14},save:{minHeight:46,backgroundColor:C.gold,borderRadius:12,paddingHorizontal:18,alignItems:'center',justifyContent:'center'},saveText:{color:'#152018',fontSize:11,fontWeight:'900'},cancel:{minHeight:46,borderWidth:1,borderColor:C.line,borderRadius:12,paddingHorizontal:18,alignItems:'center',justifyContent:'center'},cancelText:{color:C.cream,fontSize:11,fontWeight:'900'},disabled:{opacity:.45},connection:{minHeight:70,flexDirection:'row',alignItems:'center',gap:12,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:C.line},connectionTitle:{color:C.cream,fontSize:11,fontWeight:'900'},connectionDetail:{color:C.muted,fontSize:9,lineHeight:14,marginTop:3},connectionStatus:{color:C.gold,fontSize:9,fontWeight:'900',maxWidth:110,textAlign:'right'},footer:{color:C.dim,fontSize:9,marginTop:12,textAlign:'center'}});
