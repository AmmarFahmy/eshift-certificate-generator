import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';

// Admin session = signed, expiring token in an HttpOnly cookie.
//
// The token is HMAC-signed with AUTH_SECRET (a random value that is NOT the
// password), so a leaked token can't be used to recover the password. The
// signature also covers a hash of ADMIN_PASSWORD, so changing either the
// password or AUTH_SECRET instantly invalidates every existing session.

export const SESSION_COOKIE = 'certgen_admin';
export const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 hours
const COOKIE_PATH = '/api';
const TOKEN_VERSION = 'v1';

interface AuthConfig {
  adminPassword: string;
  secret: string;
}

/** Returns null when the server is missing ADMIN_PASSWORD or a strong AUTH_SECRET. */
export function getAuthConfig(): AuthConfig | null {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  if (!adminPassword || !secret || secret.length < 32) return null;
  return { adminPassword, secret };
}

function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

/** Constant-time string comparison (lengths are hidden by hashing first). */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b));
}

function sign(payload: string, config: AuthConfig): string {
  return createHmac('sha256', config.secret)
    .update(payload)
    .update('\n')
    .update(sha256(config.adminPassword))
    .digest('base64url');
}

export function createSessionToken(config: AuthConfig): string {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const nonce = randomBytes(16).toString('base64url');
  const payload = `${TOKEN_VERSION}.${expiresAt}.${nonce}`;
  return `${payload}.${sign(payload, config)}`;
}

export function verifySessionToken(token: string | undefined, config: AuthConfig): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== TOKEN_VERSION) return false;

  const [, expiresAtRaw, , signature] = parts;
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return false;

  const payload = parts.slice(0, 3).join('.');
  return safeEqual(signature, sign(payload, config));
}

export function isAuthenticated(req: NextRequest): boolean {
  const config = getAuthConfig();
  if (!config) return false;
  return verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value, config);
}

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: COOKIE_PATH,
};

export function setSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_TTL_SECONDS });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, '', { ...cookieOptions, maxAge: 0 });
}
