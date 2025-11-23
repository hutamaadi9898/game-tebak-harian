import type { APIRoute } from 'astro';
import { z } from 'zod';
import peopleData from '../../../data/people.json';

const ParamsSchema = z.object({ id: z.string().min(1).regex(/^Q[0-9]+$/) });
const MAX_BYTES = 10 * 1024 * 1024; // 10MB guard
const ONE_DAY = 60 * 60 * 24;
const ONE_WEEK = ONE_DAY * 7;

export const prerender = false;

export const GET: APIRoute = async ({ params, request, locals }) => {
  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    return new Response('ID tidak valid', { status: 400, headers: { 'Content-Language': 'id' } });
  }

  const person = peopleData.find((p) => p.id === parsed.data.id);
  if (!person) return new Response('Tidak ditemukan', { status: 404, headers: { 'Content-Language': 'id' } });

  const runtime = (locals as any).runtime;
  const bucket = runtime?.env?.IMAGE_BUCKET as R2Bucket | undefined;
  const cache = caches.default;
  const cacheKey = new Request(request.url, request);

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const r2Key = `${person.id}.jpg`;
  if (bucket) {
    const fromR2 = await bucket.get(r2Key);
    if (fromR2) {
      const headers = new Headers({
        'Content-Type': fromR2.httpMetadata?.contentType || 'image/jpeg',
        'Cache-Control': `public, max-age=${ONE_DAY}, s-maxage=${ONE_WEEK}`
      });
      const body = await fromR2.arrayBuffer();
      const resp = new Response(body, { status: 200, headers });
      await cache.put(cacheKey, resp.clone());
      return resp;
    }
  }

  const targetUrl = new URL(person.image.replace(/^http:/, 'https:'));
  if (targetUrl.pathname.includes('/Special:FilePath/')) {
    targetUrl.searchParams.set('width', '360'); // keep payload small for mobile
  }

  const upstream = await fetch(targetUrl.toString(), {
    cf: { cacheEverything: true, cacheTtl: ONE_WEEK },
    headers: {
      'User-Agent': 'GuessGame/1.0 (+https://guess-game.hutama39.workers.dev)'
    }
  });

  if (!upstream.ok || !upstream.body) {
    return new Response('Failed to load image', { status: 502, headers: { 'Content-Language': 'en' } });
}

  const contentLength = Number(upstream.headers.get('content-length') || '0');
  if (contentLength > MAX_BYTES) {
    return new Response('Gambar terlalu besar', { status: 413, headers: { 'Content-Language': 'id' } });
  }

  const arrayBuffer = await upstream.arrayBuffer();
  const headers = new Headers(upstream.headers);
  headers.set('Cache-Control', `public, max-age=${ONE_DAY}, s-maxage=${ONE_WEEK}`);
  headers.set('Content-Security-Policy', "default-src 'none'; img-src * data: blob:; style-src 'unsafe-inline';");

  if (bucket) {
    await bucket.put(r2Key, arrayBuffer, {
      httpMetadata: {
        contentType: upstream.headers.get('content-type') || 'image/jpeg',
        cacheControl: `public, max-age=${ONE_WEEK}`
      }
    });
  }

  const response = new Response(arrayBuffer, { status: 200, headers });
  await cache.put(cacheKey, response.clone());
  return response;
};
