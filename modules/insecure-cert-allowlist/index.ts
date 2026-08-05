/**
 * index.ts — JS entry point for the InsecureCertAllowlist local native module.
 *
 * See ios/RCTHTTPRequestHandler+InsecureCert.m for why this exists: React
 * Native's default iOS HTTP handler never implements the TLS challenge
 * delegate method, so it always falls through to default system trust
 * evaluation with no override point — not even for a certificate the user
 * has manually trusted on-device. This module is the only bridge between a
 * per-server "allow self-signed certificate" opt-in in JS and that native
 * challenge handling.
 */
interface InsecureCertAllowlistNativeModule {
  setAllowedHosts(hosts: string[]): void;
}

// Deliberately `require`d rather than statically imported: expo-modules-core
// ships untranspiled TS/ESM source that plain ts-jest (the `node` Jest
// project — see services/server-manager.ts, which imports this file) can't
// parse. A static `import` gets hoisted to an unconditional require outside
// this try/catch; a runtime require keeps the failure containable here.
let nativeModule: InsecureCertAllowlistNativeModule | null = null;
try {
  const { requireNativeModule } = require('expo-modules-core') as {
    requireNativeModule: (name: string) => InsecureCertAllowlistNativeModule;
  };
  nativeModule = requireNativeModule('InsecureCertAllowlist');
} catch {
  // Not available (e.g. the `node` Jest project, or jest-expo mocking native
  // modules generically without knowing this one). Safe to no-op — the
  // toggle this feeds is iOS-only.
  nativeModule = null;
}

/** Push the current set of hostnames allowed to bypass TLS trust evaluation. */
export function setInsecureCertAllowedHosts(hosts: string[]): void {
  nativeModule?.setAllowedHosts(hosts);
}
