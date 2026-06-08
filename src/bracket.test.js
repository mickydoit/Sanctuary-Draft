// Verifies the bracket renders the full TBD structure before knockout fixtures
// exist, and places real knockout fixtures into the right round once present.
import test from 'node:test';
import assert from 'node:assert/strict';
import { getBracket } from './repo.js';
import { ensureSchema } from './db/setup.js';
import { query } from './db/index.js';

test('empty bracket shows the full TBD structure', async () => {
  await ensureSchema();
  await query('DELETE FROM fixtures');

  const bracket = await getBracket();
  assert.equal(bracket.hasAny, false);
  const counts = Object.fromEntries(bracket.rounds.map((r) => [r.stage, r.matches.length]));
  assert.deepEqual(counts, { R32: 16, R16: 8, QF: 4, SF: 2, final: 1 });
  // Every slot is a TBD placeholder.
  assert.ok(bracket.rounds.every((r) => r.matches.every((m) => m.tbd)));
});

test('a real knockout fixture lands in its round with the winner highlighted', async () => {
  await ensureSchema();
  await query('DELETE FROM fixtures');
  await query('DELETE FROM teams');
  const spain = (await query("INSERT INTO teams (name, code) VALUES ('Spain', 'ESP') RETURNING id")).rows[0].id;
  const brazil = (await query("INSERT INTO teams (name, code) VALUES ('Brazil', 'BRA') RETURNING id")).rows[0].id;
  await query(
    `INSERT INTO fixtures (stage, kickoff, home_team_id, away_team_id, home_score, away_score, winner_team_id, status)
     VALUES ('R16', '2026-07-05T19:00:00Z', $1, $2, 2, 1, $1, 'finished')`,
    [spain, brazil]
  );

  const bracket = await getBracket();
  assert.equal(bracket.hasAny, true);
  const r16 = bracket.rounds.find((r) => r.stage === 'R16');
  assert.equal(r16.matches.length, 8); // 1 real + 7 TBD
  const real = r16.matches.find((m) => !m.tbd);
  assert.equal(real.home_name, 'Spain');
  assert.equal(real.home_is_winner, true);
  assert.equal(real.away_is_winner, false);
  // Other rounds remain fully TBD.
  assert.ok(bracket.rounds.find((r) => r.stage === 'R32').matches.every((m) => m.tbd));
});
