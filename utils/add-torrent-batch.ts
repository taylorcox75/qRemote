import { getErrorMessage } from '@/utils/error';

/**
 * How a batch of parallel `torrents/add` requests turned out.
 *
 * qBit 4.x–5.1 answers 200 `Fails.` only when *nothing* in that one request was
 * added (all duplicates, usually — with merge_trackers on, the trackers were even
 * merged into the existing torrent). The add screens fire several requests at
 * once (files, URLs, one per cart indexer group), so one request answering
 * `Fails.` must not fail the whole submit when the others added torrents.
 */
export type AddBatchOutcome =
  /** Every request succeeded. */
  | 'success'
  /** Some succeeded; every failure was the "already exists or not added" answer. */
  | 'partialDuplicates'
  /** Some succeeded; at least one failed for another reason. */
  | 'partialFailed'
  /** Nothing succeeded (or there were no requests). */
  | 'failed';

export interface AddBatchSummary {
  outcome: AddBatchOutcome;
  /** Indexes (into the settled results) of the requests that succeeded. */
  succeeded: number[];
  /** Indexes of the requests that failed with `duplicateMessage`. */
  duplicateFailures: number[];
  /** Indexes of the requests that failed for any other reason. */
  otherFailures: number[];
  /** The first rejection reason, for the all-failed error toast. */
  firstError: unknown;
  /** The first rejection reason that is not `duplicateMessage`. */
  firstOtherError: unknown;
}

/**
 * `duplicateMessage` is `TORRENT_ADD_FAILED_MESSAGE` from `services/api/torrents.ts`,
 * passed in so this stays a pure module (that file pulls in axios + expo-file-system).
 */
export function summarizeAddBatch(
  results: PromiseSettledResult<unknown>[],
  duplicateMessage: string,
): AddBatchSummary {
  const succeeded: number[] = [];
  const duplicateFailures: number[] = [];
  const otherFailures: number[] = [];
  let firstError: unknown;
  let firstOtherError: unknown;
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      succeeded.push(index);
      return;
    }
    if (duplicateFailures.length + otherFailures.length === 0) firstError = result.reason;
    if (getErrorMessage(result.reason) === duplicateMessage) duplicateFailures.push(index);
    else {
      if (otherFailures.length === 0) firstOtherError = result.reason;
      otherFailures.push(index);
    }
  });

  let outcome: AddBatchOutcome;
  if (succeeded.length === 0) outcome = 'failed';
  else if (otherFailures.length > 0) outcome = 'partialFailed';
  else if (duplicateFailures.length > 0) outcome = 'partialDuplicates';
  else outcome = 'success';

  return { outcome, succeeded, duplicateFailures, otherFailures, firstError, firstOtherError };
}
