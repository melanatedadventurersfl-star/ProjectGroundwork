import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../src/auth/AuthProvider';
import { supabase } from '../src/lib/supabase';

export default function DeleteAccountScreen() {
  const { session, signOut } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submitDeletionRequest() {
    if (!session?.user.id || submitting) return;
    setSubmitting(true);
    setError('');

    const { error: requestError } = await supabase.functions.invoke('request-account-deletion', {
      body: {},
    });

    if (requestError) {
      setError(requestError.message);
      setSubmitting(false);
      return;
    }

    try {
      await signOut();
    } finally {
      router.replace('/');
    }
  }

  function confirmDeletion() {
    Alert.alert(
      'Request account deletion?',
      'Your request will be submitted and you will be signed out. Personal account data will be deleted or anonymized after review. Some transaction, waiver, safety, or legal records may need to be retained.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Request deletion', style: 'destructive', onPress: () => void submitDeletionRequest() },
      ],
    );
  }

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>ACCOUNT</Text>
    <Text style={styles.title}>Delete Account</Text>
    <Text style={styles.body}>You can request deletion of your Go Melanated account directly from the app.</Text>
    <View style={styles.card}>
      <Text style={styles.heading}>What happens next</Text>
      <Text style={styles.item}>• Your deletion request is recorded for review.</Text>
      <Text style={styles.item}>• You are signed out of this device after the request is submitted.</Text>
      <Text style={styles.item}>• Personal profile data that is no longer required will be deleted or anonymized.</Text>
      <Text style={styles.item}>• Transaction, waiver, safety, fraud-prevention, or legally required records may be retained for an appropriate period.</Text>
    </View>
    <Pressable style={styles.deleteButton} disabled={submitting} onPress={confirmDeletion}><Text style={styles.deleteText}>{submitting ? 'Submitting…' : 'Request Account Deletion'}</Text></Pressable>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Text style={styles.note}>If you only want to stop using the app temporarily, use Sign Out instead.</Text>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({safe:{flex:1,backgroundColor:'#0F1713'},content:{padding:20,paddingBottom:54},eyebrow:{color:'#D7B45A',fontWeight:'900',letterSpacing:1.1,fontSize:11},title:{color:'#FFF8E8',fontSize:34,fontWeight:'900',marginTop:4,marginBottom:12},body:{color:'#D6D9D3',fontSize:15,lineHeight:23,marginBottom:18},card:{backgroundColor:'#17211C',borderWidth:1,borderColor:'#26332C',borderRadius:16,padding:16,marginBottom:22},heading:{color:'#FFF8E8',fontSize:18,fontWeight:'800',marginBottom:10},item:{color:'#BCC5BE',fontSize:14,lineHeight:22,marginBottom:7},deleteButton:{backgroundColor:'#3A1E1B',borderWidth:1,borderColor:'#8D514A',borderRadius:14,paddingVertical:15,paddingHorizontal:16,alignItems:'center'},deleteText:{color:'#FFB4A9',fontSize:16,fontWeight:'900'},error:{color:'#FFB4A9',fontSize:13,lineHeight:19,marginTop:12},note:{color:'#7F8B83',fontSize:12,lineHeight:18,marginTop:12}});