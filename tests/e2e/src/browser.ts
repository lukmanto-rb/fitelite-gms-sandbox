// A minimal "browser" for end-to-end tests: its own cookie jar (one jar = one browser on one
// computer) and a fetch that behaves like the test environment. Requests to
// http://localhost:8080/FIT-941/... go to the real gateway with the /FIT-941 prefix removed, as the
// test environment's front door does. Cookies follow the browser rules the sign-in relies on:
// no Path attribute → the folder of the page that set it; Max-Age=0 → removed; HttpOnly cookies
// are sent with requests but page scripts cannot read them.

export const PAGE_URL = 'http://localhost:8080/FIT-941/';
const PREFIX = '/FIT-941';

type Cookie = { value: string; path: string; expires: number };

/** Node's own fetch, captured before any test replaces the page's fetch. */
const nodeFetch: typeof fetch = globalThis.fetch.bind(globalThis);

export class Browser {
  private cookies = new Map<string, Cookie>();
  constructor(private gatewayUrl: string) {}

  /** Cookie names this browser holds (for checks only). */
  cookieNames(): string[] {
    this.expire();
    return [...this.cookies.keys()];
  }

  private expire() {
    for (const [name, c] of this.cookies) if (c.expires <= Date.now()) this.cookies.delete(name);
  }

  private cookieHeader(path: string): string | undefined {
    this.expire();
    const parts = [...this.cookies].filter(([, c]) => path === c.path || path.startsWith(c.path.endsWith('/') ? c.path : `${c.path}/`)).map(([n, c]) => `${n}=${c.value}`);
    return parts.length ? parts.join('; ') : undefined;
  }

  private store(setCookies: string[], requestPath: string) {
    // RFC 6265 default-path: the request path up to (not including) its last "/".
    const defaultPath = requestPath.lastIndexOf('/') > 0 ? requestPath.slice(0, requestPath.lastIndexOf('/')) : '/';
    for (const header of setCookies) {
      const [pair, ...attrs] = header.split(';').map((s) => s.trim());
      const eq = pair!.indexOf('=');
      const name = pair!.slice(0, eq);
      const value = pair!.slice(eq + 1);
      let path = defaultPath;
      let expires = Number.POSITIVE_INFINITY;
      for (const attr of attrs) {
        const [k, v = ''] = attr.split('=');
        if (k!.toLowerCase() === 'path' && v.startsWith('/')) path = v;
        if (k!.toLowerCase() === 'max-age') expires = Date.now() + Number(v) * 1000;
      }
      if (expires <= Date.now()) this.cookies.delete(name);
      else this.cookies.set(name, { value, path, expires });
    }
  }

  /** fetch as a page at PAGE_URL would run it (relative URLs, same-origin cookies). */
  fetch: typeof fetch = async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input), PAGE_URL);
    if (url.origin !== new URL(PAGE_URL).origin || !url.pathname.startsWith(`${PREFIX}/`)) throw new TypeError('outside the test environment');
    const headers = new Headers(init.headers);
    const cookie = this.cookieHeader(url.pathname);
    if (cookie) headers.set('cookie', cookie);
    // The page's AbortSignal belongs to jsdom, which Node's fetch does not accept; timeouts are
    // not part of these tests.
    const res = await nodeFetch(`${this.gatewayUrl}${url.pathname.slice(PREFIX.length)}${url.search}`, {
      method: init.method,
      headers,
      body: init.body,
      redirect: 'manual',
    });
    this.store(res.headers.getSetCookie(), url.pathname);
    return res;
  };
}
