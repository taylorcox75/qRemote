const packageJson = require('./package.json');

module.exports = {
  expo: {
    name: 'qRemote',
    slug: 'qremote',
    version: packageJson.version, // Single source of truth: package.json
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    scheme: 'qremote',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#0A0A0A',
    },
    // NOTE: ios/ is generated, not committed (untracked since #154). `npm run
    // xcode` runs `expo prebuild -p ios`, which APPLIES the `ios.infoPlist`
    // block below to the generated project — this is the authoritative place
    // for native Info.plist configuration (see AGENTS.md "iOS Native
    // Workflow"). Hand-edits made directly under ios/ are machine-local and
    // can be rewritten by the next prebuild.
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
        // Required (true, not just present — ITMS-90737 only requires the key
        // exist, but `false` demotes the app to a Share-Sheet-only receiver,
        // dropping it from Files' direct "Open In" / tap-to-open listing).
        // `true` means iOS hands the app a security-scoped reference to the
        // file at its original location instead of a sandboxed copy; reading
        // that from JS is a race the async Linking bridge usually loses (the
        // scope can lapse before app/_layout.tsx's handler runs) — see the
        // withNativeTorrentFileCopy plugin below, which copies the file
        // natively inside the native open-URL callback (while the scope is
        // still guaranteed valid) so JS only ever sees a plain, already-owned
        // copy.
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
      './plugins/withNativeTorrentFileCopy',
    ],
    extra: {
      router: {},
      eas: {
        projectId: 'e2539074-777d-46d3-ae9e-9e584f9e9bb0',
      },
    },
    updates: {
      url: 'https://u.expo.dev/e2539074-777d-46d3-ae9e-9e584f9e9bb0',
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    owner: 'taylorcox75',
  },
};
