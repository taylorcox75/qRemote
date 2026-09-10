import UIKit

/// The set of menu commands qRemote's Mac Catalyst app menu can dispatch.
/// Mirrors the `MacCommandId` union in index.ts exactly (see MAC_COMMAND_IDS
/// there) - keep the two lists in sync by hand, there is no shared codegen
/// between Swift and TS in this repo.
public enum MacCommandId: String, CaseIterable {
  case newTransfer
  case refresh
  case toggleAltSpeed
  case resume
  case pause
  case delete
  case recheck
  case reannounce
  case queueTop
  case queueUp
  case queueDown
  case queueBottom
  case resumeAll
  case pauseAll
  case find
  case toggleSidebar
  case preferences
}

/// Builds and drives qRemote's Mac Catalyst app menu (File > New Transfer;
/// View > Refresh/Find/Toggle Sidebar; a top-level Transfer menu; app menu >
/// Preferences) and owns the state that feeds it: which commands are
/// currently enabled, their (possibly localized) titles, and the JS-facing
/// event sink a fired command forwards to.
///
/// A singleton because UIKit calls `AppDelegate.buildMenu(with:)` and
/// `.validate(_:)` on its own schedule (menu bar construction, first
/// responder changes) with no reference back to the MacCommandsModule
/// instance that owns the JS bridge - this registry is the one place both
/// sides (the injected AppDelegate overrides in
/// plugins/withMacCatalyst.js and MacCommandsModule.swift) can reach.
///
/// Effectively main-actor-confined: `build`, `validate` and `dispatch` are
/// only ever invoked by UIKit itself (menu bar construction, command
/// validation, and the key-command target-action), which are always main
/// thread. The setters below can arrive from an Expo `Function`, which is
/// not guaranteed to run on the main thread, so they hop onto the main
/// queue explicitly before touching `enabled`/`titles`/`minWindowSize` or
/// asking UIKit to rebuild the menu.
public final class MacMenuRegistry {
  public static let shared = MacMenuRegistry()

  private init() {
    observeSceneConnections()
  }

  /// English fallback titles, keyed by `MacCommandId.rawValue` plus the one
  /// non-command key `"transferMenu"` (the top-level Transfer menu's own
  /// title). `setMenuTitles` overwrites entries here; any key it doesn't
  /// mention keeps its English fallback.
  private var titles: [String: String] = [
    MacCommandId.newTransfer.rawValue: "New Transfer",
    MacCommandId.refresh.rawValue: "Refresh",
    MacCommandId.toggleAltSpeed.rawValue: "Toggle Alternative Speed",
    MacCommandId.resume.rawValue: "Resume",
    MacCommandId.pause.rawValue: "Pause",
    MacCommandId.delete.rawValue: "Delete",
    MacCommandId.recheck.rawValue: "Recheck",
    MacCommandId.reannounce.rawValue: "Reannounce",
    MacCommandId.queueTop.rawValue: "Move to Top",
    MacCommandId.queueUp.rawValue: "Move Up",
    MacCommandId.queueDown.rawValue: "Move Down",
    MacCommandId.queueBottom.rawValue: "Move to Bottom",
    MacCommandId.resumeAll.rawValue: "Resume All",
    MacCommandId.pauseAll.rawValue: "Pause All",
    MacCommandId.find.rawValue: "Find",
    MacCommandId.toggleSidebar.rawValue: "Toggle Sidebar",
    MacCommandId.preferences.rawValue: "Preferences",
    "transferMenu": "Transfer",
  ]

  private var enabled: Set<String> = []
  private var minWindowSize: CGSize?

  /// Set by MacCommandsModule while JS has an `onCommand` listener attached
  /// (OnStartObserving/OnStopObserving), cleared otherwise. `dispatch(_:)`
  /// calls into this rather than reaching for ExpoModulesCore directly, so
  /// this file stays a plain UIKit file with no Expo dependency.
  var onCommand: ((String) -> Void)?

  // MARK: - Public state

  public func isMacIdiom() -> Bool {
    UIDevice.current.userInterfaceIdiom == .mac
  }

  public func setEnabledCommands(_ ids: [String]) {
    DispatchQueue.main.async {
      self.enabled = Set(ids)
      self.revalidateMenuIfNeeded()
    }
  }

  public func setMenuTitles(_ update: [String: String]) {
    DispatchQueue.main.async {
      for (key, value) in update {
        self.titles[key] = value
      }
      self.rebuildMenuIfNeeded()
    }
  }

  public func setWindowMinSize(width: Double, height: Double) {
    DispatchQueue.main.async {
      self.minWindowSize = CGSize(width: width, height: height)
      self.applyMinSizeToConnectedScenes()
    }
  }

  /// Sets (or clears) the JS-facing command sink. Called from
  /// MacCommandsModule's OnStartObserving/OnStopObserving/OnDestroy, which
  /// run on the Expo JS thread, while `dispatch(_:)` reads `onCommand` on
  /// the main thread (UIKit's key-command target-action). Hops to main
  /// like every other registry mutation so the write is never torn.
  public func setOnCommand(_ handler: ((String) -> Void)?) {
    DispatchQueue.main.async {
      self.onCommand = handler
    }
  }

  private func rebuildMenuIfNeeded() {
    guard isMacIdiom() else { return }
    UIMenuSystem.main.setNeedsRebuild()
  }

  /// Enabled-state changes only need `validate(_:)` re-run on the existing
  /// menu items (they read `enabled` there), not a full menu teardown and
  /// rebuild - `setNeedsRevalidate()` (iOS 15+, within this module's 15.1
  /// deployment floor) is the lightweight counterpart to
  /// `rebuildMenuIfNeeded()`'s `setNeedsRebuild()`, which titles still need.
  private func revalidateMenuIfNeeded() {
    guard isMacIdiom() else { return }
    UIMenuSystem.main.setNeedsRevalidate()
  }

  // MARK: - Menu construction

  // Reverse-DNS-ish identifiers for the inline menu groups this registry
  // inserts, so a second `build(_:)` pass (UIMenuSystem rebuilds the whole
  // menu from scratch each time, calling buildMenu(with:) again) doesn't
  // collide with anything else's identifiers. UIKit itself only needs these
  // to be unique; qRemote never looks them back up.
  private static let fileMenuId = UIMenu.Identifier("net.qremote.mac.file.newTransfer")
  private static let viewMenuId = UIMenu.Identifier("net.qremote.mac.view.items")
  private static let editFindMenuId = UIMenu.Identifier("net.qremote.mac.edit.find")
  private static let transferMenuId = UIMenu.Identifier("net.qremote.mac.transfer")
  private static let transferPrimaryId = UIMenu.Identifier("net.qremote.mac.transfer.primary")
  private static let transferQueueId = UIMenu.Identifier("net.qremote.mac.transfer.queue")
  private static let transferAllId = UIMenu.Identifier("net.qremote.mac.transfer.all")
  private static let transferAltSpeedId = UIMenu.Identifier("net.qremote.mac.transfer.altSpeed")
  private static let preferencesMenuId = UIMenu.Identifier("net.qremote.mac.preferences")

  /// Called from the generated AppDelegate's `buildMenu(with:)` override
  /// (injected by plugins/withMacCatalyst.js), after `super.buildMenu(with:)`.
  /// UIKit calls this every time the menu bar needs rebuilding (including
  /// after `UIMenuSystem.main.setNeedsRebuild()`), so it must be safe to run
  /// repeatedly and cheap - no I/O, no allocation beyond the menu objects
  /// themselves.
  public func build(_ builder: UIMenuBuilder) {
    guard builder.system == UIMenuSystem.main else { return }
    guard isMacIdiom() else { return }

    builder.insertChild(
      UIMenu(
        title: "",
        image: nil,
        identifier: Self.fileMenuId,
        options: .displayInline,
        children: [
          command(.newTransfer, input: "n", modifierFlags: [.command]),
        ]),
      atStartOfMenu: .file)

    builder.insertChild(
      UIMenu(
        title: "",
        image: nil,
        identifier: Self.viewMenuId,
        options: .displayInline,
        children: [
          command(.refresh, input: "r", modifierFlags: [.command]),
          command(.toggleSidebar, input: "s", modifierFlags: [.control, .command]),
        ]),
      atStartOfMenu: .view)

    // Catalyst's default Edit menu ships its own Find submenu
    // (UIMenu.Identifier.find), whose Find... item already owns cmd F.
    // AppKit stops at the first menu matching a key equivalent, and Edit
    // precedes View, so leaving the system Find menu in place would
    // shadow qRemote's own Find command whenever the system item is
    // disabled (no UIFindInteraction responder in this RN tree). Remove
    // it and insert qRemote's Find into Edit instead, which also matches
    // the HIG (Find belongs in Edit, not View).
    builder.remove(menu: .find)
    builder.insertChild(
      UIMenu(
        title: "",
        image: nil,
        identifier: Self.editFindMenuId,
        options: .displayInline,
        children: [
          command(.find, input: "f", modifierFlags: [.command]),
        ]),
      atStartOfMenu: .edit)

    let transferMenu = UIMenu(
      title: titles["transferMenu"] ?? "Transfer",
      image: nil,
      identifier: Self.transferMenuId,
      children: [
        UIMenu(
          title: "",
          image: nil,
          identifier: Self.transferPrimaryId,
          options: .displayInline,
          children: [
            command(.resume, input: "r", modifierFlags: [.alternate, .command]),
            command(.pause, input: "p", modifierFlags: [.alternate, .command]),
            command(.delete, input: "\u{8}", modifierFlags: [.command]),
            plainCommand(.recheck),
            plainCommand(.reannounce),
          ]),
        UIMenu(
          title: "",
          image: nil,
          identifier: Self.transferQueueId,
          options: .displayInline,
          children: [
            command(.queueTop, input: UIKeyCommand.inputUpArrow, modifierFlags: [.shift, .alternate, .command]),
            command(.queueUp, input: UIKeyCommand.inputUpArrow, modifierFlags: [.alternate, .command]),
            command(.queueDown, input: UIKeyCommand.inputDownArrow, modifierFlags: [.alternate, .command]),
            command(.queueBottom, input: UIKeyCommand.inputDownArrow, modifierFlags: [.shift, .alternate, .command]),
          ]),
        UIMenu(
          title: "",
          image: nil,
          identifier: Self.transferAllId,
          options: .displayInline,
          children: [
            command(.resumeAll, input: "r", modifierFlags: [.control, .command]),
            command(.pauseAll, input: "p", modifierFlags: [.control, .command]),
          ]),
        UIMenu(
          title: "",
          image: nil,
          identifier: Self.transferAltSpeedId,
          options: .displayInline,
          children: [
            command(.toggleAltSpeed, input: "l", modifierFlags: [.alternate, .command]),
          ]),
      ])
    builder.insertSibling(transferMenu, afterMenu: .view)

    builder.insertChild(
      UIMenu(
        title: "",
        image: nil,
        identifier: Self.preferencesMenuId,
        options: .displayInline,
        children: [
          command(.preferences, input: ",", modifierFlags: [.command]),
        ]),
      atStartOfMenu: .preferences)
  }

  /// A UIKeyCommand's `propertyList` carries the raw command id so
  /// `validate(_:)` and `dispatch(_:)` can identify which command fired
  /// without keeping a separate id <-> UIKeyCommand table. `action` targets
  /// the selector the injected AppDelegate exposes
  /// (`macCommandAction(_:)`), resolved by string so this file (and
  /// MacCommandsModule.swift, which links into every build) never needs to
  /// import or reference the app's AppDelegate type.
  private func command(_ id: MacCommandId, input: String, modifierFlags: UIKeyModifierFlags) -> UIKeyCommand {
    UIKeyCommand(
      title: titles[id.rawValue] ?? id.rawValue,
      image: nil,
      action: NSSelectorFromString("macCommandAction:"),
      input: input,
      modifierFlags: modifierFlags,
      propertyList: id.rawValue)
  }

  /// Same propertyList/action wiring as `command(_:input:modifierFlags:)`,
  /// but for menu items with no key equivalent. UIKeyCommand's `input` is
  /// documented as the key an entry is triggered by; an empty string is
  /// outside that contract, so items that don't actually carry a shortcut
  /// (Recheck, Reannounce) use plain UICommand instead. `validate(_:)` and
  /// `dispatch(_:)` already operate on `UICommand`/`propertyList`, so
  /// nothing downstream needs to change.
  private func plainCommand(_ id: MacCommandId) -> UICommand {
    UICommand(
      title: titles[id.rawValue] ?? id.rawValue,
      image: nil,
      action: NSSelectorFromString("macCommandAction:"),
      propertyList: id.rawValue)
  }

  // MARK: - Validation / dispatch

  /// Called from the generated AppDelegate's `validate(_:)` override.
  /// Commands this registry didn't create (system Edit/Undo/Redo items,
  /// text-field commands, etc.) carry no recognizable `propertyList` and are
  /// left untouched here - the override calls `super.validate(_:)` first so
  /// those keep whatever validation UIKit/ExpoAppDelegate already gave them.
  public func validate(_ command: UICommand) {
    guard let id = command.propertyList as? String, MacCommandId(rawValue: id) != nil else {
      return
    }
    command.attributes = enabled.contains(id) ? [] : .disabled
  }

  /// Called from the generated AppDelegate's `macCommandAction(_:)`, the
  /// `action` selector every command built by `command(_:input:modifierFlags:)`
  /// targets. `sender` is the fired UICommand/UIKeyCommand itself.
  public func dispatch(_ sender: Any?) {
    guard let id = (sender as? UICommand)?.propertyList as? String else { return }
    onCommand?(id)
  }

  // MARK: - Window minimum size

  // UIWindowScene.sizeRestrictions (and its minimumSize) is meaningful only
  // where the platform supports resizable scenes - Mac Catalyst is the only
  // one that matters to qRemote - so this stays gated even though the
  // current SDK no longer marks the property macCatalyst-only itself: on
  // plain iPhone/iPad the callers of setWindowMinSize never fire anyway
  // (gated at useShell().idiom === 'mac' in JS), so this is belt-and-suspenders,
  // not a functional requirement.
  private func applyMinSizeToConnectedScenes() {
    #if targetEnvironment(macCatalyst)
    guard let size = minWindowSize else { return }
    for scene in UIApplication.shared.connectedScenes {
      guard let windowScene = scene as? UIWindowScene else { continue }
      windowScene.sizeRestrictions?.minimumSize = size
    }
    #endif
  }

  /// A freshly connected scene (a new window on Mac Catalyst) doesn't exist
  /// yet when `setWindowMinSize` first runs, so this applies the stored
  /// size to every scene that connects afterwards too.
  private func observeSceneConnections() {
    #if targetEnvironment(macCatalyst)
    NotificationCenter.default.addObserver(
      forName: UIScene.willConnectNotification,
      object: nil,
      queue: .main
    ) { [weak self] notification in
      guard let self = self,
            let windowScene = notification.object as? UIWindowScene,
            let size = self.minWindowSize
      else { return }
      windowScene.sizeRestrictions?.minimumSize = size
    }
    #endif
  }
}
