
type RetryOptions = {
  attempts: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterRatio?: number;
  shouldRetry?: (error: unknown) => boolean;
};

const DEFAULT_TOOL_ACTION_RETRY_ATTEMPTS = 3;
const DEFAULT_TOOL_ACTION_RETRY_BASE_DELAY_MS = 400;
const DEFAULT_TOOL_ACTION_RETRY_MAX_DELAY_MS = 2000;
const DEFAULT_TOOL_ACTION_RETRY_JITTER_RATIO = 0.2;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}


export async function retryAsync<T>(task: () => Promise<T>, options: RetryOptions): Promise<T> {
  const attempts = Math.max(1, options.attempts);
  const baseDelayMs = Math.max(
    0,
    options.baseDelayMs ?? DEFAULT_TOOL_ACTION_RETRY_BASE_DELAY_MS
  );
  const maxDelayMs = Math.max(
    0,
    options.maxDelayMs ?? DEFAULT_TOOL_ACTION_RETRY_MAX_DELAY_MS
  );
  const jitterRatio = Math.max(
    0,
    options.jitterRatio ?? DEFAULT_TOOL_ACTION_RETRY_JITTER_RATIO
  );
  const shouldRetry = options.shouldRetry ?? (() => true);

  let attempt = 0;
  while (true) {
    attempt += 1;
    try {
      return await task();
    } catch (error) {
      const canRetry = attempt < attempts && shouldRetry(error);
      if (!canRetry) throw error;

      const exponentialDelayMs = baseDelayMs * Math.pow(2, attempt - 1);
      const delayMs = Math.min(maxDelayMs, exponentialDelayMs);
      const jitterMs = Math.floor(delayMs * jitterRatio * Math.random());
      await sleep(delayMs + jitterMs);
    }
  }
}