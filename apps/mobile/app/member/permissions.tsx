import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon, type AppIconName } from '../../src/ui/AppIcon';

type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unavailable';
type PermissionKey = 'notifications' | 'location' | 'contacts' | 'camera' | 'photos';
type PermissionResult = { status?: string; canAskAgain?: boolean };

type PermissionRow = {
  key: PermissionKey;
  label: string;
  description: string;
  icon: AppIconName;
  state: PermissionState;
  canAskAgain: boolean;
};

const permissionMeta: Record<PermissionKey, Pick<PermissionRow, 'label' | 'description' | 'icon'>> = {
  notifications: {
    label: 'Notifications',
    description: 'Adventure updates, reminders, confirmations, and important account alerts.',
    icon: 'notifications',
  },
  location: {
    label: 'Location',
    description: 'Nearby trails, local weather, distance-aware discovery, and location-based suggestions.',
    icon: 'location',
  },
  contacts: {
    label: 'Contacts',
    description: 'Find people you already know when you choose to connect your contacts.',
    icon: 'connections',
  },
  camera: {
    label: 'Camera',
    description: 'Take profile, adventure, and community photos from inside Go Melanated.',
    icon: 'camera',
  },
  photos: {
    label: 'Photos',
    description: 'Choose existing images for your profile, posts, and adventure memories.',
    icon: 'photos',
  },
};

function normalizeStatus(status?: string): PermissionState {
  if (status === 'granted' || status === 'denied' || status === 'undetermined') return status;
  return 'unavailable';
}

function statusLabel(state: PermissionState) {
  if (state === 'granted') return 'Allowed';
  if (state === 'denied') return 'Not allowed';
  if (state === 'undetermined') return 'Not requested';
  return 'Unavailable';
}

async function readPermission(key: PermissionKey): Promise<PermissionResult> {
  try {
    if (key === 'notifications') {
      const Notifications = await import('expo-notifications');
      return await Notifications.getPermissionsAsync();
    }
    if (key === 'location') {
      const Location = await import('expo-location');
      return await Location.getForegroundPermissionsAsync();
    }
    if (key === 'contacts') {
      const Contacts = await import('expo-contacts');
      return await Contacts.getPermissionsAsync();
    }
    const ImagePicker = await import('expo-image-picker');
    return key === 'camera'
      ? await ImagePicker.getCameraPermissionsAsync()
      : await ImagePicker.getMediaLibraryPermissionsAsync();
  } catch (caught) {
    console.warn(`Permission module unavailable for ${key}`, caught);
    return { status: 'unavailable', canAskAgain: false };
  }
}

async function askPermission(key: PermissionKey) {
  if (key === 'notifications') {
    const Notifications = await import('expo-notifications');
    return Notifications.requestPermissionsAsync();
  }
  if (key === 'location') {
    const Location = await import('expo-location');
    return Location.requestForegroundPermissionsAsync();
  }
  if (key === 'contacts') {
    const Contacts = await import('expo-contacts');
    return Contacts.requestPermissionsAsync();
  }
  const ImagePicker = await import('expo-image-picker');
  return key === 'camera'
    ? ImagePicker.requestCameraPermissionsAsync()
    : ImagePicker.requestMediaLibraryPermissionsAsync();
}

export default function AppPermissionsScreen() {
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState<PermissionKey | null>(null);
  const [error, setError] = useState('');

  const loadPermissions = useCallback(async () => {
    setError('');
    try {
      const keys = Object.keys(permissionMeta) as PermissionKey[];
      const results = await Promise.all(keys.map(readPermission));
      setPermissions(keys.map((key, index) => {
        const result = results[index] ?? { status: 'unavailable', canAskAgain: false };
        return {
          key,
          ...permissionMeta[key],
          state: normalizeStatus(result.status),
          canAskAgain: result.canAskAgain !== false,
        };
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to read device permissions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPermissions();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void loadPermissions();
    });
    return () => subscription.remove();
  }, [loadPermissions]);

  async function requestPermission(key: PermissionKey) {
    const row = permissions.find((item) => item.key === key);
    if (!row) return;

    if (row.state === 'granted' || row.state === 'unavailable' || !row.canAskAgain) {
      await Linking.openSettings();
      return;
    }

    setRequesting(key);
    setError('');
    try {
      await askPermission(key);
      await loadPermissions();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Unable to update ${row.label.toLowerCase()} permission.`);
    } finally {
      setRequesting(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={10}>
          <AppIcon name="chevron-back" color="#F5C341" size={25} />
          <Text style={styles.backText}>Menu</Text>
        </Pressable>

        <Text style={styles.eyebrow}>DEVICE ACCESS</Text>
        <Text style={styles.title}>App Permissions</Text>
        <Text style={styles.intro}>
          See what Go Melanated can access on this device. Permission status is read directly from your phone and refreshes when you return from system settings.
        </Text>

        {loading ? <ActivityIndicator color="#F5C341" style={styles.loader} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!loading ? <View style={styles.card}>
          {permissions.map((permission, index) => {
            const isGranted = permission.state === 'granted';
            const actionLabel = isGranted || permission.state === 'unavailable' || !permission.canAskAgain ? 'Manage' : 'Allow';
            return (
              <View key={permission.key} style={[styles.row, index > 0 && styles.divider]}>
                <View style={styles.iconWrap}>
                  <AppIcon name={permission.icon} color={isGranted ? '#F5C341' : '#B6C0B9'} size={21} />
                </View>
                <View style={styles.copy}>
                  <View style={styles.labelRow}>
                    <Text style={styles.rowTitle}>{permission.label}</Text>
                    <View style={[styles.statusPill, isGranted && styles.statusPillGranted]}>
                      <Text style={[styles.statusText, isGranted && styles.statusTextGranted]}>{statusLabel(permission.state)}</Text>
                    </View>
                  </View>
                  <Text style={styles.rowDescription}>{permission.description}</Text>
                </View>
                <Pressable
                  disabled={requesting === permission.key}
                  onPress={() => void requestPermission(permission.key)}
                  style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
                >
                  {requesting === permission.key
                    ? <ActivityIndicator size="small" color="#F5C341" />
                    : <Text style={styles.actionText}>{actionLabel}</Text>}
                </Pressable>
              </View>
            );
          })}
        </View> : null}

        <View style={styles.noteCard}>
          <AppIcon name="privacy" color="#D7B45A" size={20} />
          <Text style={styles.noteText}>
            If this installed build does not contain a newer native permission module, that permission will show as unavailable instead of preventing the app from starting.
          </Text>
        </View>

        <Pressable style={styles.settingsButton} onPress={() => void Linking.openSettings()}>
          <Text style={styles.settingsButtonText}>Open Device Settings</Text>
          <AppIcon name="chevron-forward" color="#F5C341" size={20} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F1713' },
  content: { padding: 20, paddingBottom: 70 },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 16 },
  backText: { color: '#F5C341', fontWeight: '800' },
  eyebrow: { color: '#D7B45A', fontSize: 11, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#FFF8E8', fontSize: 31, lineHeight: 36, fontWeight: '900', marginTop: 4 },
  intro: { color: '#96A39B', fontSize: 13, lineHeight: 19, marginTop: 8, marginBottom: 18 },
  loader: { marginVertical: 24 },
  error: { color: '#FFB4A9', backgroundColor: '#301A18', borderRadius: 12, padding: 11, marginBottom: 12 },
  card: { backgroundColor: '#17211C', borderWidth: 1, borderColor: '#28362E', borderRadius: 18, overflow: 'hidden' },
  row: { minHeight: 104, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#344139' },
  iconWrap: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#202D26', alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  labelRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  rowTitle: { color: '#FFF8E8', fontSize: 15, fontWeight: '800' },
  rowDescription: { color: '#8F9B93', fontSize: 11.5, lineHeight: 16, marginTop: 4 },
  statusPill: { backgroundColor: '#2C332F', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  statusPillGranted: { backgroundColor: '#3C341C' },
  statusText: { color: '#AEB8B1', fontSize: 9.5, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 },
  statusTextGranted: { color: '#F0D083' },
  action: { minWidth: 61, minHeight: 38, borderRadius: 11, borderWidth: 1, borderColor: '#665628', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  actionPressed: { opacity: 0.72 },
  actionText: { color: '#F5C341', fontSize: 12, fontWeight: '900' },
  noteCard: { flexDirection: 'row', gap: 10, backgroundColor: '#131D18', borderWidth: 1, borderColor: '#28362E', borderRadius: 15, padding: 14, marginTop: 14 },
  noteText: { color: '#8F9B93', flex: 1, fontSize: 11.5, lineHeight: 17 },
  settingsButton: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, borderWidth: 1, borderColor: '#665628', paddingHorizontal: 15, marginTop: 14 },
  settingsButtonText: { color: '#FFF8E8', fontSize: 14, fontWeight: '800' },
});
