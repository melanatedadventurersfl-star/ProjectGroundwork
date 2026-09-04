import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const options = [
  { title: 'Plan with AI', body: 'Have a guided planning conversation. AI asks what matters, recommends options, and builds toward a 95–100% ready event before creation.', route: '/host/plan-ai', icon: '✦', featured: true },
  { title: 'Scan Flyer or Poster', body: 'Take a photo or choose a flyer screenshot. Go Melanated reads the visible event details and builds a reviewable draft.', route: '/host/scan-flyer', icon: '▧' },
  { title: 'Build Manually', body: 'Enter the event basics yourself, then add the components and work this event needs.', route: '/host/create-scratch', icon: '＋' },
  { title: 'Choose an Event Starter', body: 'Start with a proven event setup, then add, remove or change any component.', route: '/host/create-template', icon: '▦' },
  { title: 'Import Files', body: 'Upload documents, images, or one ZIP package and turn them into an event draft.', route: '/host/import-event?mode=files', icon: '⇧' },
  { title: 'Import from Event Site', body: 'Paste a public Eventbrite, Meetup, ticketing or venue event page.', route: '/host/import-event?mode=site', icon: '↗' },
] as const;

export default function HostCreateChooserScreen() {
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Host Center</Text></Pressable>
    <Text style={styles.eyebrow}>BUILD AN EVENT</Text>
    <Text style={styles.title}>How do you want to start?</Text>
    <Text style={styles.subtitle}>AI planning and manual setup are separate paths. Choose the level of help you want, then build the event around the same Host Center components.</Text>
    <View style={styles.list}>{options.map((option) => <Pressable key={option.title} style={[styles.card, 'featured' in option && option.featured && styles.featuredCard]} onPress={() => router.push(option.route as never)}>
      <View style={[styles.icon, 'featured' in option && option.featured && styles.featuredIcon]}><Text style={styles.iconText}>{option.icon}</Text></View>
      <View style={{ flex: 1 }}><Text style={styles.cardTitle}>{option.title}</Text><Text style={styles.cardBody}>{option.body}</Text>{'featured' in option && option.featured ? <Text style={styles.privateNote}>Optional memory and planning analytics stay off unless you turn them on.</Text> : null}</View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>)}</View>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#0B100D' }, content: { padding: 20, paddingBottom: 60 }, back: { color: '#C8D1CB', fontSize: 12, fontWeight: '900', marginBottom: 18 }, eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }, title: { color: '#FFF8E8', fontSize: 34, lineHeight: 40, fontWeight: '900', marginTop: 4 }, subtitle: { color: '#9DA7A0', fontSize: 13, lineHeight: 20, marginTop: 7, marginBottom: 20 }, list: { gap: 10 }, card: { minHeight: 92, borderRadius: 17, borderWidth: 1, borderColor: '#334039', backgroundColor: '#151B17', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 13 }, featuredCard: { borderColor: '#7B6326', backgroundColor: '#1B1A12' }, icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#29351F', alignItems: 'center', justifyContent: 'center' }, featuredIcon: { backgroundColor: '#443616', borderWidth: 1, borderColor: '#806521' }, iconText: { color: '#D7B45A', fontSize: 22, fontWeight: '900' }, cardTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' }, cardBody: { color: '#8E9992', fontSize: 11, lineHeight: 16, marginTop: 4 }, privateNote: { color: '#B7A267', fontSize: 9, lineHeight: 13, marginTop: 6 }, chevron: { color: '#D7B45A', fontSize: 28, fontWeight: '800' } });
