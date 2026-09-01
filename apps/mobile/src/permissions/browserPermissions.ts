export type BrowserPermissionKey = 'notifications' | 'location' | 'contacts' | 'camera' | 'photos';
export type BrowserPermissionState = 'granted' | 'denied' | 'undetermined' | 'unavailable';
export type BrowserPermissionResult = {
  status: BrowserPermissionState;
  canAskAgain: boolean;
  browserManaged?: boolean;
  detail?: string;
};

type BrowserPermissionName = 'geolocation' | 'camera' | 'notifications';

function permissionState(value?: PermissionState | string | null): BrowserPermissionState {
  if (value === 'granted') return 'granted';
  if (value === 'denied') return 'denied';
  if (value === 'prompt' || value === 'undetermined') return 'undetermined';
  return 'unavailable';
}

async function queryBrowserPermission(name: BrowserPermissionName): Promise<BrowserPermissionState> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'undetermined';
  try {
    const result = await navigator.permissions.query({ name: name as PermissionName });
    return permissionState(result.state);
  } catch {
    return 'undetermined';
  }
}

export async function readBrowserPermission(key: BrowserPermissionKey): Promise<BrowserPermissionResult> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { status: 'unavailable', canAskAgain: false };
  }

  if (key === 'notifications') {
    if (!('Notification' in window)) {
      return { status: 'unavailable', canAskAgain: false, detail: 'Notifications are not supported by this browser.' };
    }
    const status = permissionState(Notification.permission);
    return { status, canAskAgain: status !== 'denied', browserManaged: true };
  }

  if (key === 'location') {
    if (!navigator.geolocation) {
      return { status: 'unavailable', canAskAgain: false, detail: 'Location is not supported by this browser.' };
    }
    const status = await queryBrowserPermission('geolocation');
    return { status, canAskAgain: status !== 'denied', browserManaged: true };
  }

  if (key === 'camera') {
    if (!navigator.mediaDevices?.getUserMedia) {
      return { status: 'unavailable', canAskAgain: false, detail: 'Camera access is not supported by this browser.' };
    }
    const status = await queryBrowserPermission('camera');
    return {
      status,
      canAskAgain: status !== 'denied',
      browserManaged: true,
      detail: 'Your browser controls camera access for this site.',
    };
  }

  if (key === 'photos') {
    return {
      status: 'granted',
      canAskAgain: false,
      browserManaged: true,
      detail: 'Photo access is requested only when you choose a file. The browser does not grant full photo-library access.',
    };
  }

  return {
    status: 'unavailable',
    canAskAgain: false,
    browserManaged: true,
    detail: 'Contact access is not available in this browser. Use the mobile app for contact matching.',
  };
}

export async function requestBrowserPermission(key: BrowserPermissionKey): Promise<BrowserPermissionResult> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { status: 'unavailable', canAskAgain: false };
  }

  if (key === 'notifications') {
    if (!('Notification' in window)) return readBrowserPermission(key);
    const result = await Notification.requestPermission();
    const status = permissionState(result);
    return { status, canAskAgain: status !== 'denied', browserManaged: true };
  }

  if (key === 'location') {
    if (!navigator.geolocation) return readBrowserPermission(key);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve({ status: 'granted', canAskAgain: true, browserManaged: true }),
        (error) => resolve({
          status: error.code === error.PERMISSION_DENIED ? 'denied' : 'undetermined',
          canAskAgain: error.code !== error.PERMISSION_DENIED,
          browserManaged: true,
          detail: error.message,
        }),
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
      );
    });
  }

  if (key === 'camera') {
    if (!navigator.mediaDevices?.getUserMedia) return readBrowserPermission(key);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      return { status: 'granted', canAskAgain: true, browserManaged: true };
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      const denied = name === 'NotAllowedError' || name === 'SecurityError';
      return {
        status: denied ? 'denied' : 'undetermined',
        canAskAgain: !denied,
        browserManaged: true,
        detail: error instanceof Error ? error.message : 'Unable to request camera access.',
      };
    }
  }

  return readBrowserPermission(key);
}

export function getBrowserPosition(): Promise<{ latitude: number; longitude: number }> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.reject(new Error('Location is not supported by this browser.'));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }),
      (error) => reject(new Error(error.message || 'Unable to access your location.')),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  });
}
