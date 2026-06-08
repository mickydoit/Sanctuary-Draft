// Tests the football-data.org normalisation + import/sync against the in-memory
// database, using a mock API payload (no network).
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMatches, mapStage, mapGroup } from './footballData.js';
import { importMatches, syncScores } from './sync.js';
import { ensureSchema } from '../db/setup.js';
import { query } from '../db/index.js';

const SAMPLE = {
  matches: [
    {
      id: 1001, utcDate: '2026-06-11T19:00:00Z', status: 'FINISHED', stage: 'GROUP_STAGE', group: 'GROUP_A',
      homeTeam: { id: 1, name: 'Argentina', tla: 'ARG' }, awayTeam: { id: 2, name: 'Mexico', tla: 'MEX' },
      score: { winner: 'HOME_TEAM', fullTime: { home: 2, away: 1 } },
    },
    {
      id: 1002, utcDate: '2026-06-12T16:00:00Z', status: 'SCHEDULED', stage: 'GROUP_STAGE', group: 'GROUP_A',
      homeTeam: { id: 3, name: 'Spain', tla: 'ESP' }, awayTeam: { id: 4, name: 'Japan', tla: 'JPN' },
      score: { winner: null, fullTime: { home: null, away: null } },
    },
    {
      id: 1003, utcDate: '2026-07-19T19:00:00Z', status: 'FINISHED', stage: 'FINAL',
      homeTeam: { id: 1, name: 'Argentina', tla: 'ARG' }, awayTeam: { id: 3, name: 'Spain', tla: 'ESP' },
      score: { winner: 'AWAY_TEAM', fullTime: { home: 1, away: 1 } }, // level after 120', Spain through on pens
    },
  ],
};

test('stage and group mapping', () => {
  assert.equal(mapStage('GROUP_STAGE'), 'group');
  assert.equal(mapStage('QUARTER_FINALS'), 'QF');
  assert.equal(mapStage('FINAL'), 'final');
  assert.equal(mapStage('UNKNOWN_STAGE'), null);
  assert.equal(mapGroup('GROUP_C'), 'C');
  assert.equal(mapGroup(null), null);
});

test('normalizeMatches extracts the fields we need', () => {
  const [g, , final] = normalizeMatches(SAMPLE);
  assert.equal(g.apiId, '1001');
  assert.equal(g.finished, true);
  assert.equal(g.stage, 'group');
  assert.equal(g.group, 'A');
  assert.equal(g.homeScore, 2);
  assert.equal(g.home.code, 'ARG');
  assert.equal(final.stage, 'final');
  assert.equal(final.winnerSide, 'AWAY_TEAM');
});

test('import builds teams + fixtures; finished results carry through; sync updates new results', async () => {
  await ensureSchema();
  await query("UPDATE settings SET draft_status = 'not_started' WHERE id = 1");

  const matches = normalizeMatches(SAMPLE);
  const result = await importMatches(matches);
  assert.equal(result.teams, 4); // ARG, MEX, ESP, JPN
  assert.equal(result.fixtures, 3);

  // Finished group game imported with score + winner = Argentina (home).
  const arg = (await query("SELECT id FROM teams WHERE api_id = '1'")).rows[0];
  const g = (await query("SELECT * FROM fixtures WHERE api_id = '1001'")).rows[0];
  assert.equal(g.status, 'finished');
  assert.equal(g.home_score, 2);
  assert.equal(g.winner_team_id, arg.id);

  // Final: penalty winner (away) recorded as the advancing team.
  const esp = (await query("SELECT id FROM teams WHERE api_id = '3'")).rows[0];
  const final = (await query("SELECT * FROM fixtures WHERE api_id = '1003'")).rows[0];
  assert.equal(final.winner_team_id, esp.id);

  // Ranking enrichment applied (Argentina -> 3 in the Apr 2026 table).
  const argRank = (await query("SELECT ranking FROM teams WHERE api_id = '1'")).rows[0].ranking;
  assert.equal(argRank, 3);

  // The scheduled match becomes finished -> sync updates it, leaves others alone.
  const later = matches.map((m) =>
    m.apiId === '1002' ? { ...m, finished: true, homeScore: 0, awayScore: 3, winnerSide: 'AWAY_TEAM' } : m
  );
  const synced = await syncScores(later);
  assert.ok(synced.updated >= 1);
  const updated = (await query("SELECT * FROM fixtures WHERE api_id = '1002'")).rows[0];
  assert.equal(updated.status, 'finished');
  assert.equal(updated.away_score, 3);
});

test('syncScores inserts a newly-created knockout fixture and resolves teams by API id', async () => {
  // ARG(1) and ESP(3) were created by the import test above (same DB).
  const ko = {
    apiId: '7100', utcDate: '2026-07-05T19:00:00Z', status: 'FINISHED', finished: true,
    stage: 'R16', group: null,
    home: { apiId: '1', name: 'Argentina', code: 'ARG' },
    away: { apiId: '3', name: 'Spain', code: 'ESP' },
    homeScore: 0, awayScore: 2, winnerSide: 'AWAY_TEAM',
  };
  const r = await syncScores([ko]);
  assert.ok(r.inserted >= 1);
  const fx = (await query("SELECT * FROM fixtures WHERE api_id = '7100'")).rows[0];
  assert.equal(fx.stage, 'R16');
  assert.equal(fx.status, 'finished');
  const esp = (await query("SELECT id FROM teams WHERE api_id = '3'")).rows[0];
  assert.equal(fx.winner_team_id, esp.id);
});
