import { summarizeAddBatch } from '@/utils/add-torrent-batch';

const DUP = 'This torrent already exists or could not be added.';
const ok: PromiseSettledResult<unknown> = { status: 'fulfilled', value: undefined };
const dup: PromiseSettledResult<unknown> = { status: 'rejected', reason: new Error(DUP) };
const net: PromiseSettledResult<unknown> = {
  status: 'rejected',
  reason: new Error('Network error'),
};

describe('summarizeAddBatch', () => {
  it('reports success when every request succeeded', () => {
    expect(summarizeAddBatch([ok, ok], DUP)).toMatchObject({
      outcome: 'success',
      succeeded: [0, 1],
      duplicateFailures: [],
      otherFailures: [],
    });
  });

  it('keeps a single-request failure a failure', () => {
    const summary = summarizeAddBatch([dup], DUP);
    expect(summary.outcome).toBe('failed');
    expect(summary.firstError).toBe((dup as PromiseRejectedResult).reason);
  });

  it('treats a duplicate-only failure alongside a success as partial success', () => {
    expect(summarizeAddBatch([dup, ok, dup], DUP)).toMatchObject({
      outcome: 'partialDuplicates',
      succeeded: [1],
      duplicateFailures: [0, 2],
      otherFailures: [],
    });
  });

  it('flags a non-duplicate failure next to a success as partialFailed', () => {
    const summary = summarizeAddBatch([dup, ok, net], DUP);
    expect(summary).toMatchObject({
      outcome: 'partialFailed',
      succeeded: [1],
      duplicateFailures: [0],
      otherFailures: [2],
    });
    expect(summary.firstError).toBe((dup as PromiseRejectedResult).reason);
    expect(summary.firstOtherError).toBe((net as PromiseRejectedResult).reason);
  });

  it('reports failed when nothing succeeded, whatever the reasons', () => {
    expect(summarizeAddBatch([dup, net], DUP).outcome).toBe('failed');
    expect(summarizeAddBatch([], DUP).outcome).toBe('failed');
  });

  it('matches non-Error rejection reasons by their string form', () => {
    expect(summarizeAddBatch([ok, { status: 'rejected', reason: DUP }], DUP).outcome).toBe(
      'partialDuplicates',
    );
  });
});
