import ExpoModulesCore

public class InsecureCertAllowlistModule: Module {
  public func definition() -> ModuleDefinition {
    Name("InsecureCertAllowlist")

    Function("setAllowedHosts") { (hosts: [String]) in
      InsecureCertTrustStore.shared.setAllowedHosts(hosts)
    }
  }
}
