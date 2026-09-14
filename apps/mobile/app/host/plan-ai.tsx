import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import AiPlannerLegacyScreen from '../../src/hosting/AiPlannerLegacyScreen';
import AiPlannerV2Screen from '../../src/hosting/AiPlannerV2Screen';
import { getAiPlannerTenantContext, type AiPlannerTenantContext } from '../../src/hosting/aiPlannerTenant';

export default function AiPlannerRoute() {
  const [tenant, setTenant] = useState<AiPlannerTenantContext | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void getAiPlannerTenantContext()
      .then((nextTenant) => {
        if (active) setTenant(nextTenant);
      })
      .catch(() => {
        if (active) setTenant(null);
      });
    return () => { active = false; };
  }, []);

  if (tenant === undefined) {
    return <View style={styles.loading}><ActivityIndicator /></View>;
  }

  if (!tenant || tenant.isPlatformDefault) return <AiPlannerLegacyScreen />;
  return <AiPlannerV2Screen />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B100D' },
});
