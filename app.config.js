const packageJson = require('./package.json');

module.exports = {
  expo: {
    name: 'qRemote',
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
        CFBundleURLTypes: [
          {
            CFBundleURLName: 'com.qRemote.app.magnet',
            CFBundleURLSchemes: ['magnet'],
          },
        ],
        // Required when CFBundleDocumentTypes is set (ITMS-90737). We import
        // .torrent files via Linking rather than UIDocumentBrowserViewController.
        LSSupportsOpeningDocumentsInPlace: true,
        // Register as an "Open In" handler for .torrent files (issue #88)
        CFBundleDocumentTypes: [
          {
            CFBundleTypeName: 'BitTorrent Document',
            CFBundleTypeRole: 'Viewer',
            LSHandlerRank: 'Alternate',
            LSItemContentTypes: ['org.bittorrent.torrent', 'com.bittorrent.torrent'],
          },
        ],
        UTImportedTypeDeclarations: [
          {
            UTTypeIdentifier: 'org.bittorrent.torrent',
            UTTypeConformsTo: ['public.data'],
            UTTypeDescription: 'BitTorrent Document',
            UTTypeTagSpecification: {
              'public.filename-extension': ['torrent'],
              'public.mime-type': ['application/x-bittorrent'],
            },
          },
        ],
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
      usesCleartextTraffic: true,
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: false,
          data: [
            {
              scheme: 'magnet',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
        // Open .torrent files shared from other apps (issue #88)
        {
          action: 'VIEW',
          autoVerify: false,
          data: [
            {
              mimeType: 'application/x-bittorrent',
            },
          ],
          category: ['DEFAULT'],
        },
      ],
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
