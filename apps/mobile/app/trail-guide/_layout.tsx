import { Stack } from 'expo-router';

import { ExperienceModuleGate } from '../../src/platform/ExperienceModuleGate';

export default function TrailGuideLayout() {
  return (
    <ExperienceModuleGate moduleCode="directory">
      <Stack screenOptions={{ headerShown: false }} />
    </ExperienceModuleGate>
  );
}
