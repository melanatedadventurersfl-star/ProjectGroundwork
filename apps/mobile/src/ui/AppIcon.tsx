import { Ionicons } from '@react-native-vector-icons/ionicons';
import type { ComponentProps } from 'react';
import type { ColorValue, StyleProp, TextStyle } from 'react-native';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type AppIconName =
  | 'trailhead'
  | 'explore'
  | 'community'
  | 'passport'
  | 'menu'
  | 'notifications'
  | 'profile'
  | 'chevron-forward'
  | 'chevron-back'
  | 'chevron-up'
  | 'arrow-up'
  | 'weather'
  | 'trips'
  | 'connections'
  | 'guide'
  | 'map'
  | 'support'
  | 'about'
  | 'privacy'
  | 'adventure'
  | 'bookmark'
  | 'stamp'
  | 'photos'
  | 'photo'
  | 'add'
  | 'trail'
  | 'trail-family'
  | 'location'
  | 'edit'
  | 'camera'
  | 'checkmark'
  | 'search'
  | 'badge'
  | 'time'
  | 'calendar'
  | 'dashboard'
  | 'tasks'
  | 'briefcase'
  | 'megaphone'
  | 'storefront'
  | 'directory'
  | 'library'
  | 'team'
  | 'reports'
  | 'settings'
  | 'filter'
  | 'more'
  | 'open'
  | 'share'
  | 'close'
  | 'delete';

const icons: Record<AppIconName, IoniconName> = {
  trailhead: 'home-outline',
  explore: 'compass-outline',
  community: 'people-outline',
  passport: 'book-outline',
  menu: 'menu-outline',
  notifications: 'notifications-outline',
  profile: 'person-outline',
  'chevron-forward': 'chevron-forward',
  'chevron-back': 'chevron-back',
  'chevron-up': 'chevron-up',
  'arrow-up': 'arrow-up',
  weather: 'partly-sunny-outline',
  trips: 'ticket-outline',
  connections: 'link-outline',
  guide: 'map-outline',
  map: 'map-outline',
  support: 'help-circle-outline',
  about: 'information-circle-outline',
  privacy: 'shield-checkmark-outline',
  adventure: 'compass-outline',
  bookmark: 'bookmark',
  stamp: 'ribbon-outline',
  photos: 'images-outline',
  photo: 'image-outline',
  add: 'add-circle-outline',
  trail: 'compass-outline',
  'trail-family': 'people-outline',
  location: 'location-outline',
  edit: 'pencil-outline',
  camera: 'camera-outline',
  checkmark: 'checkmark-circle',
  search: 'search-outline',
  badge: 'medal-outline',
  time: 'time-outline',
  calendar: 'calendar-outline',
  dashboard: 'grid-outline',
  tasks: 'checkmark-done-outline',
  briefcase: 'briefcase-outline',
  megaphone: 'megaphone-outline',
  storefront: 'storefront-outline',
  directory: 'albums-outline',
  library: 'library-outline',
  team: 'people-circle-outline',
  reports: 'bar-chart-outline',
  settings: 'settings-outline',
  filter: 'filter-outline',
  more: 'ellipsis-horizontal',
  open: 'open-outline',
  share: 'share-social-outline',
  close: 'close-circle-outline',
  delete: 'trash-outline',
};

export function AppIcon({
  name,
  color = '#F6F4EE',
  size = 22,
  style,
}: {
  name: AppIconName;
  color?: ColorValue;
  size?: number;
  style?: StyleProp<TextStyle>;
}) {
  return <Ionicons name={icons[name]} color={color} size={size} style={style} />;
}
