import type { Session } from '@supabase/supabase-js';
import { router, usePathname } from 'expo-router';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { supabase } from '../lib/supabase';
import { redeemPendingInvite } from '../referrals/pendingInvite';
import { logStartupStage, withStartupTimeout } from '../reliability/startup';

type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
};

type ModerationStatus = {
  profile_status?: 'pending' | 'active' | 'restricted' | 'suspended' | null;
  enforcement?: null | {
    action_type?: 'posting_restriction' | 'suspension' | 'ban';
  };
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const MODERATION_GATE_POLL_MS = 5000;
const AUTH_RESTORE_TIMEOUT_MS = 10000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    let isMounted = true;
    logStartupStage('auth-restoring');

    void withStartupTimeout(supabase.auth.getSession(), 'Session restore', AUTH_RESTORE_TIMEOUT_MS)
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) console.warn('Unable to restore session', error.message);
        setSession(data.session ?? null);
        logStartupStage('auth-ready', { restored: Boolean(data.session), source: 'getSession' });
      })
      .catch((error) => {
        if (!isMounted) return;
        console.warn('[startup] Session restore failed open', error instanceof Error ? error.message : error);
        setSession(null);
        logStartupStage('auth-ready', { restored: false, source: 'timeout-fallback' });
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession);
      setIsLoading(false);
      logStartupStage('auth-ready', { restored: Boolean(nextSession), source: 'auth-event' });
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
    let checking = false;

    async function enforceModerationGate() {
      if (checking || cancelled) return;
      checking = true;
      const { data, error } = await supabase.rpc('get_my_moderation_status');
      checking = false;
      if (cancelled) return;
      if (error) {
        console.warn('[moderation] Unable to check account status', error.message);
        return;
      }
      const moderation = data as ModerationStatus | null;
      const action = moderation?.enforcement?.action_type;
      const blocked = action === 'suspension' || action === 'ban' || moderation?.profile_status === 'suspended';
      if (blocked && pathname !== '/account-status') {
        router.replace('/account-status' as never);
      }
    }

    void enforceModerationGate();
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') void enforceModerationGate();
    }, MODERATION_GATE_POLL_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void enforceModerationGate();
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
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
