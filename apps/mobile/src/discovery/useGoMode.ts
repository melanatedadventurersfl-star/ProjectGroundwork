import { useEffect, useState } from 'react';
import { getGoMode, setGoMode, subscribeGoMode, type GoMode } from './modePreference';

export function useGoMode(userId: string | undefined) {
  const [mode, updateMode] = useState<GoMode>(() => getGoMode(userId ?? ''));
  useEffect(() => {
    updateMode(getGoMode(userId ?? ''));
    return subscribeGoMode((updatedUserId, nextMode) => {
      if ((userId ?? '') === updatedUserId) updateMode(nextMode);
    });
  }, [userId]);
  const chooseMode = (nextMode: GoMode) => {
    updateMode(nextMode);
    setGoMode(userId ?? '', nextMode);
  };
  return { mode, chooseMode };
}
