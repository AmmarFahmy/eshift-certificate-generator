import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { put, list, del } from '@vercel/blob';

const MAX_STORED_IMAGES = 3;

function verifyToken(token: string, adminPassword: string): boolean {
  const expected = createHmac('sha256', 'certgen_salt_v1').update(adminPassword).digest('hex');
  return token === expected;
}

// Only allow image MIME types
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return NextResponse.json({ error: 'Server not configured.' }, { status: 500 });
  }

  // Verify auth token
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!verifyToken(token, adminPassword)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file type. Only JPG, PNG, WebP, and GIF are allowed.' },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File too large. Maximum size is 10 MB.' }, { status: 400 });
  }

  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Sanitize filename — only alphanumeric, dots, dashes
    const ext = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
    const fileName = `template-${Date.now()}.${ext}`;

    // Enforce max stored images: delete oldest if at or above limit
    const { blobs } = await list({ prefix: 'template-' });
    if (blobs.length >= MAX_STORED_IMAGES) {
      // Sort ascending by uploadedAt so oldest is first
      blobs.sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime());
      const toDelete = blobs.slice(0, blobs.length - MAX_STORED_IMAGES + 1);
      await Promise.all(toDelete.map((b) => del(b.url)));
    }

    const blob = await put(fileName, buffer, {
      access: 'public',
      contentType: file.type,
    });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json(
      {
        error:
          'File upload failed. If deploying to Vercel, please use an external image URL instead.',
      },
      { status: 500 }
    );
  }
}
