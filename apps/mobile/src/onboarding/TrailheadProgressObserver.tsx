import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { loadAskGoHistory } from '../trailGuide/askHistory';
import { getSavedTrailGuidePlaceIds } from '../trailGuide/savedPlaces';
import { markTrailheadAction } from './trailheadProgress';

export function TrailheadProgressObserver() {
  const { session } = useAuth();
  const pathname = usePathname();
  const previousPath = useRef(pathname);

  useEffect(() => {
    if (!session?.user.id) return;

    if (pathname === '/trail-guide' || /^\/trail-guide\/[^/]+$/.test(pathname)) {
      markTrailheadAction('trail-guide');
    }

    if (/\/community\/?$/.test(pathname)) {
      markTrailheadAction('outpost');
    }

    if (/^\/adventures\/[^/]+$/.test(pathname)) {
      markTrailheadAction('adventure');
    }

    if (getSavedTrailGuidePlaceIds(session.user.id).length > 0) {
      markTrailheadAction('save-place');
    }

    const returnedHome = pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/';
    const leftProfile = previousPath.current.startsWith('/member/profile') && !pathname.startsWith('/member/profile');
    if (returnedHome || leftProfile || pathname.startsWith('/member/profile')) {
      void supabase
        .from('profiles')
        .select('display_name,avatar_url,bio,home_city,home_state')
        .eq('id', session.user.id)
        .single()
        .then(({ data, error }) => {
          if (error || !data) return;
          if (data.display_name?.trim() && data.avatar_url && data.bio?.trim() && data.home_city?.trim() && data.home_state?.trim()) {
            markTrailheadAction('profile');
          }
        });
    }

    const leftAskGo = previousPath.current.startsWith('/trail-guide/ask') && !pathname.startsWith('/trail-guide/ask');
    if (leftAskGo || returnedHome) {
      void loadAskGoHistory().then((threads) => {
        if (threads.some((thread) => thread.exchanges.length > 0)) markTrailheadAction('ask-go');
      }).catch(() => undefined);
    }

    previousPath.current = pathname;
  }, [pathname, session?.user.id]);

  return null;
}
