// LegacyLogsRedirect.test.tsx — the old `/logs` URL (formerly a hidden
// `(tabs)/logs` tab) keeps working by redirecting to the Settings stack.
import React from 'react';
import { render } from '@testing-library/react-native';
import LegacyLogsRedirect from '@/app/logs';

const mockRedirect = jest.fn((_props: { href: string }) => null);

jest.mock('expo-router', () => ({
  Redirect: (props: { href: string }) => mockRedirect(props),
}));

describe('app/logs.tsx', () => {
  it('redirects to /settings/logs', async () => {
    await render(<LegacyLogsRedirect />);
    expect(mockRedirect).toHaveBeenCalledWith({ href: '/settings/logs' });
  });
});
