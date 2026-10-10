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

function shareHost() {
  try {
    const value = envValue('EXPO_PUBLIC_SHARE_BASE_URL');
    if (!value) return null;
    const url = new URL(value);
    return url.protocol === 'https:' ? url.host : null;
  } catch {
    return null;
  }
}

function goMelanatedPlugins(appName) {
  return (base.plugins || []).flatMap((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    if (name === './plugins/with-goworkout-health-connect') return [];
    if (name === 'expo-location') {
      return [['expo-location', {
        locationWhenInUsePermission: `Allow ${appName} to use your location for nearby and location-aware features.`,
      }]];
    }
    if (name === 'expo-contacts') {
      return [['expo-contacts', {
        contactsPermission: `Allow ${appName} to access contacts for features you choose.`,
      }]];
    }
    if (name === 'expo-image-picker') {
      return [['expo-image-picker', {
        photosPermission: `Allow ${appName} to add photos from your library.`,
        cameraPermission: `Allow ${appName} to take photos.`,
        microphonePermission: false,
      }]];
    }
    return [plugin];
  });
}

function workoutPlugins() {
  return [
    ['expo-router', { root: './workout-app' }],
    'expo-status-bar',
    './plugins/with-goworkout-health-connect',
  ];
}

const appFlavor = envValue('EXPO_PUBLIC_APP_FLAVOR') || 'go-melanated';
const isWorkoutApp = appFlavor === 'workout';
const workoutWebUrl =
  envValue('EXPO_PUBLIC_WORKOUT_WEB_URL') ||
  'https://melanatedadventurersfl-star.github.io/ProjectGroundwork/goworkout/';

const tenantPublicSlug = envValue('EXPO_PUBLIC_TENANT_PUBLIC_SLUG');
const publicShareHost = shareHost();
const webBaseUrl = envValue('EXPO_PUBLIC_WEB_BASE_URL');

const tenantIdentity = !isWorkoutApp && tenantPublicSlug
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
  ...(isWorkoutApp
    ? {
        package: 'com.melanatedadventurers.goworkout',
        softwareKeyboardLayoutMode: 'resize',
      }
    : tenantIdentity
      ? {
          package: tenantIdentity.androidPackage,
          icon: tenantIdentity.icon,
        }
      : {}),
  ...(!isWorkoutApp && publicShareHost
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
if (isWorkoutApp) delete android.icon;

const ios = {
  ...(base.ios || {}),
  ...(isWorkoutApp
    ? { bundleIdentifier: 'com.melanatedadventurers.goworkout' }
    : tenantIdentity
      ? { bundleIdentifier: tenantIdentity.iosBundleIdentifier }
      : {}),
  ...(!isWorkoutApp && publicShareHost
    ? {
        associatedDomains: [
          ...(base.ios?.associatedDomains || []),
          `applinks:${publicShareHost}`,
        ],
      }
    : {}),
};

const { eas: _baseEas, ...baseExtraWithoutEas } = base.extra || {};

module.exports = {
  ...base,
  ...(isWorkoutApp
    ? {
        name: 'GO Workout',
        slug: 'go-workout',
        description: 'Adaptive strength training, workout tracking, and connected health.',
        version: '0.1.0',
        scheme: 'goworkout',
        userInterfaceStyle: 'dark',
        icon: undefined,
        splash: {
          resizeMode: 'contain',
          backgroundColor: '#0A0D0B',
        },
        plugins: workoutPlugins(),
        updates: {
          enabled: false,
          checkAutomatically: 'NEVER',
          fallbackToCacheTimeout: 0,
        },
      }
    : tenantIdentity
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
          plugins: goMelanatedPlugins(tenantIdentity.name),
          updates: {
            ...(base.updates || {}),
            url: `https://u.expo.dev/${tenantIdentity.easProjectId}`,
          },
        }
      : {
          plugins: goMelanatedPlugins('Go Melanated'),
        }),
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
  extra: isWorkoutApp
    ? {
        ...baseExtraWithoutEas,
        router: {},
        appFlavor: 'workout',
        workoutWebUrl,
        tenantPublicSlug: null,
        tenantAppName: null,
        nativeBuildAssetRevision: 'go-workout-android-v1',
        buildCommit,
        buildNumber,
        buildTimestamp: process.env.EXPO_PUBLIC_BUILD_TIMESTAMP || new Date().toISOString(),
        buildProfile: process.env.EAS_BUILD_PROFILE || process.env.EXPO_PUBLIC_BUILD_PROFILE || 'local',
        buildSource: process.env.EXPO_PUBLIC_BUILD_SOURCE || 'local',
      }
    : {
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
        appFlavor: 'go-melanated',
        buildCommit,
        buildNumber,
        buildTimestamp: process.env.EXPO_PUBLIC_BUILD_TIMESTAMP || new Date().toISOString(),
        buildProfile: process.env.EAS_BUILD_PROFILE || process.env.EXPO_PUBLIC_BUILD_PROFILE || 'local',
        buildSource: process.env.EXPO_PUBLIC_BUILD_SOURCE || 'local',
      },
};
