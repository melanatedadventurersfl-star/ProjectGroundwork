import type { Session } from '@supabase/supabase-js';
import { router, usePathname } from 'expo-router';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { supabase } from '../lib/supabase';
import { redeemPendingInvite } from '../referrals/pendingInvite';

type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
};

type ModerationStatus = {
  enforcement?: null | {
    action_type?: 'posting_restriction' | 'suspension' | 'ban';
  };
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;
      if (error) console.warn('Unable to restore session', error.message);
      setSession(data.session ?? null);
      setIsLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user.id) return;
    let cancelled = false;
    const delays = [250, 1000, 2500];
    const timers = delays.map((delay) => setTimeout(() => {
      if (cancelled) return;
      void redeemPendingInvite().then((result) => {
        if (result.status === 'redeemed') console.info('[referral] Invite attribution completed');
      }).catch((error) => {
        console.warn('[referral] Unable to redeem pending invite yet', error instanceof Error ? error.message : error);
      });
    }, delay));

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [session?.user.id]);

  useEffect(() => {
    if (!session?.user.id) return;
    let cancelled = false;

    async function enforceModerationGate() {
      const { data, error } = await supabase.rpc('get_my_moderation_status');
      if (cancelled) return;
      if (error) {
        // A missing RPC during a rolling deployment must not lock members out.
        console.warn('[moderation] Unable to check account status', error.message);
        return;
      }
      const moderation = data as ModerationStatus | null;
      const action = moderation?.enforcement?.action_type;
      if ((action === 'suspension' || action === 'ban') && pathname !== '/account-status') {
        router.replace('/account-status' as never);
      }
    }

    void enforceModerationGate();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void enforceModerationGate();
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [pathname, session?.user.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    }),
    [session, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
