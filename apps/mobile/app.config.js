const base = require('./app.json').expo;

const buildCommit =
  process.env.EAS_BUILD_GIT_COMMIT_HASH ||
  process.env.GITHUB_SHA ||
  process.env.EXPO_PUBLIC_GIT_SHA ||
  'local';

const buildNumber =
  process.env.EXPO_PUBLIC_BUILD_NUMBER ||
  process.env.GITHUB_RUN_NUMBER ||
  'local';

function envValue(name) {
  return process.env[name]?.trim() || null;
}

function requiredTenantEnv(name) {
  const value = envValue(name);
  if (!value) throw new Error(`${name} is required when EXPO_PUBLIC_TENANT_PUBLIC_SLUG is set.`);
  return value;
}

function shareHost(envName) {
  try {
    const value = envValue(envName);
    if (!value) return null;
    const url = new URL(value);
    return url.protocol === 'https:' ? url.host : null;
  } catch {
    return null;
  }
}

function tenantPlugins(appName) {
  return (base.plugins || []).map((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    if (name === 'expo-camera') {
      return ['expo-camera', {
        cameraPermission: `Allow ${appName} to use the camera for features you choose.`,
        microphonePermission: false,
        recordAudioAndroid: false,
        barcodeScannerEnabled: true,
      }];
    }
    if (name === 'expo-location') {
      return ['expo-location', {
        locationWhenInUsePermission: `Allow ${appName} to use your location for nearby and location-aware features.`,
      }];
    }
    if (name === 'expo-contacts') {
      return ['expo-contacts', {
        contactsPermission: `Allow ${appName} to access contacts for features you choose.`,
      }];
    }
    if (name === 'expo-image-picker') {
      return ['expo-image-picker', {
        photosPermission: `Allow ${appName} to add photos from your library.`,
        cameraPermission: `Allow ${appName} to take photos.`,
        microphonePermission: false,
      }];
    }
    return plugin;
  });
}

const tenantPublicSlug = envValue('EXPO_PUBLIC_TENANT_PUBLIC_SLUG');
const publicShareHost = shareHost(tenantPublicSlug ? 'EXPO_PUBLIC_TENANT_SHARE_BASE_URL' : 'EXPO_PUBLIC_SHARE_BASE_URL');
const webBaseUrl = envValue(tenantPublicSlug ? 'EXPO_PUBLIC_TENANT_WEB_BASE_URL' : 'EXPO_PUBLIC_WEB_BASE_URL');

const tenantIdentity = tenantPublicSlug
  ? {
      publicSlug: tenantPublicSlug,
      name: requiredTenantEnv('EXPO_PUBLIC_TENANT_APP_NAME'),
      slug: requiredTenantEnv('EXPO_PUBLIC_TENANT_APP_SLUG'),
      scheme: requiredTenantEnv('EXPO_PUBLIC_TENANT_APP_SCHEME'),
      iosBundleIdentifier: requiredTenantEnv('EXPO_PUBLIC_TENANT_IOS_BUNDLE_IDENTIFIER'),
      androidPackage: requiredTenantEnv('EXPO_PUBLIC_TENANT_ANDROID_PACKAGE'),
      icon: requiredTenantEnv('EXPO_PUBLIC_TENANT_APP_ICON'),
      splashImage: requiredTenantEnv('EXPO_PUBLIC_TENANT_SPLASH_IMAGE'),
      easProjectId: requiredTenantEnv('EXPO_PUBLIC_TENANT_EAS_PROJECT_ID'),
      description: envValue('EXPO_PUBLIC_TENANT_APP_DESCRIPTION'),
      assetRevision: envValue('EXPO_PUBLIC_TENANT_ASSET_REVISION') || `tenant-${tenantPublicSlug}-v1`,
    }
  : null;

const android = {
  ...(base.android || {}),
  ...(tenantIdentity
    ? {
        package: tenantIdentity.androidPackage,
        icon: tenantIdentity.icon,
      }
    : {}),
  ...(publicShareHost
    ? {
        intentFilters: [
          ...(base.android?.intentFilters || []),
          {
            action: 'VIEW',
            autoVerify: true,
            data: [{ scheme: 'https', host: publicShareHost, pathPrefix: '/p' }],
            category: ['BROWSABLE', 'DEFAULT'],
          },
        ],
      }
    : {}),
};
delete android.adaptiveIcon;

const ios = {
  ...(base.ios || {}),
  ...(tenantIdentity ? { bundleIdentifier: tenantIdentity.iosBundleIdentifier } : {}),
  ...(publicShareHost
    ? {
        associatedDomains: [
          ...(base.ios?.associatedDomains || []),
          `applinks:${publicShareHost}`,
        ],
      }
    : {}),
};

module.exports = {
  ...base,
  ...(tenantIdentity
    ? {
        name: tenantIdentity.name,
        slug: tenantIdentity.slug,
        description: tenantIdentity.description || `${tenantIdentity.name} organization app`,
        scheme: tenantIdentity.scheme,
        icon: tenantIdentity.icon,
        splash: {
          ...(base.splash || {}),
          image: tenantIdentity.splashImage,
        },
        plugins: tenantPlugins(tenantIdentity.name),
        updates: {
          ...(base.updates || {}),
          url: `https://u.expo.dev/${tenantIdentity.easProjectId}`,
        },
      }
    : {}),
  android,
  ios,
  web: {
    ...(base.web || {}),
    ...(webBaseUrl ? { output: 'single' } : {}),
  },
  experiments: {
    ...(base.experiments || {}),
    ...(webBaseUrl ? { baseUrl: webBaseUrl } : {}),
  },
  extra: {
    ...base.extra,
    ...(tenantIdentity
      ? {
          tenantPublicSlug: tenantIdentity.publicSlug,
          tenantAppName: tenantIdentity.name,
          nativeBuildAssetRevision: tenantIdentity.assetRevision,
          eas: { projectId: tenantIdentity.easProjectId },
        }
      : {
          tenantPublicSlug: null,
          tenantAppName: null,
          nativeBuildAssetRevision: 'go-melanated-launcher-v15',
        }),
    buildCommit,
    buildNumber,
    buildTimestamp: process.env.EXPO_PUBLIC_BUILD_TIMESTAMP || new Date().toISOString(),
    buildProfile: process.env.EAS_BUILD_PROFILE || process.env.EXPO_PUBLIC_BUILD_PROFILE || 'local',
    buildSource: process.env.EXPO_PUBLIC_BUILD_SOURCE || 'local',
  },
};
