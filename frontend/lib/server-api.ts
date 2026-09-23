import { getAccessToken } from './auth';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000/api/v1';

interface FetchOptions extends RequestInit {
  auth?: boolean;
  revalidate?: number | false;
}

// Direct server-to-server fetch to the NestJS backend. Used from Server
// Components (product pages, admin pages) — no CORS concerns since this
// never runs in the browser.
//
// Deliberately never throws on network failure: if the backend is
// unreachable, callers get `null` and can render an empty/fallback state
// instead of crashing the page. A storefront should degrade, not 500,
// when its API is briefly down.
export async function serverFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T | null> {
  const { auth, revalidate, ...init } = options;
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');

  if (auth) {
    const token = await getAccessToken();
    if (!token) return null;
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      ...init,
      headers,
      next: revalidate === false ? undefined : { revalidate: revalidate ?? 60 },
      cache: revalidate === false ? 'no-store' : undefined,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
