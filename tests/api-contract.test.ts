import test from 'node:test';
import assert from 'node:assert/strict';
import { GET as getToday } from '../src/pages/api/today';
import { POST as postScore } from '../src/pages/api/score';
import { generateMatchups } from '../src/utils/game-logic';
import people from '../src/data/people.json';

const runtime = { env: { GAME_SECRET: 'test-secret' } } as any;

function dummyContext(url: string) {
  return {
    request: new Request(url),
    locals: { runtime }
  } as any;
}

test('GET /api/today returns matchups and signature', async () => {
  const res = await getToday(dummyContext('http://localhost/api/today'));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data.matchups));
  assert.equal(data.matchups.length, 10);
  assert.equal(typeof data.sig, 'string');
});

test('POST /api/score rejects invalid signature', async () => {
  const date = new Date().toISOString().split('T')[0];
  const matchups = generateMatchups(people, date);
  const answers = matchups.map((m) => m.personA.id);

  const res = await postScore({
    request: new Request('http://localhost/api/score', {
      method: 'POST',
      body: JSON.stringify({ date, answers, sig: 'invalidsig', clientId: 'test-client' })
    }),
    locals: { runtime }
  } as any);

  assert.equal(res.status, 403);
});
