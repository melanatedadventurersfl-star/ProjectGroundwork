import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getHostOrganization, type HostOrganization } from '../../src/hosting/hostProfiles';
import {
  disconnectMetaProfiles,
  getMetaConnectionStatus,
  listMetaPageAssets,
  selectMetaPage,
  startMetaConnection,
  syncMetaProfiles,
  type MetaConnectionStatus,
  type MetaPageAsset,
} from '../../src/hosting/hostMetaProfiles';

const C = { bg:'#0A0F0C', panel:'#131B16', raised:'#19231C', line:'#2D3A32', cream:'#FFF8E8', muted:'#95A29A', dim:'#6F7D75', gold:'#D7B45A' };

export default function MetaConnectScreen() {
  const { organizationId, meta, reason } = useLocalSearchParams<{ organizationId: string; meta?: string; reason?: string }>();
  const [org, setOrg] = useState<HostOrganization | null>(null);
  const [status, setStatus] = useState<MetaConnectionStatus | null>(null);
  const [assets, setAssets] = useState<MetaPageAsset[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true); setError('');
    try {
      const [organization, connectionStatus] = await Promise.all([
        getHostOrganization(organizationId),
        getMetaConnectionStatus(organizationId),
      ]);
      setOrg(organization);
      setStatus(connectionStatus);
      if (connectionStatus.connection) {
        const assetResult = await listMetaPageAssets(organizationId);
        setAssets(assetResult.assets);
        setSelectedPageId(assetResult.selectedPageId);
      } else {
        setAssets([]);
        setSelectedPageId(null);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load Meta connection.');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const selected = useMemo(() => assets.find(item => item.id === selectedPageId) ?? null, [assets, selectedPageId]);

  async function connect() {
    if (!organizationId) return;
    setBusy(true); setError('');
    try {
      await startMetaConnection(organizationId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to start Facebook sign-in.');
    } finally { setBusy(false); }
  }

  async function choosePage(page: MetaPageAsset) {
    if (!organizationId) return;
    setBusy(true); setError('');
    try {
      await selectMetaPage(organizationId, page.id);
      setSelectedPageId(page.id);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to connect that Page.');
    } finally { setBusy(false); }
  }

  async function sync() {
    if (!organizationId) return;
    setBusy(true); setError('');
    try { await syncMetaProfiles(organizationId); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to sync profile data.'); }
    finally { setBusy(false); }
  }

  function disconnect() {
    if (!organizationId) return;
    Alert.alert('Disconnect Facebook and Instagram?', 'Imported profile data will stay on the Host Profile as manual data. The Meta token will be removed.', [
      { text:'Cancel', style:'cancel' },
      { text:'Disconnect', style:'destructive', onPress:() => void (async () => {
        setBusy(true); setError('');
        try { await disconnectMetaProfiles(organizationId); await load(); }
        catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to disconnect Meta.'); }
        finally { setBusy(false); }
      })() },
    ]);
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color={C.gold}/><Text style={styles.muted}>Checking Meta connection…</Text></SafeAreaView>;

  const connected = Boolean(status?.connection);

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Social profile data</Text></Pressable>
    <Text style={styles.eyebrow}>FACEBOOK + INSTAGRAM</Text>
    <Text style={styles.title}>{org?.name || 'Host profile'}</Text>
    <Text style={styles.copy}>Connect the Facebook account that manages this organization’s Page. Go Melanated can then read Page profile data and a linked Instagram professional account. Nothing is published to Meta from this screen.</Text>

    {meta === 'connected' ? <View style={styles.success}><Text style={styles.successTitle}>Facebook authorization complete</Text><Text style={styles.successCopy}>Choose the Page that belongs to this Host Profile.</Text></View> : null}
    {meta === 'error' ? <View style={styles.errorCard}><Text style={styles.error}>Facebook connection did not finish{reason ? `: ${reason}` : '.'}</Text></View> : null}
    {error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text></View> : null}

    {!status?.configured ? <View style={styles.warning}>
      <Text style={styles.warningTitle}>Meta app setup required</Text>
      <Text style={styles.warningCopy}>The connector is installed, but the server still needs the Meta App ID, App Secret, Graph API version, and token-encryption key before Facebook sign-in can open.</Text>
    </View> : null}

    <View style={styles.card}>
      <View style={styles.rowBetween}><View style={styles.flex}><Text style={styles.cardTitle}>Meta connection</Text><Text style={styles.muted}>{connected ? 'Authorized with Facebook' : 'Not connected'}</Text></View><Text style={[styles.status, connected && styles.statusConnected]}>{connected ? 'CONNECTED' : 'OFF'}</Text></View>
      {status?.connection?.facebook_page_name ? <Info label="Facebook Page" value={status.connection.facebook_page_name}/> : null}
      {status?.connection?.instagram_username ? <Info label="Instagram" value={`@${status.connection.instagram_username.replace(/^@/, '')}`}/> : null}
      {status?.connection?.last_synced_at ? <Info label="Last synced" value={new Date(status.connection.last_synced_at).toLocaleString()}/> : null}
      <View style={styles.actions}>
        {!connected ? <Pressable disabled={busy || !status?.configured} style={[styles.primary, (busy || !status?.configured) && styles.disabled]} onPress={() => void connect()}>{busy ? <ActivityIndicator color="#152018"/> : <Text style={styles.primaryText}>Connect Facebook</Text>}</Pressable> : null}
        {connected && selectedPageId ? <Pressable disabled={busy} style={styles.secondary} onPress={() => void sync()}><Text style={styles.secondaryText}>Sync profile data</Text></Pressable> : null}
        {connected ? <Pressable disabled={busy} style={styles.secondary} onPress={disconnect}><Text style={styles.dangerText}>Disconnect</Text></Pressable> : null}
      </View>
    </View>

    {connected ? <>
      <Text style={styles.section}>Choose Facebook Page</Text>
      <Text style={styles.sectionCopy}>Only Pages returned by the authorized Facebook account appear here. Selecting one imports its public profile data and checks for a linked Instagram professional account.</Text>
      {assets.length === 0 ? <View style={styles.card}><Text style={styles.cardTitle}>No Pages returned</Text><Text style={styles.muted}>Confirm that the Facebook account manages a Page and granted the requested Page permissions.</Text></View> : null}
      {assets.map(page => <View key={page.id} style={[styles.asset, selectedPageId === page.id && styles.assetSelected]}>
        <View style={styles.assetTop}>
          {page.imageUrl ? <Image source={{uri:page.imageUrl}} style={styles.avatar}/> : <View style={styles.avatarFallback}/>} 
          <View style={styles.flex}><Text style={styles.assetName}>{page.name}</Text>{page.followers != null ? <Text style={styles.metaText}>{page.followers.toLocaleString()} Facebook followers</Text> : null}{page.instagram?.username ? <Text style={styles.instagram}>Instagram: @{page.instagram.username.replace(/^@/, '')}</Text> : <Text style={styles.metaText}>No linked Instagram professional account found</Text>}</View>
        </View>
        {page.about ? <Text style={styles.about}>{page.about}</Text> : null}
        <View style={styles.previewGrid}>
          {page.website ? <Info label="Website" value={page.website}/> : null}
          {page.instagram?.biography ? <Info label="Instagram bio" value={page.instagram.biography}/> : null}
          {page.instagram?.followers != null ? <Info label="Instagram followers" value={page.instagram.followers.toLocaleString()}/> : null}
        </View>
        <Pressable disabled={busy} style={[styles.selectButton, selectedPageId === page.id && styles.selectedButton]} onPress={() => void choosePage(page)}><Text style={styles.selectText}>{selectedPageId === page.id ? 'Selected' : 'Use this Page'}</Text></Pressable>
      </View>)}
    </> : null}

    {selected ? <View style={styles.note}><Text style={styles.noteTitle}>What gets imported</Text><Text style={styles.noteText}>Facebook Page name, Page link, about text, website, profile image, and audience count when Meta returns them. For a linked Instagram professional account, the connector can import username, name, bio, website, profile image, and follower count when those fields are available. Your Go Melanated organization fields are not overwritten automatically.</Text></View> : null}
  </ScrollView></SafeAreaView>;
}

function Info({label,value}:{label:string;value:string}){return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:C.bg},center:{flex:1,backgroundColor:C.bg,alignItems:'center',justifyContent:'center',gap:10},content:{padding:20,paddingBottom:120},back:{color:C.gold,fontWeight:'900',marginBottom:12},eyebrow:{color:C.gold,fontSize:10,fontWeight:'900',letterSpacing:1.1},title:{color:C.cream,fontSize:30,fontWeight:'900',marginTop:3},copy:{color:C.muted,fontSize:12,lineHeight:18,marginTop:7,maxWidth:720},muted:{color:C.muted,fontSize:10,lineHeight:15},errorCard:{backgroundColor:'#251614',borderColor:'#6A3E38',borderWidth:1,borderRadius:14,padding:12,marginTop:12},error:{color:'#F0A199',fontSize:11},success:{backgroundColor:'#14241A',borderColor:'#315C3D',borderWidth:1,borderRadius:14,padding:13,marginTop:14},successTitle:{color:'#CBEBD4',fontSize:12,fontWeight:'900'},successCopy:{color:'#9DC5A8',fontSize:10,marginTop:4},warning:{backgroundColor:'#282213',borderColor:'#655423',borderWidth:1,borderRadius:14,padding:13,marginTop:14},warningTitle:{color:C.gold,fontSize:12,fontWeight:'900'},warningCopy:{color:'#CFC5A3',fontSize:10,lineHeight:16,marginTop:5},card:{backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:17,padding:15,marginTop:16},rowBetween:{flexDirection:'row',alignItems:'center',gap:12,justifyContent:'space-between'},flex:{flex:1},cardTitle:{color:C.cream,fontSize:14,fontWeight:'900'},status:{fontSize:8,fontWeight:'900',color:C.muted,borderWidth:1,borderColor:C.line,borderRadius:999,paddingHorizontal:8,paddingVertical:4},statusConnected:{color:'#BFE5CA',borderColor:'#315C3D'},actions:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:14},primary:{minHeight:44,borderRadius:12,backgroundColor:C.gold,paddingHorizontal:16,alignItems:'center',justifyContent:'center'},primaryText:{color:'#152018',fontSize:10,fontWeight:'900'},secondary:{minHeight:42,borderRadius:12,borderWidth:1,borderColor:C.line,paddingHorizontal:14,alignItems:'center',justifyContent:'center'},secondaryText:{color:C.cream,fontSize:10,fontWeight:'900'},dangerText:{color:'#F0A199',fontSize:10,fontWeight:'900'},disabled:{opacity:.45},section:{color:C.cream,fontSize:19,fontWeight:'900',marginTop:24},sectionCopy:{color:C.muted,fontSize:10,lineHeight:16,marginTop:5,marginBottom:9},asset:{backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:17,padding:14,marginBottom:9},assetSelected:{borderColor:'#6C5A2A'},assetTop:{flexDirection:'row',gap:11,alignItems:'center'},avatar:{width:52,height:52,borderRadius:14,backgroundColor:C.raised},avatarFallback:{width:52,height:52,borderRadius:14,backgroundColor:C.raised},assetName:{color:C.cream,fontSize:14,fontWeight:'900'},metaText:{color:C.muted,fontSize:9,marginTop:3},instagram:{color:C.gold,fontSize:9,fontWeight:'800',marginTop:4},about:{color:'#CBD4CE',fontSize:10,lineHeight:16,marginTop:10},previewGrid:{marginTop:8},info:{paddingVertical:8,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:C.line},infoLabel:{color:C.dim,fontSize:8,fontWeight:'800',textTransform:'uppercase'},infoValue:{color:C.cream,fontSize:10,lineHeight:15,marginTop:3},selectButton:{minHeight:40,borderRadius:11,borderWidth:1,borderColor:C.line,alignItems:'center',justifyContent:'center',marginTop:10},selectedButton:{backgroundColor:'#292516',borderColor:'#655423'},selectText:{color:C.gold,fontSize:10,fontWeight:'900'},note:{backgroundColor:'#172019',borderWidth:1,borderColor:'#3A493F',borderRadius:16,padding:14,marginTop:18},noteTitle:{color:C.cream,fontSize:12,fontWeight:'900'},noteText:{color:C.muted,fontSize:10,lineHeight:16,marginTop:5}
});
