import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { listMyHostOrganizations, type HostOrganization } from '../../src/hosting/hostProfiles';
import { getActiveOrganization, type OrganizationWorkspace } from '../../src/platform/organizations';
import { AppIcon } from '../../src/ui/AppIcon';

const C = { bg: '#0A0F0C', panel: '#131B16', raised: '#19231C', line: '#2D3A32', cream: '#FFF8E8', muted: '#95A29A', gold: '#D7B45A' };

export default function HostProfileHubScreen() {
  const [organizations, setOrganizations] = useState<HostOrganization[]>([]);
  const [activeOrganization, setActiveOrganization] = useState<OrganizationWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [profiles, tenant] = await Promise.all([listMyHostOrganizations(), getActiveOrganization()]);
      setOrganizations(profiles);
      setActiveOrganization(tenant);
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load host profiles.'); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const setupLabel = activeOrganization?.name ? `Set up ${activeOrganization.name} profile` : 'Create your first host profile';
  const openNewProfile = () => router.push({
    pathname: '/host/organization-new',
    params: activeOrganization ? { suggestedName: activeOrganization.name, suggestedKind: activeOrganization.kind } : {},
  } as never);

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Host Center</Text></Pressable>
    <Text style={styles.eyebrow}>HOST PROFILE</Text>
    <Text style={styles.title}>Your host profiles</Text>
    <Text style={styles.copy}>Build the public identity people see, then manage its team, followers, events, and history separately.</Text>

    {activeOrganization ? <View style={styles.tenantPill}><Text style={styles.tenantPillText}>{activeOrganization.name}</Text></View> : null}
    {error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text></View> : null}
    {loading ? <View style={styles.loading}><ActivityIndicator color={C.gold} /><Text style={styles.muted}>Loading host profiles…</Text></View> : null}

    {!loading && organizations.length === 0 ? <View style={styles.empty}>
      <View style={styles.emptyIcon}><AppIcon name="storefront" color={C.gold} size={28} /></View>
      <Text style={styles.emptyTitle}>{setupLabel}</Text>
      <Text style={styles.muted}>This client does not have a public host profile yet. Create one here. Information, media, and defaults from another organization will not be reused.</Text>
      <Pressable style={styles.primary} onPress={openNewProfile}><Text style={styles.primaryText}>Start profile setup</Text></Pressable>
    </View> : null}

    {organizations.map((org) => <View key={org.id} style={styles.card}>
      <View style={styles.cardTop}>
        {org.logo_url ? <Image source={{ uri: org.logo_url }} style={styles.logo} /> : <View style={styles.logoFallback}><AppIcon name="storefront" color={C.gold} size={24} /></View>}
        <View style={styles.flex}>
          <Text style={styles.orgName}>{org.name}</Text>
          <Text style={styles.orgMeta}>{[org.city, org.state].filter(Boolean).join(', ') || 'Host organization'}</Text>
          {org.tagline || org.description ? <Text style={styles.orgDescription} numberOfLines={2}>{org.tagline || org.description}</Text> : null}
        </View>
      </View>
      <View style={styles.stats}>
        <Stat value={org.upcoming_count ?? 0} label="Upcoming" />
        <Stat value={org.hosted_count ?? 0} label="Hosted" />
        <Stat value={org.follower_count ?? 0} label="Followers" />
      </View>
      <View style={styles.contentTools}>
        <Text style={styles.contentToolsTitle}>Public profile content</Text>
        <Text style={styles.muted}>Import existing FAQs and policies instead of rebuilding them by hand.</Text>
        <View style={styles.actions}>
          <Pressable style={styles.contentButton} onPress={() => router.push({ pathname:'/host/profile-content-import', params:{ organizationId:org.id, target:'faq' } } as never)}><Text style={styles.contentButtonText}>FAQs · {org.faq.length}</Text></Pressable>
          <Pressable style={styles.contentButton} onPress={() => router.push({ pathname:'/host/profile-content-import', params:{ organizationId:org.id, target:'policies' } } as never)}><Text style={styles.contentButtonText}>Policies · {org.policies.length}</Text></Pressable>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable style={styles.primary} onPress={() => router.push(`/host/organization-profile-editor/${org.id}` as never)}><Text style={styles.primaryText}>Edit public profile</Text></Pressable>
        <Pressable style={styles.secondary} onPress={() => router.push(`/host/organization/${org.id}` as never)}><Text style={styles.secondaryText}>Team + history</Text></Pressable>
        <Pressable style={styles.secondary} onPress={() => router.push({ pathname:'/host/social-profiles', params:{ organizationId:org.id } } as never)}><Text style={styles.secondaryText}>Social profile data</Text></Pressable>
        <Pressable style={styles.secondary} onPress={() => router.push({ pathname:'/host/meta-connect', params:{ organizationId:org.id } } as never)}><Text style={styles.secondaryText}>Connect Facebook + Instagram</Text></Pressable>
        <Pressable style={styles.secondary} onPress={() => router.push(`/organization-profile/${org.slug}` as never)}><Text style={styles.secondaryText}>View public profile</Text></Pressable>
      </View>
    </View>)}

    {organizations.length > 0 ? <Pressable style={styles.create} onPress={openNewProfile}>
      <View style={styles.createIcon}><AppIcon name="add" color={C.gold} size={22} /></View>
      <View style={styles.flex}><Text style={styles.createTitle}>Create another host profile</Text><Text style={styles.muted}>Add another public identity owned by {activeOrganization?.name ?? 'this client'}.</Text></View>
      <Text style={styles.chevron}>›</Text>
    </Pressable> : null}
  </ScrollView></SafeAreaView>;
}

function Stat({ value, label }: { value: number; label: string }) { return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:C.bg},content:{padding:20,paddingBottom:100,gap:12},back:{color:C.gold,fontWeight:'900',marginBottom:8},eyebrow:{color:C.gold,fontSize:10,fontWeight:'900',letterSpacing:1.1},title:{color:C.cream,fontSize:32,fontWeight:'900'},copy:{color:C.muted,fontSize:12,lineHeight:18,marginBottom:5,maxWidth:680},tenantPill:{alignSelf:'flex-start',borderWidth:1,borderColor:C.line,backgroundColor:C.raised,borderRadius:999,paddingHorizontal:10,paddingVertical:6},tenantPillText:{color:C.gold,fontSize:9,fontWeight:'900'},loading:{paddingVertical:30,alignItems:'center',gap:10},muted:{color:C.muted,fontSize:11,lineHeight:16},errorCard:{backgroundColor:'#251614',borderWidth:1,borderColor:'#6A3E38',borderRadius:14,padding:12},error:{color:'#F0A199'},empty:{backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:18,padding:22,alignItems:'center',gap:10},emptyIcon:{width:54,height:54,borderRadius:17,backgroundColor:'#292516',alignItems:'center',justifyContent:'center'},emptyTitle:{color:C.cream,fontSize:17,fontWeight:'900',textAlign:'center'},card:{backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:20,padding:16,gap:14},cardTop:{flexDirection:'row',gap:12,alignItems:'center'},logo:{width:64,height:64,borderRadius:18,backgroundColor:C.raised},logoFallback:{width:64,height:64,borderRadius:18,backgroundColor:'#292516',alignItems:'center',justifyContent:'center'},flex:{flex:1},orgName:{color:C.cream,fontSize:20,fontWeight:'900'},orgMeta:{color:C.gold,fontSize:10,fontWeight:'800',marginTop:3},orgDescription:{color:C.muted,fontSize:11,lineHeight:16,marginTop:5},stats:{flexDirection:'row',gap:8},stat:{flex:1,backgroundColor:C.raised,borderRadius:13,padding:10},statValue:{color:C.cream,fontSize:18,fontWeight:'900'},statLabel:{color:C.muted,fontSize:9,marginTop:2},contentTools:{backgroundColor:C.raised,borderRadius:14,padding:12,gap:8},contentToolsTitle:{color:C.cream,fontSize:13,fontWeight:'900'},contentButton:{minHeight:40,borderRadius:11,borderWidth:1,borderColor:C.gold,paddingHorizontal:14,alignItems:'center',justifyContent:'center'},contentButtonText:{color:C.gold,fontSize:11,fontWeight:'900'},actions:{flexDirection:'row',gap:8,flexWrap:'wrap'},primary:{minHeight:44,borderRadius:12,backgroundColor:C.gold,paddingHorizontal:16,alignItems:'center',justifyContent:'center'},primaryText:{color:'#152018',fontSize:11,fontWeight:'900'},secondary:{minHeight:44,borderRadius:12,borderWidth:1,borderColor:C.line,paddingHorizontal:16,alignItems:'center',justifyContent:'center'},secondaryText:{color:C.cream,fontSize:11,fontWeight:'900'},create:{minHeight:82,borderRadius:18,borderWidth:1,borderColor:C.line,backgroundColor:C.panel,padding:14,flexDirection:'row',alignItems:'center',gap:12},createIcon:{width:46,height:46,borderRadius:14,backgroundColor:'#292516',alignItems:'center',justifyContent:'center'},createTitle:{color:C.cream,fontSize:14,fontWeight:'900'},chevron:{color:C.muted,fontSize:25}
});