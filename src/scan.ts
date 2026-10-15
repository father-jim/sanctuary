import { HttpSession, type Fetch } from './http.ts';
import type { Probe, ProbeResult } from './probes/types.ts';

export interface ScanResult extends ProbeResult {
  id: string;
}

export interface ScanOptions {
  concurrency?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  fetch?: Fetch;
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (email: string) => email.length <= 254 && EMAIL_PATTERN.test(email);

/** Runs one probe with its own cookie jar and deadline. Never throws. */
export async function runProbe(probe: Probe, email: string, options: ScanOptions = {}): Promise<ScanResult> {
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 15_000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  try {
    const http = new HttpSession({ fetch: options.fetch, signal });
    return { id: probe.id, ...(await probe.check(email, http)) };
  } catch (err) {
    const detail = timeout.aborted
      ? 'The site took too long to answer'
      : `Request failed: ${err instanceof Error ? err.message : String(err)}`;
    return { id: probe.id, status: 'unknown', detail };
  }
}

/** Yields each result as soon as its probe finishes. */
export async function* scan(probes: Probe[], email: string, options: ScanOptions = {}): AsyncGenerator<ScanResult> {
  const normalized = normalizeEmail(email);
  const queue = [...probes];
  const ready: ScanResult[] = [];
  let wake: (() => void) | undefined;
  let running = 0;

  const startNext = () => {
    const probe = queue.shift();
    if (!probe) return;
    running++;
    runProbe(probe, normalized, options).then((result) => {
      running--;
      ready.push(result);
      if (!options.signal?.aborted) startNext();
      wake?.();
    });
  };

  for (let i = 0; i < (options.concurrency ?? 6); i++) startNext();

  while (running > 0 || ready.length > 0) {
    if (ready.length === 0) await new Promise<void>((resolve) => (wake = resolve));
    while (ready.length > 0) yield ready.shift()!;
  }
}
