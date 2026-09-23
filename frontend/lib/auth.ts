import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

export interface SessionUser {
  userId: string;
  email: string;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
}

// Verifies the access token cookie server-side. Returns null if missing,
// expired, or invalid — callers decide whether that means "redirect to
// login" or "render as a guest".
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('accessToken')?.value;
  if (!token) return null;

  try {
    const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return {
      userId: payload.sub as string,
      email: payload.email as string,
      role: payload.role as SessionUser['role'],
    };
  } catch {
    return null;
  }
}

export async function getAccessToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get('accessToken')?.value;
}
