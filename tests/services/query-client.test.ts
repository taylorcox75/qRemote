import { QueryClient } from '@tanstack/react-query';
import { queryClient } from '@/services/query-client';

describe('queryClient', () => {
  it('exports a configured QueryClient instance', () => {
    expect(queryClient).toBeInstanceOf(QueryClient);
  });

  it('is configured with the expected default query options', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.retry).toBe(2);
    expect(defaults.queries?.staleTime).toBe(2000);
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
  });
});
