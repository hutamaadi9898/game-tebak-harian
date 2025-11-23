import type { APIRoute } from 'astro';
import { z } from 'zod';

const PayloadSchema = z.object({
  message: z.string().min(1),
  name: z.string().default('Error'),
  stack: z.string().optional(),
  context: z.record(z.any()).optional(),
});

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const json = await request.json();
    const payload = PayloadSchema.parse(json);

    console.error('[client-error]', {
      name: payload.name,
      message: payload.message,
      stack: payload.stack,
      context: payload.context,
      ua: request.headers.get('user-agent'),
      ip: request.headers.get('CF-Connecting-IP')
    });

    return new Response(null, { status: 204, headers: { 'Content-Language': 'id' } });
  } catch (error) {
    console.error('[client-error] parse failure', error);
    return new Response('Payload tidak valid', { status: 400, headers: { 'Content-Language': 'id' } });
  }
};
