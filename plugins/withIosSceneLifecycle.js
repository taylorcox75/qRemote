/**
 * Temporary Expo config plugin for Xcode 27 / iOS 27 SDK:
 * "Application failed to launch: UIScene life cycle is required..."
 *
 * Adapted from https://github.com/YesterdaysLemon/expo-ios-scene-lifecycle-plugin
 * (MIT). Remove once Expo ships SceneDelegate in the SDK 57 template.
 */
const { withAppDelegate, withInfoPlist } = require('@expo/config-plugins');

const sceneConfigurationMethod = `  public func application(
    _ application: UIApplication,
    configurationForConnecting connectingSceneSession: UISceneSession,
    options: UIScene.ConnectionOptions
  ) -> UISceneConfiguration {
    let configuration = UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    configuration.delegateClass = SceneDelegate.self
    return configuration
  }
`;

const sceneDelegateClass = `class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else {
      return
    }

    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate,
      let factory = appDelegate.reactNativeFactory else {
      return
    }

    let nextWindow = UIWindow(windowScene: windowScene)
    window = nextWindow
    appDelegate.window = nextWindow

    // Rebuild launch options from scene connection options so Linking.getInitialURL()
    // still sees cold-start magnet / file URLs under the scene life cycle.
    var launchOptions: [UIApplication.LaunchOptionsKey: Any] = [:]
    if let url = connectionOptions.urlContexts.first?.url {
      launchOptions[UIApplication.LaunchOptionsKey(rawValue: "UIApplicationLaunchOptionsURLKey")] = url
    }
    if let userActivity = connectionOptions.userActivities.first(where: {
      $0.activityType == NSUserActivityTypeBrowsingWeb
    }) {
      launchOptions[UIApplication.LaunchOptionsKey(rawValue: "UIApplicationLaunchOptionsUserActivityDictionaryKey")] = [
        "UIApplicationLaunchOptionsUserActivityTypeKey": userActivity.activityType,
        "UIApplicationLaunchOptionsUserActivityKey": userActivity,
      ]
    }

    factory.startReactNative(
      withModuleName: "main",
      in: nextWindow,
      launchOptions: launchOptions.isEmpty ? nil : launchOptions)

    if !connectionOptions.urlContexts.isEmpty {
      self.scene(scene, openURLContexts: connectionOptions.urlContexts)
    }
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let urlContext = URLContexts.first,
      let appDelegate = UIApplication.shared.delegate as? AppDelegate else {
      return
    }

    var options: [UIApplication.OpenURLOptionsKey: Any] = [
      .openInPlace: urlContext.options.openInPlace,
    ]

    if let sourceApplication = urlContext.options.sourceApplication {
      options[.sourceApplication] = sourceApplication
    }

    if let annotation = urlContext.options.annotation {
      options[.annotation] = annotation
    }

    _ = appDelegate.application(UIApplication.shared, open: urlContext.url, options: options)
  }
}
`;

function addInfoPlistSceneManifest(config) {
  return withInfoPlist(config, (nextConfig) => {
    nextConfig.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };

    return nextConfig;
  });
}

function patchAppDelegate(contents) {
  if (contents.includes('class SceneDelegate: UIResponder, UIWindowSceneDelegate')) {
    return contents;
  }

  let nextContents = contents;

  const startupBlockPattern =
    /#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\(\n\s*withModuleName: "main",\n\s*in: window,\n\s*launchOptions: launchOptions\)\n#endif/;

  if (!startupBlockPattern.test(nextContents)) {
    throw new Error(
      'Could not find the Expo AppDelegate React Native startup block to patch for UIScene lifecycle.',
    );
  }

  nextContents = nextContents.replace(
    startupBlockPattern,
    `#if os(iOS) || os(tvOS)
    if #unavailable(iOS 13.0) {
      window = UIWindow(frame: UIScreen.main.bounds)
      factory.startReactNative(
        withModuleName: "main",
        in: window,
        launchOptions: launchOptions)
    }
#endif`,
  );

  if (!nextContents.includes('configurationForConnecting connectingSceneSession')) {
    const linkingMarker = '\n  // Linking API';

    if (!nextContents.includes(linkingMarker)) {
      throw new Error(
        'Could not find the AppDelegate linking section to insert the UIScene configuration method.',
      );
    }

    nextContents = nextContents.replace(linkingMarker, `\n${sceneConfigurationMethod}\n  // Linking API`);
  }

  const reactNativeDelegateMarker = '\nclass ReactNativeDelegate: ExpoReactNativeFactoryDelegate';

  if (!nextContents.includes(reactNativeDelegateMarker)) {
    throw new Error('Could not find ReactNativeDelegate to insert SceneDelegate.');
  }

  return nextContents.replace(reactNativeDelegateMarker, `\n${sceneDelegateClass}${reactNativeDelegateMarker}`);
}

function addAppDelegateSceneLifecycle(config) {
  return withAppDelegate(config, (nextConfig) => {
    if (nextConfig.modResults.language !== 'swift') {
      throw new Error(
        `Cannot apply iOS scene lifecycle plugin to ${nextConfig.modResults.language} AppDelegate. Swift is required.`,
      );
    }

    nextConfig.modResults.contents = patchAppDelegate(nextConfig.modResults.contents);
    return nextConfig;
  });
}

module.exports = function withIosSceneLifecycle(config) {
  return addAppDelegateSceneLifecycle(addInfoPlistSceneManifest(config));
};
