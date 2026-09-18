import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000/api/v1';

export async function POST(req: NextRequest) {
  const token = req.cookies.get('accessToken')?.value;

  if (token) {
    await fetch(`${BACKEND_URL}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {
      // best-effort: even if the backend call fails, still clear local cookies
    });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete('accessToken');
  response.cookies.delete('refreshToken');
  return response;
}
