import { ensureSchema } from './db';

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

export async function checkRateLimit(db: D1Database | undefined, clientId: string, limit = 20, windowSeconds = 60): Promise<RateLimitResult> {
  if (!db) return { allowed: true };
  await ensureSchema(db);

  const now = Date.now();
  const windowStart = Math.floor(now / 1000 / windowSeconds);

  const existing = await db.prepare('SELECT count, window_start FROM rate_limits WHERE client_id = ?').bind(clientId).first<{ count: number; window_start: number }>();

  if (existing && existing.window_start === windowStart) {
    if (existing.count >= limit) {
      const retryAfter = (windowStart + 1) * windowSeconds - Math.floor(now / 1000);
      return { allowed: false, retryAfter };
    }
    await db.prepare('UPDATE rate_limits SET count = count + 1 WHERE client_id = ?').bind(clientId).run();
    return { allowed: true };
  }

  await db.prepare('INSERT OR REPLACE INTO rate_limits (client_id, window_start, count) VALUES (?, ?, 1)').bind(clientId, windowStart).run();
  return { allowed: true };
}
