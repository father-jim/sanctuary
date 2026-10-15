// A small fetch wrapper that keeps cookies between requests, because most
// signup forms need a CSRF token from a first page load before they will
// answer an availability check.

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  /** Sent as application/json. */
  json?: unknown;
  /** Sent as application/x-www-form-urlencoded. */
  form?: Record<string, string>;
}

export interface HttpResponse {
  status: number;
  headers: Headers;
  text: string;
  /** Parsed body, or undefined when the body is not JSON. */
  json: any;
}

export type Fetch = typeof fetch;

export class HttpSession {
  readonly cookies = new Map<string, string>();
  readonly #fetch: Fetch;
  readonly #signal: AbortSignal | undefined;

  constructor(options: { fetch?: Fetch; signal?: AbortSignal } = {}) {
    this.#fetch = options.fetch ?? fetch;
    this.#signal = options.signal;
  }

  cookie(name: string): string | undefined {
    return this.cookies.get(name);
  }

  get(url: string, options: RequestOptions = {}): Promise<HttpResponse> {
    return this.request(url, { ...options, method: 'GET' });
  }

  post(url: string, options: RequestOptions = {}): Promise<HttpResponse> {
    return this.request(url, { ...options, method: 'POST' });
  }

  async request(url: string, options: RequestOptions = {}): Promise<HttpResponse> {
    const target = new URL(url);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      target.searchParams.set(key, value);
    }

    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'en-US,en;q=0.9',
      Accept: '*/*',
    };
    let body: string | undefined;
    if (options.json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.json);
    } else if (options.form) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
      body = new URLSearchParams(options.form).toString();
    }
    if (this.cookies.size > 0) {
      headers.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    }
    Object.assign(headers, options.headers);

    const res = await this.#fetch(target, {
      method: options.method ?? 'GET',
      headers,
      body,
      redirect: 'follow',
      signal: this.#signal,
    });

    for (const line of res.headers.getSetCookie()) {
      const pair = line.split(';', 1)[0];
      const eq = pair.indexOf('=');
      if (eq > 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }

    const text = await res.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return { status: res.status, headers: res.headers, text, json };
  }
}

/** Pulls the content of `<meta name="csrf-token" content="...">` from a page. */
export function metaCsrfToken(html: string): string | undefined {
  return /<meta[^>]+name="csrf-token"[^>]+content="([^"]+)"/i.exec(html)?.[1]
    ?? /<meta[^>]+content="([^"]+)"[^>]+name="csrf-token"/i.exec(html)?.[1];
}
