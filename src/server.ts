import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { directory } from './directory.ts';
import { isEmail, normalizeEmail } from './email.ts';
import { scanInbox, type InboxEvent } from './inbox.ts';
import { providerForEmail } from './providers.ts';

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT ?? 4545);
const PUBLIC_DIR = join(import.meta.dirname, '..', 'public');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<any> {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 100_000) throw new Error('Body too large');
  }
  return JSON.parse(raw);
}

// The server makes IMAP connections with credentials the page supplies, so it
// must only answer pages loaded from this machine. The Host check blocks
// DNS-rebinding pages; requiring a JSON content type blocks plain cross-site
// form posts.
function isLocalRequest(req: IncomingMessage): boolean {
  const host = req.headers.host ?? '';
  return host === `${HOST}:${PORT}` || host === `localhost:${PORT}`;
}

function sendEvent(res: ServerResponse, event: InboxEvent | { type: 'error'; error: string }) {
  res.write(JSON.stringify(event) + '\n');
}

async function handleInboxScan(req: IncomingMessage, res: ServerResponse) {
  if (!req.headers['content-type']?.startsWith('application/json')) {
    return sendJson(res, 415, { error: 'Expected JSON' });
  }
  let body: any;
  try {
    body = await readJson(req);
  } catch {
    return sendJson(res, 400, { error: 'Invalid JSON' });
  }

  const email = normalizeEmail(String(body?.email ?? ''));
  const password = String(body?.password ?? '');
  if (!isEmail(email)) return sendJson(res, 400, { error: 'Enter a valid email address' });
  if (!password) return sendJson(res, 400, { error: 'Enter your email password or app password' });
  if (body?.ownsEmail !== true) {
    return sendJson(res, 400, { error: 'Only scan a mailbox that belongs to you' });
  }

  const preset = providerForEmail(email);
  const host = String(body?.host || preset?.host || '').trim();
  const port = Number(body?.port || preset?.port || 993);
  if (!host) {
    return sendJson(res, 400, {
      error: 'Could not guess your mail server. Enter the IMAP host and port.',
      needsServer: true,
    });
  }

  const controller = new AbortController();
  res.on('close', () => controller.abort());
  res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' });

  try {
    for await (const event of scanInbox({ email, password, host, port }, controller.signal)) {
      if (controller.signal.aborted) break;
      sendEvent(res, event);
    }
  } catch (err) {
    sendEvent(res, { type: 'error', error: describeImapError(err) });
  }
  res.end();
}

/** Turns IMAP library errors into something a person can act on, without
 *  echoing anything that might contain the password. */
function describeImapError(err: unknown): string {
  const code = (err as any)?.authenticationFailed ? 'auth' : (err as any)?.code;
  if (code === 'auth' || /auth/i.test(String((err as any)?.response ?? ''))) {
    return 'Sign-in was rejected. Check the address and use an app password if your provider needs one.';
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'Could not reach that mail server. Check the IMAP host.';
  if (code === 'ECONNREFUSED') return 'The mail server refused the connection. Check the port.';
  if (code === 'ETIMEDOUT' || code === 'ECONNRESET') return 'The connection to the mail server timed out.';
  return 'Could not read the mailbox. Check the server details and try again.';
}

async function serveStatic(pathname: string, res: ServerResponse) {
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!/^[\w.-]+$/.test(file) || !TYPES[extname(file)]) return sendJson(res, 404, { error: 'Not found' });
  try {
    const content = await readFile(join(PUBLIC_DIR, file));
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] });
    res.end(content);
  } catch {
    sendJson(res, 404, { error: 'Not found' });
  }
}

const server = createServer(async (req, res) => {
  if (!isLocalRequest(req)) return sendJson(res, 403, { error: 'Forbidden' });
  const { pathname } = new URL(req.url ?? '/', `http://${req.headers.host}`);
  try {
    if (req.method === 'GET' && pathname === '/api/services') return sendJson(res, 200, directory);
    if (req.method === 'POST' && pathname === '/api/provider') {
      const body = await readJson(req).catch(() => ({}));
      return sendJson(res, 200, providerForEmail(normalizeEmail(String(body?.email ?? ''))) ?? null);
    }
    if (req.method === 'POST' && pathname === '/api/inbox/scan') return await handleInboxScan(req, res);
    if (req.method === 'GET') return await serveStatic(pathname, res);
    sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) sendJson(res, 500, { error: 'Internal error' });
    else res.end();
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Sanctuary is running at http://localhost:${PORT}`);
});
