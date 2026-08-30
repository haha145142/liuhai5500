const inflight = new Map<string, Promise<unknown>>();

export async function withTimeout<T>(task: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function dedupeRequest<T>(key: string, task: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const request = task().finally(() => {
    if (inflight.get(key) === request) inflight.delete(key);
  });
  inflight.set(key, request);
  return request;
}

export async function guardedRequest<T>(
  key: string,
  task: () => Promise<T>,
  timeoutMs: number,
  fallback: T,
): Promise<T> {
  return dedupeRequest(key, () => withTimeout(task(), timeoutMs, fallback));
}
