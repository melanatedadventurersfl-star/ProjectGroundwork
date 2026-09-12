import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { supabase } from '../../src/lib/supabase';
import {
  createOrganizationJoinLink,
  listMyOrganizations,
  listOrganizationJoinLinks,
  revokeOrganizationJoinLink,
  type OrganizationJoinLink,
  type OrganizationJoinLinkSummary,
  type OrganizationWorkspace,
} from '../../src/platform/organizations';

const COLORS = {
  bg: '#0F1713',
  panel: '#17211C',
  raised: '#202B24',
  line: '#334239',
  cream: '#FFF8E8',
  muted: '#96A29B',
  dim: '#738079',
  gold: '#D7B45A',
  red: '#FFB4A9',
  green: '#9BE33D',
};

function dateLabel(value: string | null) {
  if (!value) return 'No expiration';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function deepLink(token: string) {
  return `melanatedadventurers://sign-up?org_invite=${encodeURIComponent(token)}`;
}

export default function OrganizationInvitesScreen() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<OrganizationWorkspace[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [links, setLinks] = useState<OrganizationJoinLinkSummary[]>([]);
  const [label, setLabel] = useState('Member signup link');
  const [expiresDays, setExpiresDays] = useState('30');
  const [limitUses, setLimitUses] = useState(false);
  const [maxUses, setMaxUses] = useState('25');
  const [creating, setCreating] = useState(false);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [created, setCreated] = useState<OrganizationJoinLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number | null>(null);

  const selectedOrganization = organizations.find((organization) => organization.id === organizationId) ?? null;

  const loadLinks = useCallback(async (targetId: string) => {
    if (!targetId) {
      setLinks([]);
      return;
    }

    setLoadingLinks(true);
    setError(null);
    try {
      setLinks(await listOrganizationJoinLinks(targetId));
    } catch (caught) {
      setLinks([]);
      setError(caught instanceof Error ? caught.message : 'Unable to load invitation links.');
    } finally {
      setLoadingLinks(false);
    }
  }, []);

  useEffect(() => {
    const updateClock = () => setCurrentTime(Date.now());
    updateClock();
    const timer = setInterval(updateClock, 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;

    void (async () => {
      const access = await supabase.rpc('is_platform_admin');
      if (!active) return;

      if (access.error) {
        setError(access.error.message);
        setLoading(false);
        return;
      }

      if (access.data !== true) {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      setAuthorized(true);
      try {
        const nextOrganizations = await listMyOrganizations();
        if (!active) return;

        const sorted = [...nextOrganizations].sort((a, b) => {
          if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
          if (a.isPlatformDefault !== b.isPlatformDefault) return a.isPlatformDefault ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

        setOrganizations(sorted);
        const initial = sorted.find((organization) => organization.isActive)
          ?? sorted.find((organization) => organization.isPlatformDefault)
          ?? sorted[0]
          ?? null;
        if (initial) setOrganizationId(initial.id);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Unable to load organizations.');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (authorized && organizationId) void loadLinks(organizationId);
  }, [authorized, loadLinks, organizationId]);

  const expiration = Number(expiresDays);
  const useLimit = Number(maxUses);
  const canCreate = useMemo(() => (
    Boolean(organizationId)
    && label.trim().length > 0
    && Number.isInteger(expiration)
    && expiration >= 1
    && expiration <= 365
    && (!limitUses || (Number.isInteger(useLimit) && useLimit >= 1))
    && !creating
  ), [creating, expiration, label, limitUses, organizationId, useLimit]);

  async function createLink() {
    if (!canCreate) return;

    setCreating(true);
    setCreated(null);
    setError(null);
    try {
      const next = await createOrganizationJoinLink({
        organizationId,
        label,
        expiresInDays: expiration,
        maxUses: limitUses ? useLimit : null,
      });
      setCreated(next);
      await loadLinks(organizationId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create invitation link.');
    } finally {
      setCreating(false);
    }
  }

  async function shareCreated() {
    if (!created) return;

    const url = deepLink(created.token);
    await Share.share({
      title: `Join ${created.organizationName}`,
      message: `You’re invited to join ${created.organizationName}. Open this link to create your account:\n${url}`,
      url,
    });
  }

  function confirmRevoke(link: OrganizationJoinLinkSummary) {
    Alert.alert(
      'Revoke invitation?',
      `${link.label} will stop working immediately. Existing members are not removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: () => void (async () => {
            try {
              await revokeOrganizationJoinLink(link.id);
              if (created?.id === link.id) setCreated(null);
              await loadLinks(organizationId);
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : 'Unable to revoke invitation link.');
            }
          })(),
        },
      ],
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!authorized) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>
          <View style={styles.deniedCard}>
            <Text style={styles.eyebrow}>PROTECTED AREA</Text>
            <Text style={styles.title}>Platform admin required</Text>
            <Text style={styles.help}>Organization invitation management is restricted to platform administrators.</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>PLATFORM ADMIN</Text>
          <Text style={styles.title}>Member Invitations</Text>
          <Text style={styles.subtitle}>
            Create tenant-aware signup links. The invitation puts a new account into the selected organization without enrolling it in Go Melanated.
          </Text>
        </View>

        {error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text></View> : null}

        <Text style={styles.sectionLabel}>ORGANIZATION</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.orgRow}>
          {organizations.map((organization) => {
            const selected = organization.id === organizationId;
            return (
              <Pressable
                key={organization.id}
                style={[styles.orgChip, selected && styles.orgChipActive]}
                onPress={() => {
                  setOrganizationId(organization.id);
                  setCreated(null);
                }}
              >
                <Text style={[styles.orgName, selected && styles.orgNameActive]}>{organization.name}</Text>
                <Text style={styles.orgMeta}>{organization.kind}{organization.isActive ? ' · active workspace' : ''}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.sectionLabel}>CREATE INVITATION</Text>
        <View style={styles.panel}>
          <Field label="Label" help="Internal name so you know where the link was shared.">
            <TextInput
              value={label}
              onChangeText={setLabel}
              editable={!creating}
              placeholder="September tester invite"
              placeholderTextColor={COLORS.dim}
              style={styles.input}
            />
          </Field>

          <Field label="Expires after" help="1 to 365 days.">
            <TextInput
              value={expiresDays}
              onChangeText={setExpiresDays}
              editable={!creating}
              keyboardType="number-pad"
              placeholder="30"
              placeholderTextColor={COLORS.dim}
              style={styles.input}
            />
          </Field>

          <View style={styles.toggleRow}>
            <View style={styles.flex}>
              <Text style={styles.fieldLabel}>Limit number of signups</Text>
              <Text style={styles.fieldHelp}>Turn this on for small testing groups or controlled launches.</Text>
            </View>
            <Switch
              value={limitUses}
              disabled={creating}
              onValueChange={setLimitUses}
              trackColor={{ false: '#354139', true: '#6B5A2F' }}
              thumbColor={limitUses ? COLORS.gold : '#A0AAA4'}
            />
          </View>

          {limitUses ? (
            <Field label="Maximum signups">
              <TextInput
                value={maxUses}
                onChangeText={setMaxUses}
                editable={!creating}
                keyboardType="number-pad"
                placeholder="25"
                placeholderTextColor={COLORS.dim}
                style={styles.input}
              />
            </Field>
          ) : null}

          <Pressable
            disabled={!canCreate}
            style={[styles.primaryButton, !canCreate && styles.buttonDisabled]}
            onPress={() => void createLink()}
          >
            {creating ? <ActivityIndicator color="#111813" size="small" /> : null}
            <Text style={styles.primaryButtonText}>
              {creating ? 'Creating…' : `Create ${selectedOrganization?.name ?? 'Organization'} Invite`}
            </Text>
          </Pressable>
        </View>

        {created ? (
          <View style={styles.createdCard}>
            <Text style={styles.successEyebrow}>NEW INVITATION READY</Text>
            <Text style={styles.createdTitle}>{created.label}</Text>
            <Text style={styles.help}>The raw token is shown only for this newly created link. Existing links cannot reveal it again.</Text>
            <View style={styles.linkBox}>
              <Text selectable style={styles.linkText}>{deepLink(created.token)}</Text>
            </View>
            <View style={styles.createdActions}>
              <Pressable style={styles.shareButton} onPress={() => void shareCreated()}>
                <Text style={styles.shareButtonText}>Share Invite</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => setCreated(null)}>
                <Text style={styles.secondaryButtonText}>Hide Token</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>EXISTING INVITATIONS</Text>
        {loadingLinks ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={COLORS.gold} />
            <Text style={styles.help}>Loading invitations…</Text>
          </View>
        ) : null}

        {!loadingLinks && links.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No invitation links yet</Text>
            <Text style={styles.help}>Create one above. The actual token is never recoverable from an existing record.</Text>
          </View>
        ) : null}

        <View style={styles.linkList}>
          {links.map((link) => {
            const expiryTime = link.expiresAt ? new Date(link.expiresAt).valueOf() : null;
            const expired = Boolean(currentTime != null && expiryTime != null && expiryTime <= currentTime);
            const exhausted = link.maxUses != null && link.useCount >= link.maxUses;
            const usable = link.status === 'active' && !expired && !exhausted;
            const statusLabel = usable
              ? 'ACTIVE'
              : link.status === 'revoked'
                ? 'REVOKED'
                : expired
                  ? 'EXPIRED'
                  : 'USED';

            return (
              <View key={link.id} style={styles.linkCard}>
                <View style={styles.linkHeader}>
                  <View style={styles.flex}>
                    <Text style={styles.linkTitle}>{link.label}</Text>
                    <Text style={styles.linkMeta}>Created {dateLabel(link.createdAt)}</Text>
                  </View>
                  <View style={[styles.statusPill, usable ? styles.statusActive : styles.statusInactive]}>
                    <Text style={[styles.statusText, usable ? styles.statusActiveText : styles.statusInactiveText]}>{statusLabel}</Text>
                  </View>
                </View>

                <View style={styles.metrics}>
                  <Metric label="Uses" value={`${link.useCount}${link.maxUses == null ? '' : ` / ${link.maxUses}`}`} />
                  <Metric label="Expires" value={dateLabel(link.expiresAt)} />
                  <Metric label="Last used" value={link.lastUsedAt ? dateLabel(link.lastUsedAt) : 'Never'} />
                </View>

                {usable ? (
                  <Pressable style={styles.revokeButton} onPress={() => confirmRevoke(link)}>
                    <Text style={styles.revokeText}>Revoke link</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>

        <View style={styles.guardrail}>
          <Text style={styles.guardrailTitle}>Security behavior</Text>
          <Text style={styles.help}>
            Invite tokens grant only the Member role. Revoking a link does not remove people who already joined. Create a new link if you need a new shareable token.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {help ? <Text style={styles.fieldHelp}>{help}</Text> : null}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: 20, paddingBottom: 80 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  back: { color: COLORS.gold, fontSize: 16, fontWeight: '800', paddingVertical: 8 },
  header: { marginTop: 12, marginBottom: 18, gap: 4 },
  eyebrow: { color: COLORS.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: COLORS.cream, fontSize: 32, lineHeight: 38, fontWeight: '900' },
  subtitle: { color: COLORS.muted, fontSize: 13, lineHeight: 19, maxWidth: 650 },
  sectionLabel: { color: COLORS.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginTop: 18, marginBottom: 8 },
  orgRow: { gap: 8, paddingRight: 20 },
  orgChip: { minWidth: 155, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.panel, paddingHorizontal: 13, paddingVertical: 10 },
  orgChipActive: { borderColor: COLORS.gold, backgroundColor: '#2A2518' },
  orgName: { color: COLORS.cream, fontSize: 11, fontWeight: '900' },
  orgNameActive: { color: COLORS.gold },
  orgMeta: { color: COLORS.dim, fontSize: 9, marginTop: 3 },
  panel: { borderRadius: 16, padding: 14, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, gap: 14 },
  field: { gap: 6 },
  fieldLabel: { color: COLORS.cream, fontSize: 11, fontWeight: '900' },
  fieldHelp: { color: COLORS.dim, fontSize: 9.5, lineHeight: 14 },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#3B4A41', backgroundColor: COLORS.raised, color: COLORS.cream, paddingHorizontal: 12, fontSize: 12 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  primaryButton: { minHeight: 50, borderRadius: 13, backgroundColor: COLORS.gold, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 2 },
  primaryButtonText: { color: '#111813', fontSize: 11.5, fontWeight: '900' },
  buttonDisabled: { opacity: 0.42 },
  createdCard: { borderRadius: 16, padding: 14, backgroundColor: '#16241A', borderWidth: 1, borderColor: '#365F41', gap: 7, marginTop: 18 },
  successEyebrow: { color: COLORS.green, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  createdTitle: { color: COLORS.cream, fontSize: 17, fontWeight: '900' },
  linkBox: { borderRadius: 12, padding: 11, backgroundColor: '#0C130F', borderWidth: 1, borderColor: '#334239' },
  linkText: { color: '#D9E3DC', fontSize: 10.5, lineHeight: 16 },
  createdActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  shareButton: { minHeight: 40, paddingHorizontal: 14, borderRadius: 11, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center' },
  shareButtonText: { color: '#111813', fontSize: 10.5, fontWeight: '900' },
  secondaryButton: { minHeight: 40, paddingHorizontal: 14, borderRadius: 11, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.raised, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: COLORS.cream, fontSize: 10.5, fontWeight: '800' },
  loadingBox: { minHeight: 64, borderRadius: 14, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center', gap: 7 },
  emptyCard: { borderRadius: 14, padding: 14, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, gap: 4 },
  emptyTitle: { color: COLORS.cream, fontSize: 12, fontWeight: '900' },
  linkList: { gap: 10 },
  linkCard: { borderRadius: 16, padding: 14, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, gap: 12 },
  linkHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  linkTitle: { color: COLORS.cream, fontSize: 13, fontWeight: '900' },
  linkMeta: { color: COLORS.dim, fontSize: 9.5, marginTop: 3 },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  statusActive: { backgroundColor: '#26351D' },
  statusInactive: { backgroundColor: '#302321' },
  statusText: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.5 },
  statusActiveText: { color: COLORS.green },
  statusInactiveText: { color: '#E8A89E' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { minWidth: 120, flexGrow: 1, borderRadius: 11, padding: 10, backgroundColor: COLORS.raised },
  metricLabel: { color: COLORS.dim, fontSize: 8.5, fontWeight: '800', letterSpacing: 0.4 },
  metricValue: { color: COLORS.cream, fontSize: 10.5, fontWeight: '800', marginTop: 3 },
  revokeButton: { alignSelf: 'flex-start', minHeight: 36, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#6A3A37', alignItems: 'center', justifyContent: 'center' },
  revokeText: { color: COLORS.red, fontSize: 10, fontWeight: '900' },
  guardrail: { marginTop: 18, borderRadius: 14, padding: 13, backgroundColor: '#161C18', borderWidth: 1, borderColor: '#485349', gap: 4 },
  guardrailTitle: { color: COLORS.cream, fontSize: 11, fontWeight: '900' },
  help: { color: COLORS.muted, fontSize: 10.5, lineHeight: 15 },
  errorCard: { borderRadius: 13, padding: 12, backgroundColor: '#241817', borderWidth: 1, borderColor: '#6A3A37', marginBottom: 10 },
  error: { color: COLORS.red, fontSize: 10.5, lineHeight: 15 },
  deniedCard: { marginTop: 30, borderRadius: 18, padding: 18, backgroundColor: '#211817', borderWidth: 1, borderColor: '#523B35', gap: 7 },
});
