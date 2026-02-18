const packageJson = require('./package.json');

module.exports = {
  expo: {
    name: 'qRemote ',
    slug: 'qremote',
    version: packageJson.version, // Single source of truth: package.json
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    scheme: 'qRemote',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#0A0A0A',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.qRemote.app',
      infoPlist: {
        UIViewControllerBasedStatusBarAppearance: true,
        ITSAppUsesNonExemptEncryption: false,
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true,
        },
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0A0A0A',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: 'com.qRemote.app',
	  usesCleartextTraffic: 'true',
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: ['expo-router', 'expo-localization'],
    extra: {
      router: {},
      eas: {
        projectId: 'e2539074-777d-46d3-ae9e-9e584f9e9bb0',
      },
    },
    owner: 'taylorcox75',
  },
};

