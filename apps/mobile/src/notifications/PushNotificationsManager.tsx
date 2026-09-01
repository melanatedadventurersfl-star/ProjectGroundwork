import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { markNotificationRead, registerPushToken } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function getProjectId() {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

async function registerDeviceForPush() {
  if (Platform.OS === 'web') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('general', {
      name: 'General',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#D7B45A',
    });
  }

  const currentPermissions = await Notifications.getPermissionsAsync();
  if (currentPermissions.status !== 'granted') return;

  const projectId = getProjectId();
  if (!projectId) {
    console.warn('[push] Expo project ID is missing; device registration skipped.');
    return;
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  await registerPushToken(token.data, Platform.OS);
}

function openNotificationResponse(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data;
  const actionUrl = typeof data?.action_url === 'string' ? data.action_url : null;
  const notificationId = typeof data?.notification_id === 'string' ? data.notification_id : null;

  if (notificationId) {
    void markNotificationRead(notificationId).catch((error) => {
      console.warn('[push] Unable to mark notification read', error);
    });
  }

  if (actionUrl?.startsWith('/')) {
    router.push(actionUrl as Href);
  }
}

export function PushNotificationsManager({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;

    void registerDeviceForPush().catch((error) => {
      console.warn('[push] Device registration failed', error);
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(openNotificationResponse);

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) openNotificationResponse(response);
    }).catch((error) => {
      console.warn('[push] Unable to read launch notification', error);
    });

    return () => {
      responseSubscription.remove();
    };
  }, [enabled]);

  return null;
}
