import type { HttpSession } from '../http.ts';

/**
 * `unknown` covers rate limits, bot walls, changed endpoints and network
 * errors. A probe must never report `not_found` unless the site actually
 * said the email is free, or a real account would be silently hidden.
 */
export type ProbeStatus = 'found' | 'not_found' | 'unknown';

export interface ProbeResult {
  status: ProbeStatus;
  /** Why the result is `unknown`, or extra context such as a public username. */
  detail?: string;
}

export interface Probe {
  /** Matches an entry in the removal directory (src/directory.ts). */
  id: string;
  check(email: string, http: HttpSession): Promise<ProbeResult>;
}

export const found = (detail?: string): ProbeResult => ({ status: 'found', detail });
export const notFound = (): ProbeResult => ({ status: 'not_found' });
export const unknown = (detail: string): ProbeResult => ({ status: 'unknown', detail });

/** Standard explanation for a response the probe does not recognise. */
export function unexpected(status: number): ProbeResult {
  if (status === 429) return unknown('Rate limited, try again later');
  if (status === 403) return unknown('Blocked by the site’s bot protection');
  return unknown(`Unexpected response (HTTP ${status})`);
}
