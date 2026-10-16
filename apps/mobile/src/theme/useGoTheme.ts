import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useGoMode } from '../discovery/useGoMode';
import { getAppearancePreference, resolveAppearance, setAppearancePreference, subscribeAppearance, type AppearancePreference } from './appearancePreference';

export const GO_PALETTES = {
  nature: {
    day: {
      background: '#94A993', surface: '#E7EDE2', elevated: '#D9E5D7',
      text: '#20382C', muted: '#4B6253', border: '#B7C6B8',
      accent: '#2E563F', chip: '#D2DED0', icon: '#335C43',
    },
    dark: {
      background: '#0F1713', surface: '#16201B', elevated: '#1E2B23',
      text: '#FFF8E8', muted: '#AEB8B2', border: '#2A382F',
      accent: '#D7B45A', chip: '#26362B', icon: '#D7B45A',
    },
  },
  night: {
    day: {
      background: '#C4BED0', surface: '#EEEAF1', elevated: '#DED8E7',
      text: '#322B46', muted: '#61596C', border: '#A8A0B6',
      accent: '#654C80', chip: '#E1D9E9', icon: '#654C80',
    },
    dark: {
      background: '#25273D', surface: '#35364F', elevated: '#41425D',
      text: '#F4EFF8', muted: '#C9C3D5', border: '#56516B',
      accent: '#D7B8E9', chip: '#49465F', icon: '#D7B8E9',
    },
  },
} as const;

export function useGoAppearance(userId?: string) {
  const id = userId ?? '';
  const [preference, setPreference] = useState<AppearancePreference>(() => getAppearancePreference(id));
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    setPreference(getAppearancePreference(id));
    return subscribeAppearance((updatedUserId, value) => {
      if (updatedUserId === id) setPreference(value);
    });
  }, [id]);

  useEffect(() => {
    const update = () => setClock(new Date());
    const interval = setInterval(update, 60_000);
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') update();
    });
    return () => { clearInterval(interval); sub.remove(); };
  }, []);

  const appearance = resolveAppearance(preference, clock);
  function chooseAppearance(value: AppearancePreference) {
    setPreference(value);
    setAppearancePreference(id, value);
    setClock(new Date());
  }
  return { appearance, preference, chooseAppearance, isDark: appearance === 'dark' };
}

export function useGoTheme(userId?: string) {
  const { mode, chooseMode } = useGoMode(userId);
  const appearance = useGoAppearance(userId);
  return { ...appearance, mode, chooseMode, palette: GO_PALETTES[mode][appearance.appearance] };
}
