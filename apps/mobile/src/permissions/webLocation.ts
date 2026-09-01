export const Accuracy = {
  Lowest: 1,
  Low: 2,
  Balanced: 3,
  High: 4,
  Highest: 5,
  BestForNavigation: 6,
} as const;

type PermissionStatus = 'granted' | 'denied' | 'undetermined';

type PermissionResponse = {
  status: PermissionStatus;
  granted: boolean;
  canAskAgain: boolean;
  expires: 'never';
};

function response(status: PermissionStatus): PermissionResponse {
  return {
    status,
    granted: status === 'granted',
    canAskAgain: status !== 'denied',
    expires: 'never',
  };
}

function hasGeolocation() {
  return typeof navigator !== 'undefined' && Boolean(navigator.geolocation);
}

export async function getForegroundPermissionsAsync(): Promise<PermissionResponse> {
  if (!hasGeolocation()) return response('denied');

  try {
    if (navigator.permissions?.query) {
      const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      if (result.state === 'granted') return response('granted');
      if (result.state === 'denied') return response('denied');
    }
  } catch {
    // Safari may not expose geolocation through the Permissions API.
  }

  return response('undetermined');
}

function browserPosition(options?: PositionOptions) {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!hasGeolocation()) {
      reject(new Error('Location is not available in this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

export async function requestForegroundPermissionsAsync(): Promise<PermissionResponse> {
  try {
    await browserPosition({ enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
    return response('granted');
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? Number((error as GeolocationPositionError).code) : 0;
    return response(code === 1 ? 'denied' : 'undetermined');
  }
}

export async function getCurrentPositionAsync(_options?: { accuracy?: number }) {
  const position = await browserPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 });
  return {
    coords: {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      altitude: position.coords.altitude,
      accuracy: position.coords.accuracy,
      altitudeAccuracy: position.coords.altitudeAccuracy,
      heading: position.coords.heading,
      speed: position.coords.speed,
    },
    timestamp: position.timestamp,
  };
}
