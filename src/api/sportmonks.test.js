// Tests the SportMonks v3 -> neutral-shape normalisation, then runs it through
// the shared import/sync layer against the in-memory database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFixture, normalizeResponse, mapStageName, findWorldCupLeagues } from './sportmonks.js';
import { importMatches, syncScores } from './sync.js';
import { ensureSchema } from '../db/setup.js';
import { query } from '../db/index.js';

const WC = 26618;

// A finished group match (Argentina 2-1 Mexico), winner flagged on participants.
const groupMatch = {
  id: 5001, starting_at_timestamp: Math.floor(Date.UTC(2026, 5, 11, 19) / 1000),
  state_id: 5, league_id: WC,
  stage: { name: 'Group Stage' }, group: { name: 'Group A' }, round: { name: '1' },
  participants: [
    { id: 100, name: 'Argentina', short_code: 'ARG', meta: { location: 'home', winner: true } },
    { id: 200, name: 'Mexico', short_code: 'MEX', meta: { location: 'away', winner: false } },
  ],
  scores: [
    { participant_id: 100, description: '1ST_HALF', score: { goals: 1, participant: 'home' } },
    { participant_id: 100, description: 'CURRENT', score: { goals: 2, participant: 'home' } },
    { participant_id: 200, description: 'CURRENT', score: { goals: 1, participant: 'away' } },
  ],
};

// A final level after 120', decided on penalties (no winner flag -> use shootout).
const finalMatch = {
  id: 5002, starting_at_timestamp: Math.floor(Date.UTC(2026, 6, 19, 19) / 1000),
  state_id: 8, league_id: WC, stage: { name: 'Final' },
  participants: [
    { id: 100, name: 'Argentina', short_code: 'ARG', meta: { location: 'home' } },
    { id: 300, name: 'Spain', short_code: 'ESP', meta: { location: 'away' } },
  ],
  scores: [
    { participant_id: 100, description: 'CURRENT', score: { goals: 1, participant: 'home' } },
    { participant_id: 300, description: 'CURRENT', score: { goals: 1, participant: 'away' } },
    { participant_id: 100, description: 'PENALTIES', score: { goals: 3, participant: 'home' } },
    { participant_id: 300, description: 'PENALTIES', score: { goals: 5, participant: 'away' } },
  ],
};

// A different league's fixture that must be filtered out.
const otherLeague = { id: 9999, state_id: 1, league_id: 1, participants: [], scores: [] };

test('stage name mapping handles the tricky cases', () => {
  assert.equal(mapStageName('Group Stage'), 'group');
  assert.equal(mapStageName('Round of 16'), 'R16');
  assert.equal(mapStageName('8th Finals'), 'R16');
  assert.equal(mapStageName('Quarter-finals'), 'QF');
  assert.equal(mapStageName('Semi-finals'), 'SF');
  assert.equal(mapStageName('3rd Place Final'), 'third');
  assert.equal(mapStageName('Final'), 'final');
});

test('normalizeFixture reads participants, current score, state and winner', () => {
  const g = normalizeFixture(groupMatch);
  assert.equal(g.stage, 'group');
  assert.equal(g.group, 'A');
  assert.equal(g.finished, true);
  assert.equal(g.home.name, 'Argentina');
  assert.equal(g.homeScore, 2);
  assert.equal(g.awayScore, 1);
  assert.equal(g.winnerSide, 'HOME_TEAM');

  const f = normalizeFixture(finalMatch);
  assert.equal(f.stage, 'final');
  assert.equal(f.finished, true);
  assert.equal(f.winnerSide, 'AWAY_TEAM'); // Spain won the shootout 5-3
});

test('normalizeResponse filters to the World Cup league', () => {
  const norm = normalizeResponse([groupMatch, finalMatch, otherLeague]);
  assert.equal(norm.length, 2);
});

test('findWorldCupLeagues searches leagues and counts fixtures per candidate', async () => {
  const fakeFetch = async (rawUrl) => {
    const url = decodeURIComponent(rawUrl); // URLSearchParams encodes the ':' in the filter
    if (url.includes('/leagues/search/')) {
      return {
        ok: true,
        json: async () => ({
          data: [
            { id: 732, name: 'World Cup' },
            { id: 5, name: 'World Cup Qualification CONMEBOL' },
          ],
        }),
      };
    }
    if (url.includes('fixtureLeagues:732')) {
      return { ok: true, json: async () => ({ data: new Array(50).fill({}), pagination: { has_more: true } }) };
    }
    return { ok: true, json: async () => ({ data: [] }) }; // other league: nothing in window
  };

  const out = await findWorldCupLeagues('tok', fakeFetch);
  assert.equal(out.length, 2);
  const wc = out.find((l) => l.id === 732);
  assert.equal(wc.name, 'World Cup');
  assert.equal(wc.fixtures, 50);
  assert.equal(wc.hasMore, true);
  assert.equal(out.find((l) => l.id === 5).fixtures, 0); // qualifier has none in the window
});

test('import + sync work end to end against the database', async () => {
  await ensureSchema();
  await query("UPDATE settings SET draft_status = 'not_started' WHERE id = 1");

  const matches = normalizeResponse([groupMatch, finalMatch]);
  const r = await importMatches(matches);
  assert.equal(r.teams, 3); // ARG, MEX, ESP
  assert.equal(r.fixtures, 2);

  const esp = (await query("SELECT id FROM teams WHERE api_id = '300'")).rows[0];
  const final = (await query("SELECT * FROM fixtures WHERE api_id = '5002'")).rows[0];
  assert.equal(final.status, 'finished');
  assert.equal(final.winner_team_id, esp.id); // penalty winner recorded

  const synced = await syncScores(matches);
  assert.ok(synced.updated >= 2);
});
