import type { APIRoute } from 'astro';
import { z } from 'zod';
import { ensureSchema } from '../../utils/db';
import { hashEmail, emailHint } from '../../utils/security';

const PayloadSchema = z.object({
  email: z.string().email(),
});

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const { email } = PayloadSchema.parse(body);

    const runtime = (locals as any).runtime;
    const env = runtime?.env as { STREAK_DB?: D1Database; SUBSCRIPTION_SALT?: string; GAME_SECRET?: string };
    const db = env?.STREAK_DB;
    const secret = env?.SUBSCRIPTION_SALT || env?.GAME_SECRET || 'dev-secret';

    if (!db) {
      console.warn('STREAK_DB binding missing; skipping subscription write');
      return new Response(JSON.stringify({ ok: true, stored: false }), {
        status: 202,
        headers: { 'Content-Type': 'application/json', 'Content-Language': 'id' }
      });
    }

    await ensureSchema(db);
    const hash = await hashEmail(secret, email);
    const hint = emailHint(email);

    await db.prepare('INSERT OR IGNORE INTO subscriptions (email_hash, email_hint, created_at) VALUES (?, ?, ?)')
      .bind(hash, hint, new Date().toISOString())
      .run();

    return new Response(JSON.stringify({ ok: true, stored: true, hint }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Content-Language': 'id' }
    });
  } catch (error) {
    console.error('[subscribe]', error);
    return new Response('Email tidak valid', { status: 400, headers: { 'Content-Language': 'id' } });
  }
};
