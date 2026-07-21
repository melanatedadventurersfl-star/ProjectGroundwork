import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getOrderConfirmation } from '../../../src/checkout/api';

export default function ConfirmationScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    getOrderConfirmation(orderId)
      .then(setOrder)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load confirmation.'));
  }, [orderId]);

  if (!order && !error) return <SafeAreaView style={styles.center}><ActivityIndicator /></SafeAreaView>;
  if (error) return <SafeAreaView style={styles.center}><Text style={styles.error}>{error}</Text></SafeAreaView>;

  const adventure = Array.isArray(order.adventures) ? order.adventures[0] : order.adventures;
  const credentials = order.ticket_credentials ?? [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>{order.status === 'paid' ? 'Confirmed' : 'Reservation held'}</Text>
        <Text style={styles.title}>{adventure?.title ?? 'Your adventure'}</Text>
        <Text style={styles.body}>
          {order.status === 'paid'
            ? 'Your registration is complete. Your credentials are ready below.'
            : 'Your registration details are saved. Live Stripe payment will finalize this order after the backend secret is configured.'}
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Order</Text>
          <Text style={styles.value}>{order.id}</Text>
          <Text style={styles.label}>Status</Text>
          <Text style={styles.value}>{String(order.status).replace('_', ' ')}</Text>
          <Text style={styles.label}>Total</Text>
          <Text style={styles.value}>${(order.total_cents / 100).toFixed(2)}</Text>
          {order.hold_expires_at ? <Text style={styles.notice}>Hold expires {new Date(order.hold_expires_at).toLocaleTimeString()}</Text> : null}
        </View>

        {credentials.length ? <Text style={styles.sectionTitle}>Entry credentials</Text> : null}
        {credentials.map((credential: any) => {
          const attendee = Array.isArray(credential.order_attendees) ? credential.order_attendees[0] : credential.order_attendees;
          return (
            <View key={credential.id} style={styles.credential}>
              <Text style={styles.cardTitle}>{attendee ? `${attendee.first_name} ${attendee.last_name}` : 'Attendee'}</Text>
              <Text style={styles.code}>{credential.credential_code}</Text>
              <Text style={styles.body}>This code is the payload used to generate the scannable QR credential.</Text>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0f1713' },
  center: { flex: 1, backgroundColor: '#0f1713', alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 22, paddingBottom: 48, gap: 14 },
  kicker: { color: '#d3a94f', textTransform: 'uppercase', fontWeight: '900', letterSpacing: 1 },
  title: { color: '#fff8e8', fontSize: 34, fontWeight: '900' },
  body: { color: '#c5cdc8', lineHeight: 23 },
  card: { backgroundColor: '#17211c', borderRadius: 16, padding: 18, gap: 5 },
  label: { color: '#d3a94f', textTransform: 'uppercase', fontSize: 12, fontWeight: '900', marginTop: 6 },
  value: { color: '#fff8e8', fontWeight: '700' },
  notice: { color: '#ffcf70', marginTop: 10 },
  sectionTitle: { color: '#fff8e8', fontSize: 22, fontWeight: '900', marginTop: 8 },
  credential: { backgroundColor: '#202d26', borderRadius: 18, padding: 18, gap: 8 },
  cardTitle: { color: '#fff8e8', fontSize: 18, fontWeight: '900' },
  code: { color: '#d3a94f', fontFamily: 'monospace', fontSize: 16 },
  error: { color: '#ffb4a9', textAlign: 'center' },
});