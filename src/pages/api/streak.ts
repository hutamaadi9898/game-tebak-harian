import type { APIRoute } from 'astro';
import { z } from 'zod';
import { deriveClientId } from '../../utils/security';
import { ensureSchema } from '../../utils/db';
import { getLastDate } from '../../utils/streaks';

const QuerySchema = z.object({
  clientId: z.string().optional(),
});

export const prerender = false;

export const GET: APIRoute = async ({ request, locals, url }) => {
  try {
    const runtime = (locals as any).runtime;
    const env = runtime?.env as { STREAK_DB?: D1Database; GAME_SECRET?: string };
    const secret = env?.GAME_SECRET || (import.meta as any).env.GAME_SECRET || 'dev-secret';
    const db = env?.STREAK_DB;

    const parsed = QuerySchema.parse(Object.fromEntries(url.searchParams));
    const clientId = await deriveClientId(secret, request, parsed.clientId);

    if (!db) {
      return new Response(JSON.stringify({ streak: 0, best: 0, lastDate: null }), {
        headers: { 'Content-Type': 'application/json', 'Content-Language': 'en' }
      });
    }

    await ensureSchema(db);
    const lastDate = await getLastDate(db, clientId);
    const row = await db.prepare('SELECT streak, best_streak FROM streaks WHERE client_id = ?').bind(clientId).first<{ streak: number; best_streak: number }>();

    return new Response(JSON.stringify({
      streak: row?.streak ?? 0,
      best: row?.best_streak ?? 0,
      lastDate: lastDate
    }), {
      headers: { 'Content-Type': 'application/json', 'Content-Language': 'en' }
    });
  } catch (error) {
    console.error('[streak]', error);
    return new Response('Unable to fetch streak', { status: 500, headers: { 'Content-Language': 'en' } });
  }
};
