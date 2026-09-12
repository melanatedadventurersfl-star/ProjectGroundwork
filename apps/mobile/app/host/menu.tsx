import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HOST_WORKSPACE_GROUPS, HOST_WORKSPACE_ITEMS } from '../../src/hosting/hostWorkspace';
import { supabase } from '../../src/lib/supabase';
import {
  activatePlatformDefaultOrganization,
  getOrganizationPublicBusiness,
  listMyOrganizations,
  organizationRoleLabel,
  setActiveOrganization,
  type OrganizationPublicBusiness,
  type OrganizationWorkspace,
} from '../../src/platform/organizations';
import { AppIcon } from '../../src/ui/AppIcon';
import { getVendorAccess } from '../../src/vendor/vendorAccess';

const COLORS = { bg: '#0B100D', panel: '#151B17', raised: '#1B231E', line: '#2E3832', cream: '#FFF8E8', muted: '#95A29A', dim: '#6F7D75', gold: '#D7B45A', green: '#7CCB92' };

export default function HostMenuScreen() {
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [vendorApproved, setVendorApproved] = useState(false);
  const [organizations, setOrganizations] = useState<OrganizationWorkspace[]>([]);
  const [organizationsLoading, setOrganizationsLoading] = useState(true);
  const [organizationError, setOrganizationError] = useState<string | null>(null);
  const [switchingOrganizationId, setSwitchingOrganizationId] = useState<string | null>(null);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [publicBusiness, setPublicBusiness] = useState<OrganizationPublicBusiness | null>(null);
  const [publicBusinessLoading, setPublicBusinessLoading] = useState(false);

  const activeOrganization = organizations.find((organization) => organization.isActive)
    ?? organizations.find((organization) => organization.isPlatformDefault)
    ?? organizations[0]
    ?? null;

  useEffect(() => {
    let active = true;
    void Promise.all([
      supabase.rpc('is_platform_admin'),
      getVendorAccess().catch(() => ({ approved: false, record: null })),
      listMyOrganizations(),
      supabase.auth.getUser(),
    ]).then(([adminResult, vendorAccess, organizationRows, authResult]) => {
      if (!active) return;
      setIsPlatformAdmin(!adminResult.error && adminResult.data === true);
      setVendorApproved(vendorAccess.approved);
      setOrganizations(organizationRows);
      setCurrentProfileId(authResult.data.user?.id ?? null);
      setOrganizationError(null);
    }).catch((caught) => {
      if (!active) return;
      setOrganizationError(caught instanceof Error ? caught.message : 'Unable to load organization access.');
    }).finally(() => {
      if (active) setOrganizationsLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!activeOrganization) {
      setPublicBusiness(null);
      return () => { active = false; };
    }
    setPublicBusinessLoading(true);
    void getOrganizationPublicBusiness(activeOrganization.id).then((business) => {
      if (active) setPublicBusiness(business);
    }).catch(() => {
      if (active) setPublicBusiness(null);
    }).finally(() => {
      if (active) setPublicBusinessLoading(false);
    });
    return () => { active = false; };
  }, [activeOrganization?.id]);

  async function switchOrganization(organization: OrganizationWorkspace) {
    if (organization.isActive || switchingOrganizationId) return;
    setSwitchingOrganizationId(organization.id);
    setOrganizationError(null);
    try {
      await setActiveOrganization(organization.id);
      setOrganizations((current) => current.map((item) => ({
        ...item,
        isActive: item.id === organization.id,
      })));
    } catch (caught) {
      setOrganizationError(caught instanceof Error ? caught.message : 'Unable to switch organization.');
    } finally {
      setSwitchingOrganizationId(null);
    }
  }

  async function openAsProfile() {
    if (!activeOrganization || !currentProfileId || switchingOrganizationId) return;
    setSwitchingOrganizationId('profile-preview');
    setOrganizationError(null);
    try {
      if (activeOrganization.isPlatformDefault) {
        await activatePlatformDefaultOrganization();
        router.push('/member/profile' as never);
      } else {
        router.push({
          pathname: '/organization-member-profile/[id]',
          params: { id: currentProfileId, organizationId: activeOrganization.id },
        });
      }
    } catch (caught) {
      setOrganizationError(caught instanceof Error ? caught.message : 'Unable to open your public profile.');
    } finally {
      setSwitchingOrganizationId(null);
    }
  }

  function openAsBusiness() {
    if (!activeOrganization || publicBusinessLoading || switchingOrganizationId) return;
    if (publicBusiness) {
      router.push({ pathname: '/organization-profile/[slug]', params: { slug: publicBusiness.slug } });
      return;
    }
    router.push({ pathname: '/organization-business-preview/[id]', params: { id: activeOrganization.id } });
  }

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topbar}>
        <View>
          <Text style={styles.eyebrow}>{activeOrganization?.name.toUpperCase() ?? 'ORGANIZATION WORKSPACE'}</Text>
          <Text style={styles.title}>Host Center</Text>
          <Text style={styles.subtitle}>Events and organization operations in one workspace.</Text>
        </View>
        <Pressable accessibilityLabel="Close Host Center menu" style={styles.close} onPress={() => router.back()}><AppIcon name="close" color={COLORS.cream} size={24} /></Pressable>
      </View>

      <Pressable style={styles.overview} onPress={() => router.replace('/host' as never)}>
        <View style={styles.icon}><AppIcon name="dashboard" color={COLORS.gold} size={21} /></View>
        <View style={{ flex: 1 }}><Text style={styles.itemTitle}>Overview</Text><Text style={styles.itemSubtitle}>Active events, work, alerts and business activity</Text></View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Text style={styles.sectionLabel}>ORGANIZATION</Text>
      <View style={styles.organizationCard}>
        {organizationsLoading ? <View style={styles.organizationLoading}><ActivityIndicator color={COLORS.gold} size="small" /><Text style={styles.organizationLoadingText}>Loading organization access…</Text></View> : null}
        {!organizationsLoading && organizations.length === 0 ? <View style={styles.organizationLoading}><Text style={styles.organizationLoadingText}>No organization workspace is available yet.</Text></View> : null}
        {organizations.map((organization, index) => {
          const roleText = organization.roles.slice(0, 2).map(organizationRoleLabel).join(' · ');
          const isSwitching = switchingOrganizationId === organization.id;
          return <Pressable
            key={organization.id}
            accessibilityRole="button"
            accessibilityLabel={`${organization.name}${organization.isActive ? ', active organization' : ', switch organization'}`}
            disabled={organization.isActive || switchingOrganizationId !== null}
            style={[styles.organizationRow, index > 0 && styles.divider, organization.isActive && styles.organizationRowActive]}
            onPress={() => void switchOrganization(organization)}
          >
            <View style={[styles.organizationMark, organization.isActive && styles.organizationMarkActive]}><Text style={styles.organizationMarkText}>{organization.name.slice(0, 1).toUpperCase()}</Text></View>
            <View style={styles.flex}>
              <View style={styles.organizationTitleRow}>
                <Text style={styles.organizationTitle}>{organization.name}</Text>
                {organization.isActive ? <Text style={styles.activePill}>ACTIVE</Text> : null}
              </View>
              <Text style={styles.organizationMeta}>{roleText || 'Organization member'}</Text>
            </View>
            {isSwitching ? <ActivityIndicator color={COLORS.gold} size="small" /> : organization.isActive ? <Text style={styles.activeCheck}>✓</Text> : <Text style={styles.chevron}>›</Text>}
          </Pressable>;
        })}
      </View>
      {organizationError ? <Text style={styles.organizationError}>{organizationError}</Text> : null}

      <Text style={styles.sectionLabel}>VIEW PUBLIC EXPERIENCE</Text>
      <View style={styles.publicViewCard}>
        <Pressable disabled={!activeOrganization || !currentProfileId || switchingOrganizationId !== null} style={styles.publicViewRow} onPress={() => void openAsProfile()}>
          <View style={styles.publicViewIcon}><AppIcon name="profile" color={COLORS.gold} size={20} /></View>
          <View style={styles.flex}><Text style={styles.workspaceTitle}>Open as Profile</Text><Text style={styles.publicViewText}>View your personal profile in {activeOrganization?.name ?? 'this organization'}.</Text></View>
          {switchingOrganizationId === 'profile-preview' ? <ActivityIndicator color={COLORS.gold} size="small" /> : <Text style={styles.chevron}>›</Text>}
        </Pressable>
        <Pressable disabled={!activeOrganization || publicBusinessLoading || switchingOrganizationId !== null} style={[styles.publicViewRow, styles.divider]} onPress={openAsBusiness}>
          <View style={styles.publicViewIcon}><AppIcon name="storefront" color={COLORS.gold} size={20} /></View>
          <View style={styles.flex}><Text style={styles.workspaceTitle}>Open as Business</Text><Text style={styles.publicViewText}>{publicBusiness ? `View ${publicBusiness.name}'s public organization page.` : publicBusinessLoading ? 'Finding this organization’s public business page…' : `Preview ${activeOrganization?.name ?? 'this organization'} as a business.`}</Text></View>
          {publicBusinessLoading ? <ActivityIndicator color={COLORS.gold} size="small" /> : <Text style={styles.chevron}>›</Text>}
        </Pressable>
      </View>

      {HOST_WORKSPACE_GROUPS.map((group) => <View key={group}>
        <Text style={styles.sectionLabel}>{group}</Text>
        <View style={styles.list}>
          {HOST_WORKSPACE_ITEMS.filter((item) => item.group === group).map((item) => <Pressable key={item.key} style={styles.item} onPress={() => router.push(item.route as never)}>
            <View style={[styles.icon, { backgroundColor: `${item.accent}20` }]}><AppIcon name={item.icon} color={item.accent} size={20} /></View>
            <View style={{ flex: 1 }}><Text style={styles.itemTitle}>{item.title}</Text><Text style={styles.itemSubtitle}>{item.subtitle}</Text></View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>)}
        </View>
      </View>)}

      <Text style={styles.sectionLabel}>SWITCH WORKSPACE</Text>
      <View style={styles.workspaceCard}>
        {vendorApproved ? <Pressable style={styles.workspaceRow} onPress={() => router.replace('/vendor' as never)}><Text style={styles.workspaceTitle}>Vendor Center</Text><Text style={styles.chevron}>›</Text></Pressable> : null}
        {isPlatformAdmin ? <Pressable style={[styles.workspaceRow, vendorApproved && styles.divider]} onPress={() => router.replace('/admin' as never)}><Text style={styles.workspaceTitle}>Admin</Text><Text style={styles.chevron}>›</Text></Pressable> : null}
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg }, content: { padding: 18, paddingBottom: 90, maxWidth: 760, width: '100%', alignSelf: 'center' },
  flex: { flex: 1 },
  topbar: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 16 },
  eyebrow: { color: COLORS.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, title: { color: COLORS.cream, fontSize: 30, fontWeight: '900', marginTop: 2 }, subtitle: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 4, maxWidth: 360 },
  close: { width: 44, height: 44, borderRadius: 13, backgroundColor: COLORS.raised, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center' },
  overview: { minHeight: 74, borderRadius: 16, backgroundColor: '#1D2A22', borderWidth: 1, borderColor: '#435447', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  sectionLabel: { color: COLORS.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginTop: 22, marginBottom: 8 },
  list: { gap: 7 }, item: { minHeight: 70, borderRadius: 14, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 11 },
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#2A2317', alignItems: 'center', justifyContent: 'center' },
  itemTitle: { color: COLORS.cream, fontSize: 13.5, fontWeight: '900' }, itemSubtitle: { color: COLORS.dim, fontSize: 9.5, lineHeight: 13, marginTop: 2 }, chevron: { color: COLORS.muted, fontSize: 24 },
  organizationCard: { borderRadius: 16, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: '#3C493F', overflow: 'hidden' },
  organizationLoading: { minHeight: 58, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  organizationLoadingText: { color: COLORS.muted, fontSize: 11, lineHeight: 16 },
  organizationRow: { minHeight: 68, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 11 },
  organizationRowActive: { backgroundColor: '#1B2A20' },
  organizationMark: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.raised, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center' },
  organizationMarkActive: { borderColor: COLORS.gold, backgroundColor: '#2A2518' },
  organizationMarkText: { color: COLORS.cream, fontSize: 14, fontWeight: '900' },
  organizationTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  organizationTitle: { color: COLORS.cream, fontSize: 13, fontWeight: '900' },
  organizationMeta: { color: COLORS.dim, fontSize: 9.5, lineHeight: 13, marginTop: 3 },
  activePill: { color: COLORS.gold, fontSize: 7.5, fontWeight: '900', letterSpacing: 0.8, borderWidth: 1, borderColor: '#6C5A2F', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  activeCheck: { color: COLORS.green, fontSize: 18, fontWeight: '900' },
  organizationError: { color: '#E8A09A', fontSize: 10, lineHeight: 15, marginTop: 7 },
  publicViewCard: { borderRadius: 15, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: '#5B5030', overflow: 'hidden' },
  publicViewRow: { minHeight: 72, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 11 },
  publicViewIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#2A2518', alignItems: 'center', justifyContent: 'center' },
  publicViewText: { color: COLORS.dim, fontSize: 9.5, lineHeight: 13, marginTop: 3 },
  workspaceCard: { borderRadius: 15, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line, overflow: 'hidden' },
  workspaceRow: { minHeight: 52, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, divider: { borderTopWidth: 1, borderTopColor: COLORS.line },
  workspaceTitle: { color: COLORS.cream, fontSize: 13, fontWeight: '800' },
});