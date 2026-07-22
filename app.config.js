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
    // NOTE: iOS is a bare React Native project (see AGENTS.md) -- `expo prebuild`
    // no longer runs for iOS, so `ios.infoPlist` below is reference-only and NOT
    // applied to the app. The authoritative copies are the committed
    // ios/qRemote/Info.plist and ios/qRemote/qRemote.entitlements; edit those
    // directly in Xcode and keep this block in sync by hand for documentation.
    // `bundleIdentifier`/`appStoreUrl` still matter (read by EAS submit/tooling).
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.qRemote.app',
      appStoreUrl: 'https://apps.apple.com/us/app/qremote-for-qbittorrent/id6756276747',
      infoPlist: {
        // Must be false: RN's StatusBar API (expo-status-bar / FocusAwareStatusBar)
        // is a no-op when iOS uses view-controller-based status bar appearance,
        // leaving the bar stuck on the system appearance (white icons in light mode).
        UIViewControllerBasedStatusBarAppearance: false,
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
        // Register as an "Open In" handler for .torrent files (issues #88, #125).
        // LSHandlerRank must be Owner (paired with the EXPORTED declaration
        // below) for Files' tap-to-open and "Always Open With" to list the
        // app — as a mere Alternate viewer of an unowned type, iOS fell back
        // to QuickLook Preview and showed "No Apps Available" (#125).
        CFBundleDocumentTypes: [
          {
            CFBundleTypeName: 'BitTorrent Document',
            CFBundleTypeRole: 'Viewer',
            LSHandlerRank: 'Owner',
            LSItemContentTypes: ['org.bittorrent.torrent', 'com.bittorrent.torrent'],
          },
        ],
        // EXPORTED, not imported (#125): "imported" tells iOS another app
        // owns this type definition — but no installed app exports a torrent
        // UTI, so the type was effectively unowned and Files offered no
        // open-with handlers. Exporting makes qRemote the canonical definer.
        // Conformance to public.content (alongside public.data) is also
        // required for Files' open-with eligibility — public.data alone only
        // gets the type into the share sheet.
        UTExportedTypeDeclarations: [
          {
            UTTypeIdentifier: 'org.bittorrent.torrent',
            UTTypeConformsTo: ['public.data', 'public.content'],
            UTTypeDescription: 'BitTorrent Document',
            UTTypeTagSpecification: {
              'public.filename-extension': ['torrent'],
              'public.mime-type': ['application/x-bittorrent'],
            },
          },
        ],
      },
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-router',
      'expo-font',
      'expo-localization',
      'expo-secure-store',
      'expo-sharing',
      'expo-status-bar',
    ],
    extra: {
      router: {},
      eas: {
        projectId: 'e2539074-777d-46d3-ae9e-9e584f9e9bb0',
      },
    },
    owner: 'taylorcox75',
  },
};
