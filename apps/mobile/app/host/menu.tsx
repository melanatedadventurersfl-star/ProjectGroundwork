import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

export default function HostMenuScreen() {
  useEffect(() => {
    router.replace('/host/more' as never);
  }, []);

  return <View style={{ flex: 1, backgroundColor: '#0B100D' }} />;
}
