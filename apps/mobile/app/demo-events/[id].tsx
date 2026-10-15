import { router, useLocalSearchParams } from 'expo-router';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getDemoCityEvent } from '../../src/discovery/demoCityEvents';

const PEOPLE_PHOTO = require('../../assets/onboarding/onboarding-people.jpg');

export default function DemoCityEventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = getDemoCityEvent(typeof id === 'string' ? id : '');
  const backToNights = () => router.push({ pathname: '/(tabs)/explore', params: { mode: 'night' } });

  if (!event) {
    return <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={styles.title}>Demo experience not found</Text>
        <Pressable accessibilityRole="button" onPress={backToNights} style={styles.button}>
          <Text style={styles.buttonLabel}>Explore Nights</Text>
        </Pressable>
      </View>
    </SafeAreaView>;
  }

  const when = new Date(event.startsAt).toLocaleString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>

      <ImageBackground source={PEOPLE_PHOTO} style={styles.hero} imageStyle={styles.heroImage}>
        <View style={styles.heroCaption}><Text style={styles.heroCaptionText}>GO MELANATED · NIGHTS</Text></View>
      </ImageBackground>

      <Text style={styles.demoLabel}>DEMO EXPERIENCE · NOT A LIVE EVENT</Text>
      <Text style={styles.title}>{event.title}</Text>
      <Text style={styles.category}>{event.category}</Text>
      <View style={styles.details}>
        <Text style={styles.detailLabel}>When</Text>
        <Text style={styles.detailText}>{when}</Text>
        <Text style={styles.detailLabel}>Where</Text>
        <Text style={styles.detailText}>{event.neighborhood}, Jacksonville, FL</Text>
        <Text style={styles.detailLabel}>Duration</Text>
        <Text style={styles.detailText}>{event.duration}</Text>
        <Text style={styles.detailLabel}>Example cost</Text>
        <Text style={styles.detailText}>{event.priceLabel}</Text>
      </View>

      <Text style={styles.sectionTitle}>The experience</Text>
      <Text style={styles.description}>{event.description}</Text>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Preview only</Text>
        <Text style={styles.noticeText}>This fictional event demonstrates how daytime and evening city experiences appear in Nights. The time and location are illustrative. No tickets, reservations, or RSVPs are available.</Text>
      </View>

      <Pressable accessibilityRole="button" onPress={backToNights} style={styles.button}>
        <Text style={styles.buttonLabel}>Explore more Nights experiences →</Text>
      </Pressable>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F3F9' },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 50, width: '100%', maxWidth: 720, alignSelf: 'center' },
  backButton: { alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center', marginBottom: 10 },
  back: { color: '#5F377F', fontSize: 15, fontWeight: '800' },
  hero: { width: '100%', aspectRatio: 16 / 9, marginBottom: 22, justifyContent: 'flex-end' },
  heroImage: { borderRadius: 20 },
  heroCaption: { backgroundColor: '#271A41DD', alignSelf: 'flex-start', marginLeft: 12, marginBottom: 12, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 15 },
  heroCaptionText: { color: '#FFFFFF', fontSize: 10, letterSpacing: 1, fontWeight: '900' },
  demoLabel: { color: '#7547A9', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#271A41', fontSize: 30, lineHeight: 36, fontWeight: '900', marginTop: 9 },
  category: { color: '#706680', marginTop: 5, marginBottom: 16, fontSize: 15 },
  details: { borderRadius: 20, padding: 18, backgroundColor: '#FFFFFF', gap: 5, borderColor: '#EBE5F0', borderWidth: 1 },
  detailLabel: { color: '#796B84', fontSize: 11, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 8 },
  detailText: { color: '#271A41', fontSize: 16, lineHeight: 23 },
  sectionTitle: { color: '#271A41', fontSize: 21, fontWeight: '900', marginTop: 23 },
  description: { color: '#4C4552', fontSize: 16, lineHeight: 25, marginTop: 9 },
  notice: { backgroundColor: '#EADFF3', borderRadius: 17, padding: 17, marginTop: 23 },
  noticeTitle: { color: '#4A276E', fontSize: 16, fontWeight: '900' },
  noticeText: { color: '#4E4159', fontSize: 14, lineHeight: 21, marginTop: 6 },
  button: { backgroundColor: '#271A41', borderRadius: 15, minHeight: 51, padding: 13, alignItems: 'center', justifyContent: 'center', marginTop: 23 },
  buttonLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
});
