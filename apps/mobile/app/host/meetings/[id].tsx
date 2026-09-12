import { useLocalSearchParams } from 'expo-router';

import { HostMeetingDetail } from '../../../src/hosting/HostMeetingDetail';

export default function HostMeetingDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const meetingId = Array.isArray(id) ? id[0] : id;
  return <HostMeetingDetail meetingId={meetingId ?? ''} />;
}
