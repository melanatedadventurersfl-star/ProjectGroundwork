import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { getOrganizationExperience } from '../../src/platform/experience';
import { listMyOrganizations } from '../../src/platform/organizations';

type Target = { href: string } | { error: string } | null;

export default function OrganizationBusinessPreviewRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [target, setTarget] = useState<Target>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const organizations = await listMyOrganizations();
        const organization = organizations.find((item) => item.id === id) ?? null;
        if (!organization) throw new Error('Organization access is unavailable.');

        if (organization.isPlatformDefault) {
          throw new Error('Go Melanated business pages remain in the Go Melanated experience.');
        }

        const experience = await getOrganizationExperience(organization.id);
        if (!experience) throw new Error('This organization app is not configured.');
        if (active) setTarget({ href: `/experience/${organization.slug}/business` });
      } catch (caught) {
        if (active) setTarget({ error: caught instanceof Error ? caught.message : 'Unable to open this organization business page.' });
      }
    })();
    return () => { active = false; };
  }, [id]);

  if (!target) return <View style={styles.center}><ActivityIndicator color="#D7B45A" /></View>;
  if ('error' in target) return <View style={styles.center}><Text style={styles.error}>{target.error}</Text></View>;
  return <Redirect href={target.href as never} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#0F1713', alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: '#F0A199', fontSize: 11, lineHeight: 17, textAlign: 'center', maxWidth: 420 },
});
