import Ionicons from '@react-native-vector-icons/ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { getGroups } from './api';
import { resolveOutpostCreateActions, type OutpostCreateAction } from './dynamicCreate';

const GOLD = '#D7B45A';
const BG = '#0F1713';
const SURFACE = '#18221D';
const BORDER = '#334238';
const TEXT = '#FFF8E8';
const MUTED = '#AEB8B2';
const GREEN = '#12372E';

type CreateStatus = {
  joinedCommunityCount: number;
  isHost: boolean;
  isAdmin: boolean;
};

const EMPTY_STATUS: CreateStatus = {
  joinedCommunityCount: 0,
  isHost: false,
  isAdmin: false,
};

function normalizedRole(value?: string | null) {
  return value?.trim().toLowerCase() ?? '';
}

export function DynamicCreateButton() {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<CreateStatus>(EMPTY_STATUS);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!session?.user.id) {
      setStatus(EMPTY_STATUS);
      setReady(true);
      return;
    }

    const userId = session.user.id;

    const groupsPromise = getGroups().catch(() => []);
    const profilePromise = (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('platform_role,event_host_level')
        .eq('id', userId)
        .maybeSingle();
      return data as { platform_role?: string | null; event_host_level?: string | null } | null;
    })().catch(() => null);
    const adminPromise = (async () => {
      const { data } = await supabase.rpc('is_platform_admin');
      return data === true;
    })().catch(() => false);

    const [groups, profile, rpcAdmin] = await Promise.all([groupsPromise, profilePromise, adminPromise]);
    const role = normalizedRole(profile?.platform_role);
    const isAdmin = rpcAdmin || role === 'admin' || role === 'founder';
    const isHost = isAdmin || role === 'host' || Boolean(profile?.event_host_level);

    setStatus({
      joinedCommunityCount: groups.filter((group) => group.is_member).length,
      isHost,
      isAdmin,
    });
    setReady(true);
  }, [session?.user.id]);

  useFocusEffect(useCallback(() => {
    setReady(false);
    void load();
  }, [load]));

  const actions = useMemo(() => resolveOutpostCreateActions(status), [status]);

  function navigate(action: OutpostCreateAction) {
    setOpen(false);
    router.push(action.route as any);
  }

  function pressFab() {
    const firstAction = actions[0];
    if (actions.length === 1 && firstAction) {
      navigate(firstAction);
      return;
    }
    if (actions.length > 1) setOpen(true);
  }

  if (!ready || actions.length === 0) return null;

  const nativeBottom = insets.bottom + 78;
  const webBottom = Math.max(insets.bottom + 24, 24);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create"
        onPress={pressFab}
        style={({ pressed }) => [
          styles.fab,
          { bottom: Platform.OS === 'web' ? webBottom : nativeBottom },
          pressed && styles.fabPressed,
        ]}
      >
        <Ionicons name="add" size={31} color={GREEN} />
      </Pressable>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close create menu" style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) + 12 }]}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <View style={styles.flex}>
                <Text style={styles.eyebrow}>CREATE</Text>
                <Text style={styles.sheetTitle}>What do you want to add?</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setOpen(false)} style={styles.closeButton}>
                <Ionicons name="close" size={22} color={TEXT} />
              </Pressable>
            </View>

            <View style={styles.actionList}>
              {actions.map((action) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  key={action.id}
                  onPress={() => navigate(action)}
                  style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
                >
                  <View style={styles.actionIcon}>
                    <Ionicons name={action.icon as any} size={21} color={GOLD} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.actionLabel}>{action.label}</Text>
                    <Text style={styles.actionHelper}>{action.helper}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={19} color={MUTED} />
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fab: {
    position: 'absolute',
    right: 18,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GOLD,
    borderWidth: 1,
    borderColor: '#E8CA77',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 9,
    zIndex: 30,
  },
  fabPressed: { transform: [{ scale: 0.96 }], opacity: 0.92 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.58)' },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: BORDER,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  handle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#526158', marginBottom: 13 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  eyebrow: { color: GOLD, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  sheetTitle: { color: TEXT, fontSize: 21, fontWeight: '900', marginTop: 3 },
  closeButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: SURFACE },
  actionList: { gap: 9 },
  actionRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 11 },
  actionRowPressed: { opacity: 0.78 },
  actionIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#253128' },
  actionLabel: { color: TEXT, fontSize: 15, fontWeight: '900' },
  actionHelper: { color: MUTED, fontSize: 12, lineHeight: 17, marginTop: 2 },
});
