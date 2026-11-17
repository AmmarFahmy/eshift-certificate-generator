import { NextRequest, NextResponse } from 'next/server';
import {
  clearSessionCookie,
  createSessionToken,
  getAuthConfig,
  isAuthenticated,
  safeEqual,
  setSessionCookie,
} from '@/lib/auth';
import {
  clearLoginFailures,
  getClientIp,
  loginRetryAfter,
  recordLoginFailure,
} from '@/lib/rate-limit';

const NO_STORE = { 'Cache-Control': 'no-store' };

// Is the current browser signed in?
export async function GET(req: NextRequest) {
  return NextResponse.json({ authenticated: isAuthenticated(req) }, { headers: NO_STORE });
}

// Sign in with the admin password.
export async function POST(req: NextRequest) {
  const config = getAuthConfig();
  if (!config) {
    console.error('ADMIN_PASSWORD and AUTH_SECRET (32+ chars) must be set.');
    return NextResponse.json(
      { success: false, error: 'Server not configured. Set ADMIN_PASSWORD and AUTH_SECRET.' },
      { status: 500, headers: NO_STORE }
    );
  }

  const ip = getClientIp(req);
  const retryAfter = loginRetryAfter(ip);
  if (retryAfter > 0) {
    return NextResponse.json(
      {
        success: false,
        error: `Too many failed attempts. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`,
      },
      { status: 429, headers: { ...NO_STORE, 'Retry-After': String(retryAfter) } }
    );
  }

  let body: { password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400, headers: NO_STORE }
    );
  }

  const { password } = body;
  if (typeof password !== 'string' || !password || password.length > 1024) {
    return NextResponse.json(
      { success: false, error: 'Password required' },
      { status: 400, headers: NO_STORE }
    );
  }

  if (!safeEqual(password, config.adminPassword)) {
    recordLoginFailure(ip);
    return NextResponse.json(
      { success: false, error: 'Invalid password' },
      { status: 401, headers: NO_STORE }
    );
  }

  clearLoginFailures(ip);
  const res = NextResponse.json({ success: true }, { headers: NO_STORE });
  setSessionCookie(res, createSessionToken(config));
  return res;
}

// Sign out.
export async function DELETE() {
  const res = NextResponse.json({ success: true }, { headers: NO_STORE });
  clearSessionCookie(res);
  return res;
}
