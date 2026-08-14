import { Ionicons } from '@expo/vector-icons';
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
  | 'weather'
  | 'trips'
  | 'connections'
  | 'guide'
  | 'support'
  | 'about'
  | 'privacy';

const icons: Record<AppIconName, IoniconName> = {
  trailhead: 'home-outline',
  explore: 'compass-outline',
  community: 'people-outline',
  passport: 'book-outline',
  menu: 'menu-outline',
  notifications: 'notifications-outline',
  profile: 'person-outline',
  'chevron-forward': 'chevron-forward',
  weather: 'partly-sunny-outline',
  trips: 'ticket-outline',
  connections: 'link-outline',
  guide: 'map-outline',
  support: 'help-circle-outline',
  about: 'information-circle-outline',
  privacy: 'shield-checkmark-outline',
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
