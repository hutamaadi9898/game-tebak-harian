import type { APIRoute } from 'astro';
import { z } from 'zod';
import peopleData from '../../data/people.json';
import { generateMatchups } from '../../utils/game-logic';
import { deriveClientId } from '../../utils/security';
import { checkRateLimit } from '../../utils/rate-limit';
import { getLastDate, updateStreak } from '../../utils/streaks';
import { ensureSchema } from '../../utils/db';

export const prerender = false;

const ScorePayloadSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    answers: z.array(z.string()).min(1),
    sig: z.string().min(8),
    clientId: z.string().optional(),
});

export const POST: APIRoute = async ({ request, locals }) => {
    try {
        const body = await request.json() as unknown;
        const { date, answers, sig, clientId } = ScorePayloadSchema.parse(body);

        // 1. Verify Signature
        const runtime = (locals as any).runtime;
        const secret = runtime?.env?.GAME_SECRET || (import.meta as any).env.GAME_SECRET || 'dev-secret';
        const db = runtime?.env?.STREAK_DB as D1Database | undefined;
        if (db) await ensureSchema(db);

        // Reconstruct the expected payload from the date (we need to regenerate matchups to get the olderIds)
        const matchups = generateMatchups(peopleData, date, 10);
        const trueOlderIds = matchups.map(m => m.olderId);

        const expectedPayload = JSON.stringify({ date, olderIds: trueOlderIds });
        const expectedSig = await signPayload(expectedPayload, secret);

        if (sig !== expectedSig) {
            return new Response('Invalid signature', { status: 403 });
        }

        if (answers.length !== matchups.length) {
            return new Response('Answers are incomplete', { status: 400, headers: { 'Content-Language': 'en' } });
        }

        // 1b. Rate limit per client
        const derivedClientId = await deriveClientId(secret, request, clientId);
        const rate = await checkRateLimit(db, derivedClientId);
        if (!rate.allowed) {
            return new Response('Too many attempts. Try again soon.', {
                status: 429,
                headers: {
                    'Retry-After': String(rate.retryAfter ?? 60),
                    'Content-Language': 'en'
                }
            });
        }

        // 1c. Prevent multiple plays per day
        const lastDate = await getLastDate(db, derivedClientId);
        if (lastDate === date) {
            return new Response('You already played today. Come back tomorrow.', {
                status: 409,
                headers: { 'Content-Language': 'en' }
            });
        }

        // 2. Calculate Score
        let score = 0;
        const results = matchups.map((m, i) => {
            const isCorrect = answers[i] === m.olderId;
            if (isCorrect) score++;
            return {
                correct: isCorrect,
                correctId: m.olderId,
                personA: m.personA,
                personB: m.personB
            };
        });

        const perfect = score === matchups.length;
        const streak = await updateStreak(db, derivedClientId, date, perfect);

        // 3. Log Score (No DB for now)
        console.log(`Score for ${date}: ${score}/${matchups.length}`);

        return new Response(JSON.stringify({
            score,
            total: matchups.length,
            results: results.map(r => ({
                correct: r.correct,
                correctId: r.correctId,
                // Return full details now so they can see the birth dates
                personA: r.personA,
                personB: r.personB
            })),
            streak: streak ?? undefined
        }), {
            headers: {
                'Content-Type': 'application/json',
                'Content-Language': 'en'
            }
        });

    } catch (e) {
        console.error(e);
        return new Response('Error processing request', { status: 500 });
    }
};

async function signPayload(payload: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(payload)
    );
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
}
