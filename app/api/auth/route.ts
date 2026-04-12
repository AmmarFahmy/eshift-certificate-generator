import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';

function generateToken(password: string): string {
  // Token is HMAC of the password — static per password, no expiry for simplicity
  return createHmac('sha256', 'certgen_salt_v1').update(password).digest('hex');
}

export async function POST(req: NextRequest) {
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  const { password } = body;

  if (typeof password !== 'string' || !password) {
    return NextResponse.json({ success: false, error: 'Password required' }, { status: 400 });
  }

  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error('ADMIN_PASSWORD environment variable is not set.');
    return NextResponse.json(
      { success: false, error: 'Server not configured. Set ADMIN_PASSWORD in environment.' },
      { status: 500 }
    );
  }

  if (password === adminPassword) {
    const token = generateToken(adminPassword);
    return NextResponse.json({ success: true, token });
  }

  return NextResponse.json({ success: false, error: 'Invalid password' }, { status: 401 });
}
