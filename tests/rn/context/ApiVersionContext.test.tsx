import React from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import { ApiVersionProvider, useApiFeatures } from '@/context/ApiVersionContext';
import { apiClient } from '@/services/api/client';

jest.mock('@/services/api/client', () => ({
  apiClient: {
    getApiVersion: jest.fn(),
  },
}));

let mockIsConnected = false;
jest.mock('@/context/ServerContext', () => ({
  useServer: () => ({ isConnected: mockIsConnected }),
}));

function Consumer({ onRender }: { onRender: (ctx: ReturnType<typeof useApiFeatures>) => void }) {
  const ctx = useApiFeatures();
  onRender(ctx);
  return <Text>{ctx.apiVersion ?? 'none'}</Text>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsConnected = false;
});

describe('ApiVersionContext', () => {
  it('throws when useApiFeatures used outside provider', async () => {
    const Bad = () => {
      useApiFeatures();
      return null;
    };
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(render(<Bad />)).rejects.toThrow(
      'useApiFeatures must be used within ApiVersionProvider'
    );
    spy.mockRestore();
  });

  it('apiVersion is null and V5 feature defaults apply when not connected', async () => {
    mockIsConnected = false;
    (apiClient.getApiVersion as jest.Mock).mockReturnValue('2.9.0');
    let latest: ReturnType<typeof useApiFeatures> | undefined;
    await render(
      <ApiVersionProvider>
        <Consumer onRender={(ctx) => (latest = ctx)} />
      </ApiVersionProvider>
    );
    await waitFor(() => expect(latest).toBeDefined());
    expect(latest!.apiVersion).toBeNull();
    expect(latest!.features.useStartStopEndpoints).toBe(true);
  });

  it('derives apiVersion and features from apiClient when connected (pre-2.11)', async () => {
    mockIsConnected = true;
    (apiClient.getApiVersion as jest.Mock).mockReturnValue('2.8.3');
    let latest: ReturnType<typeof useApiFeatures> | undefined;
    await render(
      <ApiVersionProvider>
        <Consumer onRender={(ctx) => (latest = ctx)} />
      </ApiVersionProvider>
    );
    await waitFor(() => expect(latest).toBeDefined());
    expect(latest!.apiVersion).toBe('2.8.3');
    expect(latest!.features.useStartStopEndpoints).toBe(false);
    expect(latest!.features.hasRatioLimitFields).toBe(true);
  });

  it('derives V5 features when connected with a >=2.11 version', async () => {
    mockIsConnected = true;
    (apiClient.getApiVersion as jest.Mock).mockReturnValue('2.11.2');
    let latest: ReturnType<typeof useApiFeatures> | undefined;
    await render(
      <ApiVersionProvider>
        <Consumer onRender={(ctx) => (latest = ctx)} />
      </ApiVersionProvider>
    );
    await waitFor(() => expect(latest).toBeDefined());
    expect(latest!.apiVersion).toBe('2.11.2');
    expect(latest!.features.useStartStopEndpoints).toBe(true);
    expect(latest!.features.supportsSetCookies).toBe(true);
  });
});
