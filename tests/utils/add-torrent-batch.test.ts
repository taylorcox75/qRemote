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

  it('reports allDuplicates when every request answered the duplicate message', () => {
    const summary = summarizeAddBatch([dup], DUP);
    expect(summary).toMatchObject({
      outcome: 'allDuplicates',
      resolved: [0],
      hasRetryableFailures: false,
    });
    expect(summary.firstError).toBe((dup as PromiseRejectedResult).reason);
    expect(summarizeAddBatch([dup, dup], DUP).outcome).toBe('allDuplicates');
  });

  it('keeps a single non-duplicate failure a retryable failure', () => {
    expect(summarizeAddBatch([net], DUP)).toMatchObject({
      outcome: 'failed',
      resolved: [],
      otherFailures: [0],
      hasRetryableFailures: true,
    });
  });

  it('lists succeeded and duplicate requests as resolved, in order', () => {
    expect(summarizeAddBatch([net, dup, ok, net, ok], DUP)).toMatchObject({
      outcome: 'partialFailed',
      resolved: [1, 2, 4],
      otherFailures: [0, 3],
      hasRetryableFailures: true,
    });
    expect(summarizeAddBatch([ok, dup], DUP)).toMatchObject({
      resolved: [0, 1],
      hasRetryableFailures: false,
    });
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
    expect(summarizeAddBatch([dup, net], DUP)).toMatchObject({
      outcome: 'failed',
      resolved: [0],
      hasRetryableFailures: true,
    });
    expect(summarizeAddBatch([], DUP).outcome).toBe('failed');
  });

  it('matches non-Error rejection reasons by their string form', () => {
    expect(summarizeAddBatch([ok, { status: 'rejected', reason: DUP }], DUP).outcome).toBe(
      'partialDuplicates',
    );
  });
});
