import Foundation

/// Thread-safe host allowlist, written from JS via InsecureCertAllowlistModule
/// and read from RCTHTTPRequestHandler+InsecureCert.m's TLS challenge handler.
/// `@objc` so the Objective-C category (which has no other way to reach into
/// JS/Expo-module state) can call it directly.
@objc(InsecureCertTrustStore)
public class InsecureCertTrustStore: NSObject {
  @objc public static let shared = InsecureCertTrustStore()

  private let lock = NSLock()
  private var hosts: Set<String> = []

  @objc public func setAllowedHosts(_ hosts: [String]) {
    lock.lock()
    self.hosts = Set(hosts.map { $0.lowercased() })
    lock.unlock()
  }

  @objc public func isHostAllowed(_ host: String) -> Bool {
    lock.lock()
    defer { lock.unlock() }
    return hosts.contains(host.lowercased())
  }
}
