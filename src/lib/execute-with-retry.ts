const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_BASE_DELAY_MS = 250;
const MAX_DELAY_MS = 8000;

export type ExecuteWithRetryOptions = {
  readonly maxAttempts?: number;
  readonly baseDelayMs?: number;
};

function computeDelayMs(attemptIndexOneBased: number, baseDelayMs: number): number {
  const exponential: number = baseDelayMs * Math.pow(2, attemptIndexOneBased - 1);
  const jitter: number = exponential * (0.5 + Math.random() * 0.5);
  return Math.round(Math.min(jitter, MAX_DELAY_MS));
}

function sleepMs(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

/**
 * Returns true when a failed write may succeed if retried (network / overload).
 */
export function isRetryableSyncFailure(err: unknown): boolean {
  if (err == null) {
    return false;
  }
  if (err instanceof TypeError) {
    return true;
  }
  if (typeof err !== "object") {
    return false;
  }
  const record = err as Record<string, unknown>;
  const message: string = String(record.message ?? "").toLowerCase();
  if (message.includes("failed to fetch") || message.includes("network")) {
    return true;
  }
  if (message.includes("timeout") || message.includes("timed out")) {
    return true;
  }
  const code: string = String(record.code ?? "");
  if (code === "PGRST020" || code === "PGRST002") {
    return true;
  }
  const status = record.status as number | undefined;
  if (typeof status === "number" && status >= 500) {
    return true;
  }
  if (status === 429) {
    return true;
  }
  return false;
}

/**
 * Runs an async operation with exponential backoff retries for transient failures.
 */
export async function executeWithRetry<T>(
  executeOperation: () => Promise<T>,
  options: ExecuteWithRetryOptions = {},
): Promise<T> {
  const maxAttempts: number = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs: number = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await executeOperation();
    } catch (err) {
      lastError = err;
      const retryable: boolean = isRetryableSyncFailure(err);
      if (!retryable || attempt === maxAttempts) {
        throw err;
      }
      await sleepMs(computeDelayMs(attempt, baseDelayMs));
    }
  }
  throw lastError;
}
