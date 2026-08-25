import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { supabase } from '../../src/lib/supabase';

type Action = 'advisory' | 'warning' | 'posting_restriction' | 'suspension' | 'ban';
type Report = {
  id: string;
  post_id: string | null;
  comment_id: string | null;
  reporter_id: string;
  reported_author_id: string | null;
  reason: string;
  details: string | null;
  status: string;
  priority: string;
  content_snapshot: string | null;
  created_at: string;
  action_taken: string | null;
  abuse_classification: string | null;
};
type Enforcement = { id: string; action_type: Action; reason: string; starts_at: string; expires_at: string | null; active: boolean };

type CaseData = {
  report: Report;
  memberName: string;
  mediaUrl: string | null;
  mediaType: 'image' | 'video' | null;
  activeWarnings: number;
  yearViolations: number;
  history: Enforcement[];
};

async function signed(path: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const { data, error } = await supabase.storage.from('community-media').createSignedUrl(path, 3600);
  return error ? null : data.signedUrl;
}

export default function ModerationCaseScreen() {
  const params = useLocalSearchParams<{ reportId?: string }>();
  const reportId = Array.isArray(params.reportId) ? params.reportId[0] : params.reportId;
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [data, setData] = useState<CaseData | null>(null);
  const [error, setError] = useState('');
  const [abuseNote, setAbuseNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true); setError('');
    if (!reportId) { setError('Missing report reference.'); setLoading(false); return; }
    const admin = await supabase.rpc('is_platform_admin');
    if (admin.error || admin.data !== true) { setAuthorized(false); if (admin.error) setError(admin.error.message); setLoading(false); return; }
    setAuthorized(true);

    const { data: reportData, error: reportError } = await supabase.from('community_reports').select('id,post_id,comment_id,reporter_id,reported_author_id,reason,details,status,priority,content_snapshot,created_at,action_taken,abuse_classification').eq('id', reportId).single();
    if (reportError || !reportData) { setError(reportError?.message ?? 'Case not found.'); setLoading(false); return; }
    const report = reportData as Report;
    const memberId = report.reported_author_id;

    const profilePromise = memberId ? supabase.from('profiles').select('display_name,username').eq('id', memberId).single() : Promise.resolve({ data: null, error: null });
    const historyPromise = memberId ? supabase.from('community_member_enforcements').select('id,action_type,reason,starts_at,expires_at,active').eq('member_id', memberId).order('starts_at', { ascending: false }) : Promise.resolve({ data: [], error: null });
    const [profileResult, historyResult] = await Promise.all([profilePromise, historyPromise]);
    if (historyResult.error) { setError(historyResult.error.message); setLoading(false); return; }

    let mediaUrl: string | null = null;
    let mediaType: 'image' | 'video' | null = null;
    if (report.post_id) {
      const { data: post } = await supabase.from('community_posts').select('image_url,metadata').eq('id', report.post_id).maybeSingle();
      const path = post?.image_url ?? null;
      mediaUrl = await signed(path);
      mediaType = path ? (post?.metadata?.media_type === 'video' ? 'video' : 'image') : null;
    } else if (report.comment_id) {
      const { data: comment } = await supabase.from('community_comments').select('image_paths').eq('id', report.comment_id).maybeSingle();
      const path = Array.isArray(comment?.image_paths) ? comment.image_paths[0] ?? null : null;
      mediaUrl = await signed(path);
      mediaType = path ? 'image' : null;
    }

    const history = (historyResult.data ?? []) as Enforcement[];
    const now = Date.now();
    const activeWarnings = history.filter((item) => item.action_type === 'warning' && item.active && (!item.expires_at || new Date(item.expires_at).getTime() > now)).length;
    const yearAgo = now - 365 * 24 * 60 * 60 * 1000;
    const yearViolations = history.filter((item) => item.action_type !== 'advisory' && new Date(item.starts_at).getTime() >= yearAgo).length;
    const profile = profileResult.data as { display_name?: string | null; username?: string | null } | null;
    setData({ report, memberName: profile?.display_name ?? profile?.username ?? 'Member', mediaUrl, mediaType, activeWarnings, yearViolations, history });
    setLoading(false);
  }

  useEffect(() => { void load(); }, [reportId]);

  async function classifyAbuse(abusive: boolean) {
    if (!data || busy) return;
    if (abusive && !abuseNote.trim()) { Alert.alert('Internal note required', 'Explain why this report is considered deliberate misuse before continuing.'); return; }
    setBusy(true); setError('');
    const { error: rpcError } = await supabase.rpc('classify_report_abuse', { p_report_id: data.report.id, p_abusive: abusive, p_note: abuseNote.trim() || null });
    if (rpcError) setError(rpcError.message); else { setAbuseNote(''); await load(); }
    setBusy(false);
  }

  const escalation = useMemo(() => {
    if (!data) return null;
    if (data.activeWarnings >= 2) return 'Escalation required. Another confirmed ordinary violation cannot be handled as a simple warning.';
    if (data.yearViolations >= 4) return 'Elevated 12-month conduct history. Review prior restrictions and suspensions before deciding.';
    return 'No mandatory escalation threshold is currently active.';
  }, [data]);

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#D7B45A" size="large" /><Text style={styles.muted}>Loading case…</Text></View></SafeAreaView>;
  if (!authorized || !data) return <SafeAreaView style={styles.safe}><View style={styles.content}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable><Text style={styles.title}>{authorized ? 'Case unavailable' : 'Admin access required'}</Text>{error ? <Text style={styles.error}>{error}</Text> : null}</View></SafeAreaView>;

  const { report } = data;
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Moderation Queue</Text></Pressable>
    <View style={styles.header}><Text style={styles.eyebrow}>COMMUNITY SAFETY CASE</Text><Text style={styles.title}>Case {report.id.slice(0, 8).toUpperCase()}</Text><Text style={styles.subtitle}>{report.priority === 'high' ? 'High priority' : 'Standard review'} · {new Date(report.created_at).toLocaleString()}</Text></View>
    {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}

    <View style={styles.card}><Text style={styles.label}>EVIDENCE</Text><Text style={styles.reason}>{report.reason}</Text>{data.mediaUrl && data.mediaType === 'image' ? <Image source={{ uri: data.mediaUrl }} resizeMode="contain" style={styles.image} /> : null}{data.mediaUrl && data.mediaType === 'video' ? <Pressable style={styles.video} onPress={() => void Linking.openURL(data.mediaUrl!)}><Text style={styles.videoText}>Open video evidence</Text></Pressable> : null}{report.content_snapshot ? <View style={styles.snapshot}><Text style={styles.snapshotText}>{report.content_snapshot}</Text></View> : null}{report.details ? <Text style={styles.note}>Reporter note: {report.details}</Text> : null}</View>

    <View style={styles.card}><Text style={styles.label}>MEMBER STANDING</Text><Text style={styles.member}>{data.memberName}</Text><View style={styles.metrics}><Metric value={String(data.activeWarnings)} label="ACTIVE WARNINGS" /><Metric value={String(data.yearViolations)} label="12-MO ACTIONS" /><Metric value={String(data.history.length)} label="LIFETIME" /></View><View style={[styles.escalation, data.activeWarnings >= 2 && styles.escalationHot]}><Text style={styles.escalationText}>{escalation}</Text></View></View>

    <View style={styles.card}><Text style={styles.label}>RECENT HISTORY</Text>{data.history.length === 0 ? <Text style={styles.muted}>No prior moderation actions.</Text> : data.history.slice(0, 6).map((item) => <View key={item.id} style={styles.historyRow}><Text style={styles.historyAction}>{item.action_type.replace(/_/g, ' ').toUpperCase()}</Text><Text style={styles.historyReason}>{item.reason}</Text><Text style={styles.historyMeta}>{new Date(item.starts_at).toLocaleDateString()} · {item.active ? 'Active' : 'Historical'}</Text></View>)}</View>

    <View style={styles.card}><Text style={styles.label}>CASE ACTIONS</Text><Pressable style={styles.primary} onPress={() => router.push(`/admin/moderation?reportId=${report.id}` as never)}><Text style={styles.primaryText}>Take enforcement action</Text></Pressable><Pressable style={styles.secondary} onPress={() => router.push('/admin/moderation-appeals' as never)}><Text style={styles.secondaryText}>Open appeals</Text></Pressable></View>

    <View style={styles.abuseCard}><Text style={styles.label}>REPORT QUALITY</Text><Text style={styles.abuseTitle}>{report.abuse_classification === 'abusive_report' ? 'Marked as abusive reporting' : report.abuse_classification === 'none' ? 'Reviewed as good-faith report' : 'Not yet classified'}</Text><Text style={styles.note}>A report that finds no violation is not automatically abusive. Use this only for deliberate misuse, retaliation, repeated targeting, or knowingly false reporting.</Text><TextInput value={abuseNote} onChangeText={setAbuseNote} multiline placeholder="Internal note required for abusive reporting…" placeholderTextColor="#68766E" style={styles.input} /><Pressable disabled={busy} style={styles.secondary} onPress={() => void classifyAbuse(false)}><Text style={styles.secondaryText}>Good-faith report</Text></Pressable><Pressable disabled={busy} style={styles.danger} onPress={() => void classifyAbuse(true)}><Text style={styles.dangerText}>{busy ? 'Working…' : 'Mark report abuse'}</Text></Pressable></View>
  </ScrollView></SafeAreaView>;
}

function Metric({ value, label }: { value: string; label: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({ safe:{flex:1,backgroundColor:'#0F1713'},content:{padding:20,paddingBottom:50,gap:14},center:{flex:1,alignItems:'center',justifyContent:'center',gap:10},back:{color:'#D7B45A',fontSize:15,fontWeight:'900',paddingVertical:6},header:{gap:4},eyebrow:{color:'#D7B45A',fontSize:10,fontWeight:'900',letterSpacing:1.1},title:{color:'#FFF8E8',fontSize:31,fontWeight:'900'},subtitle:{color:'#8D9A92',fontSize:12},muted:{color:'#8D9A92',fontSize:12,lineHeight:18},errorBox:{borderRadius:12,borderWidth:1,borderColor:'#5C3A36',backgroundColor:'#241817',padding:12},error:{color:'#FFB4A9',fontSize:12,lineHeight:18},card:{borderRadius:18,borderWidth:1,borderColor:'#33443A',backgroundColor:'#17211C',padding:14,gap:10},label:{color:'#D7B45A',fontSize:9,fontWeight:'900',letterSpacing:.9},reason:{color:'#FFF8E8',fontSize:20,fontWeight:'900'},image:{width:'100%',height:280,borderRadius:12,backgroundColor:'#090E0B'},video:{minHeight:52,borderRadius:12,borderWidth:1,borderColor:'#59695F',alignItems:'center',justifyContent:'center'},videoText:{color:'#FFF8E8',fontSize:12,fontWeight:'900'},snapshot:{borderRadius:12,backgroundColor:'#101914',padding:12},snapshotText:{color:'#E8ECE9',fontSize:14,lineHeight:20},note:{color:'#A9B4AD',fontSize:11,lineHeight:17},member:{color:'#FFF8E8',fontSize:19,fontWeight:'900'},metrics:{flexDirection:'row',gap:8},metric:{flex:1,borderRadius:12,borderWidth:1,borderColor:'#2D3B33',padding:10,alignItems:'center',gap:3},metricValue:{color:'#FFF8E8',fontSize:20,fontWeight:'900'},metricLabel:{color:'#8D9A92',fontSize:8,fontWeight:'900',letterSpacing:.6,textAlign:'center'},escalation:{borderRadius:12,borderWidth:1,borderColor:'#4B513F',backgroundColor:'#1B2118',padding:10},escalationHot:{borderColor:'#8B6331',backgroundColor:'#2A2114'},escalationText:{color:'#E6D7B2',fontSize:11,lineHeight:17,fontWeight:'700'},historyRow:{borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'#314138',paddingTop:8,gap:2},historyAction:{color:'#D7B45A',fontSize:9,fontWeight:'900',letterSpacing:.6},historyReason:{color:'#E8ECE9',fontSize:12,fontWeight:'800'},historyMeta:{color:'#7F8B83',fontSize:10},primary:{minHeight:48,borderRadius:13,backgroundColor:'#D7B45A',alignItems:'center',justifyContent:'center'},primaryText:{color:'#16140E',fontSize:12,fontWeight:'900'},secondary:{minHeight:44,borderRadius:12,borderWidth:1,borderColor:'#506157',alignItems:'center',justifyContent:'center'},secondaryText:{color:'#FFF8E8',fontSize:12,fontWeight:'900'},abuseCard:{borderRadius:18,borderWidth:1,borderColor:'#644239',backgroundColor:'#211817',padding:14,gap:10},abuseTitle:{color:'#FFF8E8',fontSize:17,fontWeight:'900'},input:{minHeight:90,borderRadius:12,borderWidth:1,borderColor:'#4B5146',backgroundColor:'#0F1713',color:'#FFF8E8',padding:11,textAlignVertical:'top',fontSize:12,lineHeight:18},danger:{minHeight:44,borderRadius:12,borderWidth:1,borderColor:'#7A433C',backgroundColor:'#2A1D1B',alignItems:'center',justifyContent:'center'},dangerText:{color:'#FFB4A9',fontSize:12,fontWeight:'900'} });