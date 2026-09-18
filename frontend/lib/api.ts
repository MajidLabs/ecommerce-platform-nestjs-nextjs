'use client';

// Client-side fetch wrapper. Always calls our own same-origin
// /api/proxy/* route, never the backend directly — the browser holds no
// token, so it can't forge Authorization headers, and there's no CORS
// setup to maintain. The proxy route (app/api/proxy/[...path]/route.ts)
// reads the httpOnly cookie and attaches the real Bearer token.
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type RequestOptions = RequestInit & {
  // Set false for background/auth-check calls (e.g. "am I logged in?")
  // where a 401 is an expected, normal outcome — not a reason to navigate
  // the whole page away. Defaults to true so existing call sites (actions
  // that really do require auth, like loading /account/orders) keep
  // redirecting to /login as before.
  redirectOn401?: boolean;
};

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { redirectOn401 = true, ...init } = options;
  const res = await fetch(`/api/proxy${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });

  if (res.status === 401) {
    if (redirectOn401 && typeof window !== 'undefined') {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw new ApiError(401, 'Not authenticated');
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, data?.message || 'Request failed');
  }
  return data as T;
}

// Separate from request(): a FormData body must NOT get a manually-set
// Content-Type. The browser computes one itself — including the multipart
// boundary token — only when it sees a FormData body with no pre-existing
// Content-Type header. request() always forces 'application/json', which
// would silently break file uploads (the backend's multer middleware
// wouldn't recognize the body as multipart at all), so uploads go here.
async function upload<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`/api/proxy${path}`, {
    method: 'POST',
    body: formData,
  });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw new ApiError(401, 'Not authenticated');
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, data?.message || 'Upload failed');
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) => upload<T>(path, formData),
};