import Constants from 'expo-constants';

/**
 * Get the app version
 * Version comes from package.json (single source of truth)
 * app.config.js imports from package.json, and Expo exposes it via Constants.expoConfig
 */
export const APP_VERSION = Constants.expoConfig?.version || 'N/A';

/**
 * Get app version (utility function for consistency)
 */
export function getAppVersion(): string {
  return APP_VERSION;
}

