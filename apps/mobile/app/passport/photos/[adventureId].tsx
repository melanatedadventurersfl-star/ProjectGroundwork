import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

/**
 * Legacy route kept for older links and stamp actions.
 * Photo capture now lives inside the unified Add Memory flow.
 */
export default function LegacyAddPhotosRoute() {
  const { adventureId } = useLocalSearchParams<{ adventureId?: string }>();

  useEffect(() => {
    const destination = adventureId
      ? `/passport/memories/add?adventureId=${encodeURIComponent(adventureId)}`
      : '/passport/memories/add';

    router.replace(destination);
  }, [adventureId]);

  return null;
}
