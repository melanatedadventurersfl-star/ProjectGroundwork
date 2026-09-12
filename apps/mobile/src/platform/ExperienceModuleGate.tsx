import { Redirect } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { experienceModuleEnabled, getActiveExperienceContext } from './experience';

type ExperienceModuleGateProps = {
  moduleCode: string;
  children: ReactNode;
  fallbackHref?: string;
};

export function ExperienceModuleGate({
  moduleCode,
  children,
  fallbackHref = '/(tabs)',
}: ExperienceModuleGateProps) {
  const { session, isLoading } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!session?.user.id) {
      setAllowed(true);
      return;
    }

    let active = true;
    setAllowed(null);

    void getActiveExperienceContext()
      .then((context) => {
        if (!active) return;
        setAllowed(Boolean(context && experienceModuleEnabled(context.modules, moduleCode, false)));
      })
      .catch((error) => {
        console.warn(`[experience] Unable to verify ${moduleCode} access`, error);
        if (active) setAllowed(false);
      });

    return () => {
      active = false;
    };
  }, [isLoading, moduleCode, session?.user.id]);

  if (isLoading || allowed === null) {
    return <View style={{ flex: 1, backgroundColor: '#0F1713' }} />;
  }

  if (!allowed) {
    return <Redirect href={fallbackHref as never} />;
  }

  return <>{children}</>;
}
