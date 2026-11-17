import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';
import { detectImageType, SNIFF_BYTES, type ImageType } from './image-type';

// Server-side fetch of a remote image that cannot be turned against internal
// services (SSRF):
//  - every hop (including redirects) must be http/https on a standard port
//  - the hostname is resolved and *every* address is checked against private,
//    loopback, link-local and other reserved ranges; the check runs inside the
//    socket's own DNS lookup, so a DNS-rebinding swap between check and
//    connect is not possible
//  - redirects are followed manually (max 3) and re-validated
//  - the body is size-capped and must be a real PNG/JPEG/GIF/WebP by its bytes

export class ImageFetchError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ImageFetchError';
    this.status = status;
  }
}

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB, same as uploads
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 15_000;
const ALLOWED_PORTS = new Set(['', '80', '443']);

const blockList = new net.BlockList();
const BLOCKED_V4: [string, number][] = [
  ['0.0.0.0', 8], // "this" network
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT (also some cloud metadata)
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, cloud metadata
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.88.99.0', 24], // 6to4 relay
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved + broadcast
];
const BLOCKED_V6: [string, number][] = [
  ['::', 96], // unspecified, loopback, IPv4-compatible
  // IPv4-mapped (::ffff:a.b.c.d) addresses are matched against the IPv4 rules
  // automatically by BlockList; adding ::ffff:0:0/96 here would block all IPv4.
  ['64:ff9b::', 96], // NAT64
  ['64:ff9b:1::', 48], // local NAT64
  ['100::', 64], // discard
  ['2001::', 32], // Teredo
  ['2001:db8::', 32], // documentation
  ['2002::', 16], // 6to4 (can embed private IPv4)
  ['fc00::', 7], // unique local (incl. fd00:ec2::254 metadata)
  ['fe80::', 10], // link-local
  ['fec0::', 10], // site-local (deprecated)
  ['ff00::', 8], // multicast
];
for (const [addr, prefix] of BLOCKED_V4) blockList.addSubnet(addr, prefix, 'ipv4');
for (const [addr, prefix] of BLOCKED_V6) blockList.addSubnet(addr, prefix, 'ipv6');

export function isBlockedAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, '').split('%')[0];
  try {
    const family = net.isIP(ip);
    if (family === 4) return blockList.check(ip, 'ipv4');
    if (family === 6) return blockList.check(ip, 'ipv6');
  } catch {
    // fall through: anything we can't parse is blocked
  }
  return true;
}

// DNS lookup used by the socket itself: refuses to connect if any resolved
// address is internal.
const safeLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, '');
    const list = addresses as dns.LookupAddress[];
    if (list.length === 0 || list.some((a) => isBlockedAddress(a.address))) {
      const blocked: NodeJS.ErrnoException = new Error(`Blocked address for ${hostname}`);
      blocked.code = 'EBLOCKEDADDR';
      return callback(blocked, '');
    }
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

function validateUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ImageFetchError('Invalid URL', 400);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ImageFetchError('Only http/https URLs are allowed', 400);
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    throw new ImageFetchError('URL not allowed', 403);
  }
  // IP literals skip DNS lookup entirely, so check them here.
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && isBlockedAddress(host)) {
    throw new ImageFetchError('URL not allowed', 403);
  }
  if (host === 'localhost' || host.endsWith('.localhost')) {
    throw new ImageFetchError('URL not allowed', 403);
  }
  return url;
}

function get(url: URL, signal: AbortSignal): Promise<http.IncomingMessage> {
  const client = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.request(url, {
      method: 'GET',
      agent: false,
      lookup: safeLookup,
      signal,
      headers: {
        'User-Agent': 'CertificateGenerator/1.0',
        Accept: 'image/png,image/jpeg,image/webp,image/gif',
      },
    });
    req.on('response', resolve);
    req.on('error', reject);
    req.end();
  });
}

function readImageBody(res: http.IncomingMessage): Promise<{ body: Buffer; type: ImageType }> {
  const declared = Number(res.headers['content-length']);
  if (Number.isFinite(declared) && declared > MAX_BYTES) {
    res.destroy();
    return Promise.reject(new ImageFetchError('Image is too large (max 10 MB)', 413));
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let type: ImageType | null = null;
    let settled = false;

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      res.destroy();
      reject(err);
    };

    res.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BYTES) return fail(new ImageFetchError('Image is too large (max 10 MB)', 413));
      chunks.push(chunk);
      if (!type && total >= SNIFF_BYTES) {
        type = detectImageType(Buffer.concat(chunks));
        if (!type) {
          fail(new ImageFetchError('URL does not point to a PNG, JPEG, WebP or GIF image', 415));
        }
      }
    });
    res.on('end', () => {
      if (settled) return;
      settled = true;
      const body = Buffer.concat(chunks);
      const detected = type ?? detectImageType(body);
      if (!detected) {
        reject(new ImageFetchError('URL does not point to a PNG, JPEG, WebP or GIF image', 415));
      } else {
        resolve({ body, type: detected });
      }
    });
    res.on('error', fail);
  });
}

export async function fetchRemoteImage(rawUrl: string): Promise<{ body: Buffer; type: ImageType }> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let url = validateUrl(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let res: http.IncomingMessage;
    try {
      res = await get(url, signal);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EBLOCKEDADDR') {
        throw new ImageFetchError('URL not allowed', 403);
      }
      throw new ImageFetchError('Failed to fetch image', 502);
    }

    const status = res.statusCode ?? 0;
    if (status >= 300 && status < 400 && res.headers.location) {
      res.resume();
      url = validateUrl(new URL(res.headers.location, url).toString());
      continue;
    }
    if (status !== 200) {
      res.resume();
      throw new ImageFetchError('Failed to fetch image', 502);
    }
    try {
      return await readImageBody(res);
    } catch (err) {
      if (err instanceof ImageFetchError) throw err;
      throw new ImageFetchError('Failed to fetch image', 502);
    }
  }

  throw new ImageFetchError('Too many redirects', 502);
}
