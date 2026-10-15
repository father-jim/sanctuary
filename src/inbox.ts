import { ImapFlow, type ListResponse, type MailboxObject } from 'imapflow';
import { domainFromAddress, matchService, registrableDomain } from './match.ts';

export interface InboxCredentials {
  email: string;
  password: string;
  host: string;
  port: number;
}

export interface SenderGroup {
  /** Registrable domain, e.g. "spotify.com". */
  domain: string;
  /** A representative From address seen for this domain. */
  address: string;
  /** Display name from the From header, when the sender set one. */
  name?: string;
  messageCount: number;
  /** Most recent message date seen, ISO string. */
  lastDate?: string;
  sampleSubject?: string;
}

export type InboxEvent =
  | { type: 'status'; message: string }
  | { type: 'progress'; scanned: number; total: number }
  | { type: 'done'; matched: Array<{ id: string } & SenderGroup>; others: SenderGroup[]; scanned: number };

/** Most recent messages scanned per mailbox. Envelopes are light, but inboxes
 *  can be enormous and we only need a representative view of who writes to you. */
const MAX_MESSAGES = 6000;

/** Prefer an "all mail" style mailbox so archived senders are included too. */
function pickMailboxes(boxes: ListResponse[]): string[] {
  const all = boxes.find((b) => b.specialUse === '\\All');
  if (all) return [all.path];
  const names = new Set(boxes.map((b) => b.path));
  const chosen = ['INBOX'].filter((n) => names.has(n));
  const archive = boxes.find((b) => b.specialUse === '\\Archive');
  if (archive) chosen.push(archive.path);
  return chosen.length ? chosen : ['INBOX'];
}

export async function* scanInbox(creds: InboxCredentials, signal?: AbortSignal): AsyncGenerator<InboxEvent> {
  const client = new ImapFlow({
    host: creds.host,
    port: creds.port,
    secure: true,
    auth: { user: creds.email, pass: creds.password },
    logger: false,
    // Fail fast on a wrong host rather than hanging the whole scan.
    socketTimeout: 60_000,
  });

  const groups = new Map<string, SenderGroup>();
  let scanned = 0;

  try {
    yield { type: 'status', message: 'Connecting…' };
    await client.connect();

    const boxes = await client.list();
    const mailboxes = pickMailboxes(boxes);

    for (const path of mailboxes) {
      if (signal?.aborted) break;
      const lock = await client.getMailboxLock(path);
      try {
        const box = client.mailbox as MailboxObject;
        const total = Math.min(box.exists, MAX_MESSAGES);
        if (total === 0) continue;
        const start = Math.max(1, box.exists - MAX_MESSAGES + 1);
        yield { type: 'status', message: `Reading ${total.toLocaleString()} messages in ${path}…` };

        for await (const msg of client.fetch(`${start}:*`, { envelope: true })) {
          if (signal?.aborted) break;
          scanned++;
          const from = msg.envelope?.from?.[0];
          const address = from?.address?.toLowerCase();
          const domain = address && domainFromAddress(address);
          if (address && domain) {
            record(groups, address, from?.name, domain, msg.envelope?.date, msg.envelope?.subject);
          }
          if (scanned % 250 === 0) yield { type: 'progress', scanned, total };
        }
      } finally {
        lock.release();
      }
    }

    const matched: Array<{ id: string } & SenderGroup> = [];
    const others: SenderGroup[] = [];
    for (const group of groups.values()) {
      const service = matchService(group.address);
      if (service) matched.push({ id: service.id, ...group });
      else others.push(group);
    }
    // Collapse duplicate service matches (several subdomains → one service).
    const mergedMatched = mergeById(matched);
    others.sort((a, b) => b.messageCount - a.messageCount);
    yield { type: 'done', matched: mergedMatched, others, scanned };
  } finally {
    await client.logout().catch(() => client.close());
  }
}

function record(
  groups: Map<string, SenderGroup>,
  address: string,
  name: string | undefined,
  domain: string,
  date: Date | undefined,
  subject: string | undefined,
) {
  const key = registrableDomain(domain);
  const iso = date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : undefined;
  const existing = groups.get(key);
  if (existing) {
    existing.messageCount++;
    if (name && !existing.name) existing.name = name;
    if (iso && (!existing.lastDate || iso > existing.lastDate)) {
      existing.lastDate = iso;
      if (subject) existing.sampleSubject = subject;
    }
  } else {
    groups.set(key, {
      domain: key,
      address,
      name: name || undefined,
      messageCount: 1,
      lastDate: iso,
      sampleSubject: subject || undefined,
    });
  }
}

function mergeById(matched: Array<{ id: string } & SenderGroup>): Array<{ id: string } & SenderGroup> {
  const byId = new Map<string, { id: string } & SenderGroup>();
  for (const m of matched) {
    const existing = byId.get(m.id);
    if (!existing) {
      byId.set(m.id, m);
    } else {
      existing.messageCount += m.messageCount;
      if (m.lastDate && (!existing.lastDate || m.lastDate > existing.lastDate)) existing.lastDate = m.lastDate;
    }
  }
  return [...byId.values()].sort((a, b) => b.messageCount - a.messageCount);
}
