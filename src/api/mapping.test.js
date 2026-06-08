// Tests the api_id mapping step that links a provider's ids onto our pre-seeded
// teams/fixtures, and confirms syncScores then updates in place (no duplicates).
// Runs against the in-memory database (node --test gives this file its own).
import test from 'node:test';
import assert from 'node:assert/strict';
import { codeFor } from '../data/fifaRankings.js';
import { ensureApiIds, syncScores } from './sync.js';
import { ensureSchema } from '../db/setup.js';
import { query } from '../db/index.js';

test('codeFor resolves the spellings the APIs use to FIFA codes', () => {
  assert.equal(codeFor('Korea Republic'), 'KOR');
  assert.equal(codeFor('Türkiye'), 'TUR');
  assert.equal(codeFor("Côte d'Ivoire"), 'CIV');
  assert.equal(codeFor('Whatever', 'fra'), 'FRA'); // unknown name, but a known code
  assert.equal(codeFor('Atlantis', 'ZZZ'), null); // genuinely unknown
});

test('ensureApiIds links seeded teams + group fixtures, then syncScores updates in place', async () => {
  await ensureSchema();
  await query('DELETE FROM fixtures');
  await query('DELETE FROM teams');

  // Seed two teams + one group fixture WITHOUT api_ids (as the Supabase seed does).
  const fr = (await query("INSERT INTO teams (name, code, grp, ranking) VALUES ('France','FRA','I',1) RETURNING id")).rows[0];
  const sn = (await query("INSERT INTO teams (name, code, grp, ranking) VALUES ('Senegal','SEN','I',14) RETURNING id")).rows[0];
  await query(
    "INSERT INTO fixtures (stage, grp, kickoff, home_team_id, away_team_id, status) VALUES ('group','I','2026-06-16T19:00:00Z',$1,$2,'scheduled')",
    [fr.id, sn.id]
  );

  // API reports the same match (note: home/away order flipped vs our seed, and a
  // finished result). Team ids are the provider's, unrelated to our seed ids.
  const matches = [
    {
      apiId: '500', utcDate: '2026-06-16T19:00:00Z', finished: true, stage: 'group', group: 'I',
      home: { apiId: '40', name: 'Senegal', code: 'SEN' },
      away: { apiId: '41', name: 'France', code: 'FRA' },
      homeScore: 1, awayScore: 2, winnerSide: 'AWAY_TEAM',
    },
  ];

  const mapped = await ensureApiIds(matches);
  assert.equal(mapped.teamsLinked, 2);
  assert.equal(mapped.fixturesLinked, 1);
  assert.deepEqual(mapped.unmatched, []);

  // Teams now carry the provider ids.
  assert.equal((await query("SELECT api_id FROM teams WHERE code='FRA'")).rows[0].api_id, '41');

  // syncScores updates the SAME fixture rather than inserting a duplicate.
  const before = (await query('SELECT count(*)::int AS n FROM fixtures')).rows[0].n;
  const r = await syncScores(matches);
  const after = (await query('SELECT count(*)::int AS n FROM fixtures')).rows[0].n;
  assert.equal(after, before, 'no duplicate fixture inserted');
  assert.ok(r.updated >= 1);

  const fx = (await query("SELECT * FROM fixtures WHERE api_id='500'")).rows[0];
  assert.equal(fx.status, 'finished');
  assert.equal(fx.away_score, 2);
  assert.equal(fx.winner_team_id, fr.id); // France advanced (away side this time)

  // Idempotent: a second pass links nothing new.
  const again = await ensureApiIds(matches);
  assert.equal(again.teamsLinked, 0);
  assert.equal(again.fixturesLinked, 0);
});
