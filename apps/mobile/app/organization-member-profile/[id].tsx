import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { supabase } from '../../src/lib/supabase';
import { experienceModuleEnabled, getOrganizationExperience, listExperienceModules } from '../../src/platform/experience';
import { listMyOrganizations } from '../../src/platform/organizations';

type Target = { href: string } | { error: string } | null;

export default function OrganizationMemberProfileRedirect() {
  const { id, organizationId } = useLocalSearchParams<{ id: string; organizationId?: string }>();
  const [target, setTarget] = useState<Target>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [{ data: auth }, organizations] = await Promise.all([
          supabase.auth.getUser(),
          listMyOrganizations(),
        ]);
        if (!auth.user || !id || auth.user.id !== id) throw new Error('This profile link is only available for your own account.');

        const organization = organizations.find((item) => item.id === organizationId)
          ?? organizations.find((item) => item.isActive)
          ?? null;
        if (!organization) throw new Error('Organization access is unavailable.');

        if (organization.isPlatformDefault) {
          if (active) setTarget({ href: '/member/profile' });
          return;
        }

        const experience = await getOrganizationExperience(organization.id);
        if (!experience) throw new Error('This organization app is not configured.');
        const modules = await listExperienceModules(experience.id);
        if (!experienceModuleEnabled(modules, 'profiles', false)) {
          throw new Error('Member profiles are not enabled for this organization app.');
        }

        if (active) setTarget({ href: `/experience/${organization.slug}/profile` });
      } catch (caught) {
        if (active) setTarget({ error: caught instanceof Error ? caught.message : 'Unable to open this organization profile.' });
      }
    })();
    return () => { active = false; };
  }, [id, organizationId]);

  if (!target) return <View style={styles.center}><ActivityIndicator color="#D7B45A" /></View>;
  if ('error' in target) return <View style={styles.center}><Text style={styles.error}>{target.error}</Text></View>;
  return <Redirect href={target.href as never} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#0F1713', alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: '#F0A199', fontSize: 11, lineHeight: 17, textAlign: 'center', maxWidth: 420 },
});
