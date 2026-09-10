# mac-commands

Local Expo module (native module name `MacCommands`). Builds and drives
qRemote's Mac Catalyst app menu - File > New Transfer; View >
Refresh/Find/Toggle Sidebar; a top-level Transfer menu (Resume, Pause,
Delete, Recheck, Reannounce, Move to Top/Up/Down/Bottom, Resume All, Pause
All, Toggle Alternative Speed); app menu > Preferences - and forwards fired
commands to JS as an `onCommand` event. Mirrors the reference menu in the
Pogona macOS app (`/Users/Repository/pogona/Pogona/App/PogonaApp.swift`).

No-op everywhere that isn't Mac Catalyst: `isMacIdiom()` returns `false`,
every setter is a no-op, and `addCommandListener` returns a subscription
whose `remove()` does nothing. Safe to call unconditionally from JS -
callers don't need to guard on `Platform.isMacCatalyst` first (see
`hooks/useMacCommands.ts`).

## Files

- `index.ts` - JS entry point. `requireNativeModule('MacCommands')` wrapped
  in try/catch, matching `modules/ui-sounds` and
  `modules/insecure-cert-allowlist`: falls back to `null` under the `node`
  Jest project (ts-jest can't parse expo-modules-core's untranspiled
  TS/ESM), and every export becomes a safe no-op in that case.
- `ios/MacCommandsModule.swift` - the Expo `Module` subclass. Bridges JS
  calls/events to `MacMenuRegistry`; owns no menu-building logic itself.
- `ios/MacMenuRegistry.swift` - a plain UIKit singleton (no ExpoModulesCore
  dependency) that actually builds the menu (`build(_ builder:
  UIMenuBuilder)`), validates commands (`validate(_ command: UICommand)`),
  and dispatches fired ones (`dispatch(_ sender: Any?)`). Holds the
  enabled-command set, per-command titles (English fallback, overridable via
  `setMenuTitles`), and the minimum window size. Framework-agnostic so the
  generated AppDelegate override (see below) can call into it without
  depending on ExpoModulesCore.
- `ios/MacCommands.podspec` - autolinked automatically; qRemote's local
  `modules/` directory is picked up by Expo's default autolinking search
  paths the same way `modules/ui-sounds` and
  `modules/insecure-cert-allowlist` already are, so nothing in
  `package.json` needs to reference this module by name.

## Native wiring (plugins/withMacCatalyst.js)

UIKit calls `AppDelegate.buildMenu(with:)`, `.validate(_:)`, and the
`macCommandAction(_:)` target-action selector directly - there is no way to
route those through an Expo module's own Swift class the way JS-invoked
`Function`s work. `plugins/withMacCatalyst.js` (inside its existing
`QREMOTE_MAC_CATALYST=1` gate) adds a `withAppDelegate` step that injects
into the generated `ios/qRemote/AppDelegate.swift`:

- `import MacCommands`
- `override func buildMenu(with builder: UIMenuBuilder)` - calls
  `super.buildMenu(with: builder)` then `MacMenuRegistry.shared.build(builder)`
- `override func validate(_ command: UICommand)` - calls
  `super.validate(command)` then `MacMenuRegistry.shared.validate(command)`
- `@objc func macCommandAction(_ sender: Any?)` - forwards to
  `MacMenuRegistry.shared.dispatch(sender)`

Every `UIKeyCommand` `MacMenuRegistry.build(_:)` creates targets that
selector via `NSSelectorFromString("macCommandAction:")` rather than a
static `#selector(...)`, so `MacMenuRegistry.swift` never needs to import or
reference the app's `AppDelegate` type.

Since this injection lives inside the existing `QREMOTE_MAC_CATALYST=1`
gate, it never runs for a plain iPhone/iPad prebuild - the generated
AppDelegate is untouched there, same as the rest of that plugin.

## Compiling on plain iOS

This module's own Swift files (unlike the AppDelegate injection above) are
not gated by `QREMOTE_MAC_CATALYST` - they autolink into every build,
Catalyst or not, the same way `modules/ui-sounds` does. `UIMenuBuilder`,
`UIKeyCommand`, and `UICommand` are iOS 13+ APIs and compile fine on
iPhone/iPad; `MacMenuRegistry.build(_:)` simply does nothing there because
`isMacIdiom()` is false. The one Mac-Catalyst-flavored piece
(`UIWindowScene.sizeRestrictions` for `setWindowMinSize`) is wrapped in
`#if targetEnvironment(macCatalyst)` as belt-and-suspenders, even though its
callers never fire outside Mac Catalyst anyway (gated at
`useShell().idiom === 'mac'` in JS).
