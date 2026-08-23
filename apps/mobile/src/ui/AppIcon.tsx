import { Ionicons } from '@react-native-vector-icons/ionicons';
import type { ComponentProps } from 'react';
import type { ColorValue, StyleProp, TextStyle } from 'react-native';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type AppIconName =
  | 'trailhead'
  | 'explore'
  | 'community'
  | 'campfire'
  | 'passport'
  | 'menu'
  | 'notifications'
  | 'profile'
  | 'chevron-forward'
  | 'chevron-back'
  | 'chevron-up'
  | 'weather'
  | 'trips'
  | 'connections'
  | 'guide'
  | 'support'
  | 'about'
  | 'privacy'
  | 'adventure'
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
  | 'close'
  | 'delete';

const icons: Record<AppIconName, IoniconName> = {
  trailhead: 'home-outline',
  explore: 'compass-outline',
  community: 'people-outline',
  campfire: 'flame-outline',
  passport: 'book-outline',
  menu: 'menu-outline',
  notifications: 'notifications-outline',
  profile: 'person-outline',
  'chevron-forward': 'chevron-forward',
  'chevron-back': 'chevron-back',
  'chevron-up': 'chevron-up',
  weather: 'partly-sunny-outline',
  trips: 'ticket-outline',
  connections: 'link-outline',
  guide: 'map-outline',
  support: 'help-circle-outline',
  about: 'information-circle-outline',
  privacy: 'shield-checkmark-outline',
  adventure: 'compass-outline',
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
