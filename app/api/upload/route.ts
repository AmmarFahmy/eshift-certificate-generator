import { NextRequest, NextResponse } from 'next/server';
import { put, list, del } from '@vercel/blob';
import { getAuthConfig, isAuthenticated } from '@/lib/auth';
import { detectImageType, IMAGE_EXTENSIONS } from '@/lib/image-type';

const MAX_STORED_IMAGES = 3;
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  if (!getAuthConfig()) {
    return NextResponse.json({ error: 'Server not configured.' }, { status: 500 });
  }

  if (!isAuthenticated(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File too large. Maximum size is 10 MB.' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Trust the file's bytes, not the browser-supplied type or filename.
  const type = detectImageType(buffer);
  if (!type) {
    return NextResponse.json(
      { error: 'Invalid file type. Only JPG, PNG, WebP, and GIF are allowed.' },
      { status: 400 }
    );
  }

  try {
    const fileName = `template-${Date.now()}.${IMAGE_EXTENSIONS[type]}`;

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
      contentType: type,
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
