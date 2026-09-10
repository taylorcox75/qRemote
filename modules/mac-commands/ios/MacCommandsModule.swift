import ExpoModulesCore

private let onCommandEventName = "onCommand"

/// JS entry point (see ../index.ts) for MacMenuRegistry, the object that
/// actually builds and drives qRemote's Mac Catalyst app menu. This module
/// only bridges JS calls to that registry and forwards the commands it
/// fires back out as the "onCommand" event - see MacMenuRegistry.swift for
/// the menu-building and UIKit-facing logic.
public class MacCommandsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MacCommands")

    Events(onCommandEventName)

    // Only wire MacMenuRegistry's dispatch closure while JS actually has an
    // "onCommand" listener attached, mirroring expo-clipboard's
    // OnStartObserving/OnStopObserving pattern - a fired menu command with
    // nowhere to go is simply dropped rather than queued.
    OnStartObserving {
      MacMenuRegistry.shared.setOnCommand { [weak self] id in
        self?.sendEvent(onCommandEventName, ["id": id])
      }
    }

    OnStopObserving {
      MacMenuRegistry.shared.setOnCommand(nil)
    }

    OnDestroy {
      MacMenuRegistry.shared.setOnCommand(nil)
    }

    // Thread-safe to call directly: reads a single UIDevice enum value with
    // no dependency on MacMenuRegistry's own mutable state.
    Function("isMacIdiom") { () -> Bool in
      MacMenuRegistry.shared.isMacIdiom()
    }

    Function("setEnabledCommands") { (ids: [String]) in
      MacMenuRegistry.shared.setEnabledCommands(ids)
    }

    Function("setMenuTitles") { (titles: [String: String]) in
      MacMenuRegistry.shared.setMenuTitles(titles)
    }

    Function("setWindowMinSize") { (width: Double, height: Double) in
      MacMenuRegistry.shared.setWindowMinSize(width: width, height: height)
    }
  }
}
