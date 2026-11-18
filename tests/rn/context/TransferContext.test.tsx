import React from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransferProvider, useTransfer } from '@/context/TransferContext';
import { useServer } from '@/context/ServerContext';
import { transferApi } from '@/services/api/transfer';
import { applicationApi } from '@/services/api/application';

jest.mock('@/context/ServerContext', () => ({ useServer: jest.fn() }));
jest.mock('@/services/api/transfer', () => ({
  transferApi: {
    getGlobalTransferInfo: jest.fn(),
    getAlternativeSpeedLimitsState: jest.fn(),
    toggleAlternativeSpeedLimits: jest.fn(),
    setGlobalDownloadLimit: jest.fn(),
    setGlobalUploadLimit: jest.fn(),
  },
}));
jest.mock('@/services/api/application', () => ({
  applicationApi: { getPreferences: jest.fn(), setPreferences: jest.fn() },
}));

function Consumer({ onRender }: { onRender: (ctx: ReturnType<typeof useTransfer>) => void }) {
  const ctx = useTransfer();
  onRender(ctx);
  return <Text>{ctx.error ?? 'ok'}</Text>;
}

async function renderProvider() {
  let latest: ReturnType<typeof useTransfer> | undefined;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={queryClient}>
      <TransferProvider>
        <Consumer onRender={(ctx) => (latest = ctx)} />
      </TransferProvider>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(latest!.transferInfo).not.toBeNull());
  return () => latest!;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(useServer)
    .mockReturnValue({ isConnected: true } as unknown as ReturnType<typeof useServer>);
  jest.mocked(transferApi.getGlobalTransferInfo).mockResolvedValue({
    dl_info_speed: 0,
    up_info_speed: 0,
  } as never);
  jest.mocked(transferApi.getAlternativeSpeedLimitsState).mockResolvedValue(false);
  jest.mocked(applicationApi.getPreferences).mockResolvedValue({} as never);
});

describe('TransferContext mutations', () => {
  const cases: [string, (ctx: ReturnType<typeof useTransfer>) => Promise<void>][] = [
    ['toggleAlternativeSpeedLimits', (c) => c.toggleAlternativeSpeedLimits()],
    ['setDownloadLimit', (c) => c.setDownloadLimit(1024)],
    ['setUploadLimit', (c) => c.setUploadLimit(1024)],
    ['setAltDownloadLimit', (c) => c.setAltDownloadLimit(1024)],
    ['setAltUploadLimit', (c) => c.setAltUploadLimit(1024)],
  ];

  function failNextCall(name: string) {
    const err = new Error(`${name} failed`);
    if (name === 'toggleAlternativeSpeedLimits') {
      jest.mocked(transferApi.toggleAlternativeSpeedLimits).mockRejectedValueOnce(err);
    } else if (name === 'setDownloadLimit') {
      jest.mocked(transferApi.setGlobalDownloadLimit).mockRejectedValueOnce(err);
    } else if (name === 'setUploadLimit') {
      jest.mocked(transferApi.setGlobalUploadLimit).mockRejectedValueOnce(err);
    } else {
      jest.mocked(applicationApi.setPreferences).mockRejectedValueOnce(err);
    }
  }

  it.each(cases)('%s rejects when the server call fails', async (name, call) => {
    const getLatest = await renderProvider();
    failNextCall(name);
    await expect(call(getLatest())).rejects.toThrow(`${name} failed`);
    // A rejected setting is reported by the caller, not as a screen-level error.
    expect(getLatest().error).toBeNull();
  });

  it.each(cases)('%s resolves when the server call succeeds', async (_name, call) => {
    const getLatest = await renderProvider();
    await expect(call(getLatest())).resolves.toBeUndefined();
  });

  it('sends alt limits under alt_dl_limit / alt_up_limit', async () => {
    const getLatest = await renderProvider();
    await getLatest().setAltDownloadLimit(2048);
    await getLatest().setAltUploadLimit(4096);
    expect(applicationApi.setPreferences).toHaveBeenCalledWith({ alt_dl_limit: 2048 });
    expect(applicationApi.setPreferences).toHaveBeenCalledWith({ alt_up_limit: 4096 });
  });
});

describe('TransferContext malformed transfer/info (#334)', () => {
  it.each([
    ['a text body', 'not json'],
    ['an empty body', ''],
    ['undefined', undefined],
  ])('does not expose transferInfo for %s', async (_label, body) => {
    jest.mocked(transferApi.getGlobalTransferInfo).mockResolvedValue(body as never);
    let latest: ReturnType<typeof useTransfer> | undefined;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await render(
      <QueryClientProvider client={queryClient}>
        <TransferProvider>
          <Consumer onRender={(ctx) => (latest = ctx)} />
        </TransferProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(transferApi.getGlobalTransferInfo).toHaveBeenCalled());
    await waitFor(() =>
      expect(queryClient.getQueryCache().find({ queryKey: ['transfer'] })?.state.status).toBe(
        'error',
      ),
    );
    expect(latest!.transferInfo).toBeNull();
  });
});
