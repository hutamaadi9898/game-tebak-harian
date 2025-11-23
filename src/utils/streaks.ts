import { ensureSchema } from './db';

interface StreakRow {
  streak: number;
  best_streak: number;
  last_date: string;
}

export interface StreakResult {
  streak: number;
  best: number;
  lastDate: string;
}

function daysBetween(dateA: string, dateB: string) {
  const oneDayMs = 24 * 60 * 60 * 1000;
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.round((a.getTime() - b.getTime()) / oneDayMs);
}

export async function updateStreak(db: D1Database | undefined, clientId: string, date: string, perfect: boolean): Promise<StreakResult | null> {
  if (!db) return null;
  await ensureSchema(db);

  const row = await db.prepare('SELECT streak, best_streak, last_date FROM streaks WHERE client_id = ?').bind(clientId).first<StreakRow>();

  if (!perfect) {
    const newBest = row ? Math.max(row.best_streak, row.streak) : 0;
    await db.prepare('INSERT OR REPLACE INTO streaks (client_id, last_date, streak, best_streak, updated_at) VALUES (?, ?, ?, ?, ?)' ).bind(clientId, date, 0, newBest, new Date().toISOString()).run();
    return { streak: 0, best: newBest, lastDate: date };
  }

  if (!row) {
    const streak = 1;
    await db.prepare('INSERT INTO streaks (client_id, last_date, streak, best_streak, updated_at) VALUES (?, ?, ?, ?, ?)').bind(clientId, date, streak, streak, new Date().toISOString()).run();
    return { streak, best: streak, lastDate: date };
  }

  const gap = daysBetween(date, row.last_date);
  const consecutive = gap === 1 ? row.streak + 1 : gap === 0 ? row.streak : 1;
  const best = Math.max(row.best_streak, consecutive);

  await db.prepare('UPDATE streaks SET streak = ?, best_streak = ?, last_date = ?, updated_at = ? WHERE client_id = ?')
    .bind(consecutive, best, date, new Date().toISOString(), clientId)
    .run();

  return { streak: consecutive, best, lastDate: date };
}
