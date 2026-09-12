import MemberProfileExperience from '../../src/member/MemberProfileExperience';
import { ExperienceModuleGate } from '../../src/platform/ExperienceModuleGate';

export default function MemberProfileScreen() {
  return (
    <ExperienceModuleGate moduleCode="profiles">
      <MemberProfileExperience />
    </ExperienceModuleGate>
  );
}
