import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000/api/v1';

async function forward(
  req: NextRequest,
  path: string,
  accessToken: string | undefined,
) {
  const hasBody = req.method !== 'GET' && req.method !== 'DELETE';
  // arrayBuffer() preserves exact bytes for both JSON and binary
  // (multipart file upload) bodies. Using .text() here instead would
  // decode/re-encode as UTF-8 — safe for JSON, but it silently corrupts
  // binary image data sent as multipart/form-data.
  const body = hasBody ? await req.arrayBuffer() : undefined;

  // Forward whatever Content-Type the client actually sent (JSON from
  // lib/api.ts, or "multipart/form-data; boundary=..." set automatically
  // by the browser for FormData uploads) rather than hardcoding
  // application/json. The multipart boundary value is required for the
  // backend's multer middleware to parse the body at all.
  const contentType = req.headers.get('content-type');

  return fetch(`${BACKEND_URL}/${path}${req.nextUrl.search}`, {
    method: req.method,
    headers: {
      ...(contentType ? { 'Content-Type': contentType } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body,
  });
}

async function tryRefresh(
  req: NextRequest,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  const refreshToken = req.cookies.get('refreshToken')?.value;
  if (!refreshToken) return null;

  const res = await fetch(`${BACKEND_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return null;

  const data = await res.json();
  return { accessToken: data.accessToken, refreshToken: data.refreshToken };
}

async function handler(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path.join('/');
  const accessToken = req.cookies.get('accessToken')?.value;

  let backendRes: Response;
  try {
    backendRes = await forward(req, path, accessToken);
  } catch {
    // Backend unreachable (down, network error, wrong BACKEND_URL). Return
    // a clean JSON error in the same shape the client's ApiError expects,
    // instead of letting the fetch rejection surface as a raw HTML 500 —
    // res.json() in lib/api.ts would otherwise throw a second, more
    // confusing error while parsing that HTML as JSON.
    return NextResponse.json(
      { message: 'Service temporarily unavailable. Please try again shortly.' },
      { status: 502 },
    );
  }

  let newTokens: { accessToken: string; refreshToken: string } | null = null;

  if (backendRes.status === 401) {
    try {
      newTokens = await tryRefresh(req);
    } catch {
      newTokens = null;
    }
    if (newTokens) {
      try {
        backendRes = await forward(req, path, newTokens.accessToken);
      } catch {
        return NextResponse.json(
          { message: 'Service temporarily unavailable. Please try again shortly.' },
          { status: 502 },
        );
      }
    }
  }

  const data = await backendRes.text();
  const response = new NextResponse(data, {
    status: backendRes.status,
    headers: { 'Content-Type': backendRes.headers.get('Content-Type') || 'application/json' },
  });

  if (newTokens) {
    // The backend rotates the refresh token on every /auth/refresh call
    // (old value stops working), so the cookie has to be updated here too
    // — not just accessToken — or the *next* silent refresh would present
    // a refresh token the backend no longer recognizes and force a
    // full re-login.
    response.cookies.set('accessToken', newTokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 15,
    });
    response.cookies.set('refreshToken', newTokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
  }

  return response;
}

export {
  handler as GET,
  handler as POST,
  handler as PATCH,
  handler as DELETE,
  handler as PUT,
};
