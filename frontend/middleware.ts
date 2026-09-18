import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const CUSTOMER_ROUTES = ['/cart', '/checkout', '/account'];
const ADMIN_ROUTES = ['/admin'];

async function verify(token: string | undefined) {
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload as { sub: string; email: string; role: string };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('accessToken')?.value;

  const needsAdmin = ADMIN_ROUTES.some((p) => pathname.startsWith(p));
  const needsAuth =
    needsAdmin || CUSTOMER_ROUTES.some((p) => pathname.startsWith(p));

  if (!needsAuth) return NextResponse.next();

  const payload = await verify(token);

  if (!payload) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (needsAdmin && payload.role !== 'ADMIN' && payload.role !== 'STAFF') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/cart/:path*', '/checkout/:path*', '/account/:path*', '/admin/:path*'],
};
