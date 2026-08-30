import ExpoModulesCore
import AudioToolbox

/// Plays short bundled tones via AudioServicesPlaySystemSound. SystemSoundIDs
/// are cheap to create but not free, so each name is resolved and cached once.
public class UiSoundsModule: Module {
  private var soundIDs: [String: SystemSoundID] = [:]

  public func definition() -> ModuleDefinition {
    Name("UiSounds")

    Function("play") { (name: String) in
      self.play(name)
    }
  }

  private func play(_ name: String) {
    if let cached = soundIDs[name] {
      AudioServicesPlaySystemSound(cached)
      return
    }

    guard let url = Bundle.main.url(forResource: name, withExtension: "wav") else {
      return
    }

    var soundID: SystemSoundID = 0
    guard AudioServicesCreateSystemSoundID(url as CFURL, &soundID) == kAudioServicesNoError else {
      return
    }

    soundIDs[name] = soundID
    AudioServicesPlaySystemSound(soundID)
  }
}
