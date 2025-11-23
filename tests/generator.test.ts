import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMatchups } from '../src/utils/game-logic';
import people from '../src/data/people.json';

const DATE = '2025-11-20';

test('generateMatchups is deterministic for a given date', () => {
  const first = generateMatchups(people, DATE);
  const second = generateMatchups(people, DATE);
  assert.deepEqual(first, second);
});

test('generateMatchups returns expected length and mix', () => {
  const matchups = generateMatchups(people, DATE);
  assert.equal(matchups.length, 10);
  const diffCount = matchups.reduce((acc, m) => {
    acc[m.difficulty] = (acc[m.difficulty] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  assert.ok((diffCount.hard ?? 0) >= 2);
  assert.ok((diffCount.medium ?? 0) >= 3);
});
