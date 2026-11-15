/**
 * logs.tsx — redirects the `/logs` URL to the Server Logs screen, which lives
 * in the Settings stack (app/(tabs)/settings/logs.tsx).
 *
 * Key exports: LegacyLogsRedirect (default)
 */
import { Redirect } from 'expo-router';

export default function LegacyLogsRedirect() {
  return <Redirect href="/settings/logs" />;
}
