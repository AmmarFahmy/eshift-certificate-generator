import type { NextRequest } from 'next/server';

// Simple in-memory limiter for failed admin logins: 5 failures per IP per
// 15 minutes. Memory is per server instance, so on serverless hosting it slows
// guessing down rather than giving a hard global cap; a shared store (e.g.
// Upstash Redis) would be needed for that.

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const MAX_TRACKED = 5000;

const failures = new Map<string, { count: number; resetAt: number }>();

export function getClientIp(req: NextRequest): string {
  // Use the LAST X-Forwarded-For entry: it's the one added by the proxy in
  // front of us (Vercel sets a single value; Apache/nginx append), so a client
  // can't dodge the limit by sending a fake header of its own.
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const last = forwarded.split(',').pop()?.trim();
    if (last) return last;
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

function prune(now: number) {
  if (failures.size < MAX_TRACKED) return;
  for (const [key, entry] of failures) {
    if (entry.resetAt <= now) failures.delete(key);
  }
}

/** Seconds until the client may try again, or 0 if allowed now. */
export function loginRetryAfter(ip: string): number {
  const entry = failures.get(ip);
  if (!entry) return 0;
  const now = Date.now();
  if (entry.resetAt <= now) {
    failures.delete(ip);
    return 0;
  }
  return entry.count >= MAX_FAILURES ? Math.ceil((entry.resetAt - now) / 1000) : 0;
}

export function recordLoginFailure(ip: string): void {
  const now = Date.now();
  prune(now);
  const entry = failures.get(ip);
  if (!entry || entry.resetAt <= now) {
    failures.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export function clearLoginFailures(ip: string): void {
  failures.delete(ip);
}
