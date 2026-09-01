import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const options = [
  { title: 'Create from Scratch', body: 'Build the event manually or start with Host Copilot.', route: '/host/create-scratch', icon: '＋' },
  { title: 'Start from Template', body: 'Reuse a proven event structure with fresh dates, location and work.', route: '/host/create-template', icon: '▦' },
  { title: 'Import Files', body: 'Upload documents, images, or one ZIP package and turn them into an event draft.', route: '/host/import-event?mode=files', icon: '⇧' },
  { title: 'Import from Event Site', body: 'Paste a public Eventbrite, Meetup, ticketing or venue event page.', route: '/host/import-event?mode=site', icon: '↗' },
] as const;

export default function HostCreateChooserScreen() {
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Host Center</Text></Pressable>
    <Text style={styles.eyebrow}>CREATE EVENT</Text>
    <Text style={styles.title}>How do you want to start?</Text>
    <Text style={styles.subtitle}>Every path creates a private draft first. Imported and templated details stay reviewable before they touch the event.</Text>
    <View style={styles.list}>{options.map((option) => <Pressable key={option.title} style={styles.card} onPress={() => router.push(option.route as never)}>
      <View style={styles.icon}><Text style={styles.iconText}>{option.icon}</Text></View>
      <View style={{ flex: 1 }}><Text style={styles.cardTitle}>{option.title}</Text><Text style={styles.cardBody}>{option.body}</Text></View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>)}</View>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#0B100D' }, content: { padding: 20, paddingBottom: 60 }, back: { color: '#C8D1CB', fontSize: 12, fontWeight: '900', marginBottom: 18 }, eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }, title: { color: '#FFF8E8', fontSize: 34, lineHeight: 40, fontWeight: '900', marginTop: 4 }, subtitle: { color: '#9DA7A0', fontSize: 13, lineHeight: 20, marginTop: 7, marginBottom: 20 }, list: { gap: 10 }, card: { minHeight: 92, borderRadius: 17, borderWidth: 1, borderColor: '#334039', backgroundColor: '#151B17', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 13 }, icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#29351F', alignItems: 'center', justifyContent: 'center' }, iconText: { color: '#D7B45A', fontSize: 22, fontWeight: '900' }, cardTitle: { color: '#FFF8E8', fontSize: 16, fontWeight: '900' }, cardBody: { color: '#8E9992', fontSize: 11, lineHeight: 16, marginTop: 4 }, chevron: { color: '#D7B45A', fontSize: 28, fontWeight: '800' } });
