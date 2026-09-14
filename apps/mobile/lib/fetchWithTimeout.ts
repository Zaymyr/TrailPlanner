const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

export async function fetchWithTimeout(
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1] = {},
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const upstreamSignal = init?.signal;
  const abortFromUpstream = () => controller.abort(upstreamSignal?.reason);

  if (upstreamSignal?.aborted) {
    abortFromUpstream();
  } else {
    upstreamSignal?.addEventListener('abort', abortFromUpstream, { once: true });
  }

  const timeout = setTimeout(() => controller.abort(new Error('Request timed out')), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    upstreamSignal?.removeEventListener('abort', abortFromUpstream);
  }
}
