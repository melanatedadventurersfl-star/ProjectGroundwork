import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getOutingHostAccess, listMyHostOutings, type HostOuting, type OutingHostRecord } from '../../src/hosting/api';
import { getAssignedAdventures } from '../../src/operations/api';

export default function HostOperationsScreen() {
  const [loading, setLoading] = useState(true);
  const [approved, setApproved] = useState(false);
  const [paidEnabled, setPaidEnabled] = useState(false);
  const [record, setRecord] = useState<OutingHostRecord | null>(null);
  const [outings, setOutings] = useState<HostOuting[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [access, assigned] = await Promise.all([getOutingHostAccess(), getAssignedAdventures().catch(() => [])]);
      setApproved(access.approved); setPaidEnabled(access.paidEnabled); setRecord(access.record); setAssignments(assigned);
      setOutings(access.approved ? await listMyHostOutings() : []);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load host access.'); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const drafts = outings.filter((outing) => outing.status === 'draft' || outing.status === 'scheduled');
  const upcoming = outings.filter((outing) => ['published','sold_out'].includes(outing.status) && new Date(outing.ends_at) >= new Date());
  const past = outings.filter((outing) => outing.status === 'completed' || outing.status === 'cancelled' || new Date(outing.ends_at) < new Date());

  const statusCopy: Record<string, [string,string]> = {
    pending: ['Application in review', 'Your Host Pathway is complete. We’ll review your application before hosting tools unlock.'],
    needs_info: ['We need a little more information', 'Your application is still open. Go Melanated needs additional information before making a decision.'],
    paused: ['Hosting is paused', 'Your host access is temporarily paused while it is reviewed.'],
    declined: ['Application not approved', 'Your current application was not approved. Contact support if you need clarification or believe it should be reconsidered.'],
    revoked: ['Hosting access revoked', 'Your host access is no longer active. Contact support if you need clarification.'],
  };

  return (
    <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>HOSTING</Text><Text style={styles.title}>Host Hub</Text>
      <Text style={styles.subtitle}>Create community outings, manage the people joining you, and run live adventures from one place.</Text>
      {loading ? <ActivityIndicator color="#D7B45A" style={{ marginTop: 28 }} /> : null}

      {!loading && !approved && !record ? (
        <View style={styles.applicationCard}>
          <Text style={styles.cardEyebrow}>BECOME A HOST</Text><Text style={styles.cardTitle}>Lead the next adventure.</Text>
          <Text style={styles.body}>The Host Pathway combines a short application, safety commitment, and practical orientation. Approval starts with free community outings; paid hosting is a separate permission.</Text>
          <View style={styles.pathway}><PathStep n="1" text="Tell us what you want to host"/><PathStep n="2" text="Complete the host orientation"/><PathStep n="3" text="Accept safety & community commitments"/><PathStep n="4" text="Go Melanated reviews the application"/></View>
          <Pressable style={styles.primary} onPress={() => router.push('/host/apply' as never)}><Text style={styles.primaryText}>Start Host Pathway</Text></Pressable>
        </View>
      ) : null}

      {!loading && !approved && record ? (() => { const copy = statusCopy[record.status] ?? ['Application status', 'Your hosting application is being reviewed.']; return (
        <View style={styles.applicationCard}><Text style={styles.cardEyebrow}>{record.status.replace('_',' ').toUpperCase()}</Text><Text style={styles.cardTitle}>{copy[0]}</Text><Text style={styles.body}>{copy[1]}</Text>
          {record.status === 'needs_info' ? <Text style={styles.reviewNote}>Reviewer note: {(record as any).review_reason || 'Check with Go Melanated for the requested details.'}</Text> : null}
        </View>); })() : null}

      {!loading && approved ? <>
        <View style={styles.statusCard}><View style={{ flex: 1 }}><Text style={styles.statusLabel}>{(record as any)?.host_stage === 'new' ? 'NEW HOST' : 'APPROVED HOST'}</Text><Text style={styles.statusTitle}>{record?.host_type === 'official' ? 'Go Melanated Official' : 'Community Host'}</Text></View><View style={[styles.pill, paidEnabled ? styles.pillGold : styles.pillMuted]}><Text style={paidEnabled ? styles.pillGoldText : styles.pillMutedText}>{paidEnabled ? 'Paid enabled' : 'Free outings'}</Text></View></View>
        <Pressable style={styles.createCard} onPress={() => router.push('/host/create' as never)}><Text style={styles.createKicker}>NEW OUTING</Text><Text style={styles.createTitle}>Start with the adventure.</Text><Text style={styles.createCopy}>Build the details, ticket, and launch plan.</Text><Text style={styles.createAction}>Create outing →</Text></Pressable>
        <View style={styles.metrics}><Metric value={outings.length} label="Outings"/><Metric value={upcoming.length} label="Upcoming"/><Metric value={drafts.length} label="Drafts"/></View>
        <OutingSection title="Drafts" empty="Nothing in the workshop yet." outings={drafts}/><OutingSection title="Upcoming" empty="Published outings will show here." outings={upcoming}/><OutingSection title="Past" empty="Completed outings become part of your host story." outings={past}/>
      </> : null}

      {assignments.length > 0 ? <View style={styles.section}><Text style={styles.sectionTitle}>Field assignments</Text>{assignments.map((item) => { const adventure=item.adventures; return <Pressable key={`${item.adventure_id}-${item.role}`} style={styles.outingCard} onPress={() => router.push(`/host/${item.adventure_id}` as never)}><View style={{flex:1}}><Text style={styles.outingStatus}>FIELD OPERATIONS · {String(item.role).replace('_',' ').toUpperCase()}</Text><Text style={styles.outingTitle}>{adventure?.title ?? 'Adventure'}</Text><Text style={styles.outingMeta}>{adventure?.city}, {adventure?.state}</Text></View><Text style={styles.chevron}>›</Text></Pressable>; })}</View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView></SafeAreaView>
  );
}

function PathStep({n,text}:{n:string;text:string}) { return <View style={styles.pathRow}><View style={styles.pathDot}><Text style={styles.pathDotText}>{n}</Text></View><Text style={styles.pathText}>{text}</Text></View>; }
function Metric({value,label}:{value:number;label:string}) { return <View style={styles.metric}><Text style={styles.metricNumber}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function OutingSection({title,empty,outings}:{title:string;empty:string;outings:HostOuting[]}) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{outings.length===0?<Text style={styles.empty}>{empty}</Text>:outings.map((outing)=><Pressable key={outing.id} style={styles.outingCard} onPress={()=>router.push(`/host/manage/${outing.id}` as never)}><View style={{flex:1}}><Text style={styles.outingStatus}>{outing.status.toUpperCase()}</Text><Text style={styles.outingTitle}>{outing.title}</Text><Text style={styles.outingMeta}>{new Date(outing.starts_at).toLocaleDateString()} · {outing.city}, {outing.state}</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}</View>; }

const styles=StyleSheet.create({
 safe:{flex:1,backgroundColor:'#0B100D'},content:{padding:20,paddingBottom:60},eyebrow:{color:'#D7B45A',fontSize:11,fontWeight:'900',letterSpacing:1.2},title:{color:'#FFF8E8',fontSize:36,lineHeight:42,fontWeight:'900',marginTop:4},subtitle:{color:'#A8B1AB',fontSize:15,lineHeight:22,marginTop:5,marginBottom:22},
 applicationCard:{borderRadius:20,borderWidth:1,borderColor:'#314438',backgroundColor:'#121C16',padding:18},cardEyebrow:{color:'#D7B45A',fontSize:10,fontWeight:'900',letterSpacing:1},cardTitle:{color:'#FFF8E8',fontSize:23,lineHeight:29,fontWeight:'900',marginTop:7},body:{color:'#AAB4AD',fontSize:14,lineHeight:21,marginTop:8},reviewNote:{color:'#E7C464',fontSize:11,lineHeight:17,marginTop:12},
 pathway:{marginTop:17,gap:9},pathRow:{flexDirection:'row',alignItems:'center',gap:10},pathDot:{width:25,height:25,borderRadius:13,backgroundColor:'#3A311A',alignItems:'center',justifyContent:'center'},pathDotText:{color:'#E7C464',fontWeight:'900',fontSize:10},pathText:{color:'#C1C9C4',fontSize:12,fontWeight:'800'},primary:{backgroundColor:'#D7B45A',borderRadius:14,minHeight:50,alignItems:'center',justifyContent:'center',marginTop:18},primaryText:{color:'#172017',fontWeight:'900',fontSize:15},
 statusCard:{borderRadius:18,borderWidth:1,borderColor:'#31533F',backgroundColor:'#11241A',padding:16,flexDirection:'row',alignItems:'center',gap:12},statusLabel:{color:'#D7B45A',fontSize:10,fontWeight:'900',letterSpacing:1},statusTitle:{color:'#FFF8E8',fontSize:19,fontWeight:'900',marginTop:3},pill:{borderRadius:20,paddingHorizontal:10,paddingVertical:7},pillGold:{backgroundColor:'#413515',borderWidth:1,borderColor:'#705920'},pillMuted:{backgroundColor:'#202722',borderWidth:1,borderColor:'#39413C'},pillGoldText:{color:'#E7C464',fontSize:10,fontWeight:'900'},pillMutedText:{color:'#A7B0AA',fontSize:10,fontWeight:'900'},
 createCard:{marginTop:16,borderRadius:20,padding:18,backgroundColor:'#463614',borderWidth:1,borderColor:'#8A6A25'},createKicker:{color:'#E7C464',fontSize:10,fontWeight:'900',letterSpacing:1},createTitle:{color:'#FFF5D9',fontSize:24,fontWeight:'900',marginTop:5},createCopy:{color:'#D1C39C',fontSize:13,marginTop:4},createAction:{color:'#F2CF72',fontWeight:'900',marginTop:16},metrics:{flexDirection:'row',gap:10,marginTop:16},metric:{flex:1,borderRadius:14,borderWidth:1,borderColor:'#2D3731',backgroundColor:'#151B17',padding:13},metricNumber:{color:'#FFF8E8',fontSize:22,fontWeight:'900'},metricLabel:{color:'#8F9A93',fontSize:10,fontWeight:'800',marginTop:2},
 section:{marginTop:25},sectionTitle:{color:'#D7B45A',fontSize:11,fontWeight:'900',letterSpacing:1,textTransform:'uppercase',marginBottom:8},empty:{color:'#758079',fontSize:13,lineHeight:19,paddingVertical:8},outingCard:{borderRadius:15,backgroundColor:'#171D19',borderWidth:1,borderColor:'#2B332E',padding:15,marginBottom:9,flexDirection:'row',alignItems:'center'},outingStatus:{color:'#9D8647',fontSize:9,fontWeight:'900',letterSpacing:.8},outingTitle:{color:'#FFF8E8',fontSize:16,fontWeight:'900',marginTop:3},outingMeta:{color:'#8E9891',fontSize:11,marginTop:4},chevron:{color:'#D7B45A',fontSize:28,marginLeft:10},error:{color:'#FF8A80',marginTop:18,fontSize:12,lineHeight:18}
});