import { directory, type Service } from './directory.ts';

// Senders rarely use their bare domain: GitHub mails from notifications.github.com,
// Spotify from e.spotify.com. We reduce each sender to its registrable domain
// and match that against the directory.

// Enough multi-label public suffixes to cover the common ones; this is not a
// full public-suffix list, so an unusual ccTLD may reduce one label short.
const MULTI_LABEL_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'me.uk', 'ac.uk', 'gov.uk',
  'com.au', 'net.au', 'org.au', 'co.nz', 'co.za',
  'com.br', 'com.mx', 'co.jp', 'co.in', 'co.kr',
]);

export function registrableDomain(host: string): string {
  const labels = host.toLowerCase().replace(/\.$/, '').split('.');
  if (labels.length <= 2) return labels.join('.');
  const lastTwo = labels.slice(-2).join('.');
  if (MULTI_LABEL_SUFFIXES.has(lastTwo)) return labels.slice(-3).join('.');
  return lastTwo;
}

export function domainFromAddress(address: string): string | undefined {
  const at = address.lastIndexOf('@');
  if (at < 0) return undefined;
  const domain = address.slice(at + 1).trim().toLowerCase();
  return domain && domain.includes('.') ? domain : undefined;
}

const byRegistrable = new Map<string, Service>();
for (const service of directory) {
  byRegistrable.set(registrableDomain(service.domain), service);
}

/** The directory service a sender address belongs to, if any. */
export function matchService(address: string): Service | undefined {
  const domain = domainFromAddress(address);
  if (!domain) return undefined;
  return byRegistrable.get(registrableDomain(domain));
}
