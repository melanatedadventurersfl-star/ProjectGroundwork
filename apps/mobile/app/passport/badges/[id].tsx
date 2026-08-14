import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BadgeArt, hasBadgeArt } from '../../../src/passport/BadgeArt';
import { supabase } from '../../../src/lib/supabase';

type BadgeDetail = {
  id: string;
  earned_at: string;
  badges: {
    title: string;
    description: string | null;
    category: string;
  } | null;
};

export default function BadgeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [badge, setBadge] = useState<BadgeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const { data, error: readError } = await supabase
          .from('member_badges')
          .select('id, earned_at, badges(title, description, category)')
          .eq('id', id)
          .single();
        if (readError) throw readError;
        if (mounted) setBadge(data as unknown as BadgeDetail);
      } catch (caught) {
        if (mounted) setError(caught instanceof Error ? caught.message : 'Unable to load badge.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  if (loading) {
    return <SafeAreaView style={styles.center}><ActivityIndicator color="#D7B45A" /></SafeAreaView>;
  }

  const title = badge?.badges?.title ?? 'Achievement Badge';

  return (
    <SafeAreaView style={styles.safe}>
      <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹ Passport</Text></Pressable>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>ACHIEVEMENT BADGE</Text>
        <View style={styles.art}>
          {hasBadgeArt(title) ? (
            <BadgeArt title={title} size={190} />
          ) : (
            <View style={styles.fallback}><Text style={styles.fallbackText}>★</Text></View>
          )}
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.category}>{badge?.badges?.category ?? 'milestone'}</Text>
        {badge ? (
          <Text style={styles.earned}>Earned {new Date(badge.earned_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
        ) : null}
        <View style={styles.divider} />
        <Text style={styles.description}>{badge?.badges?.description || 'A mark of progress on your Melanated Adventurers journey.'}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D1612', padding: 18 },
  center: { flex: 1, backgroundColor: '#0D1612', alignItems: 'center', justifyContent: 'center' },
  back: { alignSelf: 'flex-start', paddingVertical: 10 },
  backText: { color: '#35D4C8', fontWeight: '900' },
  card: { marginTop: 8, borderRadius: 26, backgroundColor: '#17231D', borderWidth: 1, borderColor: '#3B4A42', padding: 22, alignItems: 'center' },
  eyebrow: { color: '#D7B45A', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  art: { height: 214, alignItems: 'center', justifyContent: 'center' },
  fallback: { width: 160, height: 160, borderRadius: 34, borderWidth: 3, borderColor: '#D7B45A', backgroundColor: '#2B2618', alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: '#D7B45A', fontSize: 52 },
  title: { color: '#FFF8E8', fontSize: 27, fontWeight: '900', textAlign: 'center' },
  category: { color: '#35D4C8', textTransform: 'uppercase', fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 7 },
  earned: { color: '#C7B77F', fontSize: 12, fontWeight: '800', marginTop: 10 },
  divider: { height: 1, backgroundColor: '#3A4840', alignSelf: 'stretch', marginVertical: 20 },
  description: { color: '#9AA79F', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  error: { color: '#FFB4A9', marginTop: 16 },
});
