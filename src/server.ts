import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { directory } from './directory.ts';
import { probes } from './probes/index.ts';
import { isEmail, normalizeEmail, scan } from './scan.ts';

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
    if (raw.length > 10_000) throw new Error('Body too large');
  }
  return JSON.parse(raw);
}

// The server makes outbound requests on the caller's behalf, so only answer
// pages served from this machine. The Host check stops DNS-rebinding pages,
// and requiring a JSON content type stops plain cross-site form posts.
function isLocalRequest(req: IncomingMessage): boolean {
  const host = req.headers.host ?? '';
  return host === `${HOST}:${PORT}` || host === `localhost:${PORT}`;
}

async function handleScan(req: IncomingMessage, res: ServerResponse) {
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
  if (!isEmail(email)) return sendJson(res, 400, { error: 'Enter a valid email address' });
  if (body?.ownsEmail !== true) {
    return sendJson(res, 400, { error: 'Only scan an address that belongs to you' });
  }

  const wanted = Array.isArray(body.services) ? new Set(body.services) : undefined;
  const selected = wanted ? probes.filter((p) => wanted.has(p.id)) : probes;

  const controller = new AbortController();
  res.on('close', () => controller.abort());
  res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' });
  for await (const result of scan(selected, email, { signal: controller.signal })) {
    if (controller.signal.aborted) break;
    res.write(JSON.stringify(result) + '\n');
  }
  res.end();
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
    if (req.method === 'POST' && pathname === '/api/scan') return await handleScan(req, res);
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
