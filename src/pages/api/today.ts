import type { APIRoute } from 'astro';
import peopleData from '../../data/people.json';
import { generateMatchups } from '../../utils/game-logic';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
    // 1. Get today's date (UTC)
    const now = new Date();
    const date = now.toISOString().split('T')[0];

    // 2. Generate matchups deterministically
    const matchups = generateMatchups(peopleData, date, 10);

    // 3. Create signature
    // We sign the date and the olderIds to verify the score later.
    // Access env via locals.runtime.env for Cloudflare, or process.env for dev fallback
    const runtime = (locals as any).runtime;
    const secret = runtime?.env?.GAME_SECRET || (import.meta as any).env.GAME_SECRET || 'dev-secret';

    const payload = JSON.stringify({ date, olderIds: matchups.map(m => m.olderId) });
    const sig = await signPayload(payload, secret);

    // 4. Return response
    // We strip sensitive info (answers) but keep birthYear for immediate feedback in this version
    const safeMatchups = matchups.map(m => ({
        personA: {
            id: m.personA.id,
            name: m.personA.name,
            image: m.personA.image,
            occupation: m.personA.occupation,
            funFact: m.personA.funFact,
            sitelinks: m.personA.sitelinks,
            birthYear: m.personA.birthYear
        },
        personB: {
            id: m.personB.id,
            name: m.personB.name,
            image: m.personB.image,
            occupation: m.personB.occupation,
            funFact: m.personB.funFact,
            sitelinks: m.personB.sitelinks,
            birthYear: m.personB.birthYear
        },
        difficulty: m.difficulty
    }));

    return new Response(JSON.stringify({
        date,
        matchups: safeMatchups,
        sig
    }), {
        headers: {
            'Content-Type': 'application/json',
            'Content-Language': 'id',
            'Cache-Control': 'public, max-age=300, s-maxage=300' // keep fresh after version bumps
        }
    });
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
