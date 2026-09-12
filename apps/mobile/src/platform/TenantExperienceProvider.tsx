import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  experienceModuleEnabled,
  getExperienceContextBySlug,
  type ActiveExperienceContext,
} from './experience';

type TenantExperienceValue = {
  context: ActiveExperienceContext | null;
  loading: boolean;
  error: string | null;
  moduleEnabled: (code: string) => boolean;
};

const TenantExperienceContext = createContext<TenantExperienceValue | null>(null);

export function TenantExperienceProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const [context, setContext] = useState<ActiveExperienceContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void getExperienceContextBySlug(slug)
      .then((next) => {
        if (!active) return;
        if (!next) {
          setContext(null);
          setError('This app is not available for your account.');
          return;
        }
        if (next.organization.isPlatformDefault) {
          setContext(null);
          setError('This route is reserved for separate organization apps.');
          return;
        }
        setContext(next);
      })
      .catch((caught) => {
        if (!active) return;
        setContext(null);
        setError(caught instanceof Error ? caught.message : 'Unable to open this app.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [slug]);

  const value = useMemo<TenantExperienceValue>(() => ({
    context,
    loading,
    error,
    moduleEnabled: (code: string) => Boolean(
      context && experienceModuleEnabled(context.modules, code, false),
    ),
  }), [context, error, loading]);

  return <TenantExperienceContext.Provider value={value}>{children}</TenantExperienceContext.Provider>;
}

export function useTenantExperience() {
  const value = useContext(TenantExperienceContext);
  if (!value) throw new Error('useTenantExperience must be used inside TenantExperienceProvider.');
  return value;
}
