// Fetch per-player stats from ESPN for every finished fixture.
// Aggregates all games per player in JS, then upserts totals with overwrite
// (not accumulation) so every run produces correct numbers regardless of order.
//
// Usage:
//   DATABASE_URL="postgres://…supabase…" node scripts/sync-stats.mjs

import { query } from '../src/db/index.js';
import { normalizeTeamName } from '../src/api/espn.js';
import { parseRosterStats } from '../src/api/espnStats.js';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set — point it at your Supabase connection string.');
  process.exit(1);
}

const SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
const SUMMARY    = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary';

function matchKey(a, b) {
  return [normalizeTeamName(a), normalizeTeamName(b)].map(n => n.toLowerCase()).sort().join('|');
}

const { rows: fixtures } = await query(`
  SELECT f.id, f.kickoff,
         th.name AS home_team,
         ta.name AS away_team
  FROM   fixtures f
  JOIN   teams th ON th.id = f.home_team_id
  JOIN   teams ta ON ta.id = f.away_team_id
  WHERE  f.status = 'finished'
    AND  f.home_score IS NOT NULL
  ORDER  BY f.kickoff ASC
`);

if (!fixtures.length) {
  console.log('[sync-stats] No finished fixtures.');
  process.exit(0);
}

console.log(`[sync-stats] Processing ${fixtures.length} fixture(s)…`);

// Group by UTC date for scoreboard lookups.
const byDate = {};
for (const fx of fixtures) {
  const d = new Date(fx.kickoff).toISOString().slice(0, 10).replace(/-/g, '');
  (byDate[d] ||= []).push(fx);
}

// Global key → fixture map so ESPN date ≠ UTC date mismatches still resolve.
const fxByKey = {};
for (const fx of fixtures) {
  fxByKey[matchKey(fx.home_team, fx.away_team)] = fx;
}

// Query ESPN for each UTC date ±1 day to cover timezone differences.
const dateSet = new Set();
for (const date of Object.keys(byDate)) {
  const ms = new Date(`${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}T12:00:00Z`).getTime();
  for (const delta of [-86400000, 0, 86400000]) {
    dateSet.add(new Date(ms + delta).toISOString().slice(0, 10).replace(/-/g, ''));
  }
}

// Accumulate all per-game rows into per-player totals before writing to DB.
const seenEventIds = new Set();
const seenFixtureIds = new Set();
const playerTotals = {}; // key → { player_name, team_name, goals, assists, yellow_cards, red_cards }

for (const date of [...dateSet].sort()) {
  let espnEvents = [];
  try {
    const res = await fetch(`${SCOREBOARD}?dates=${date}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    espnEvents = (await res.json()).events || [];
  } catch (err) {
    console.warn(`  ⚠ ESPN scoreboard ${date}: ${err.message}`);
    continue;
  }

  for (const event of espnEvents) {
    if (seenEventIds.has(event.id)) continue;
    seenEventIds.add(event.id);

    const comp = event.competitions?.[0];
    const home = comp?.competitors?.find(c => c.homeAway === 'home');
    const away = comp?.competitors?.find(c => c.homeAway === 'away');
    if (!home || !away) continue;

    const key = matchKey(home.team?.displayName || '', away.team?.displayName || '');
    const fx  = fxByKey[key];
    if (!fx || seenFixtureIds.has(fx.id)) continue;
    seenFixtureIds.add(fx.id);

    try {
      const res = await fetch(`${SUMMARY}?event=${event.id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const players = parseRosterStats(await res.json());
      console.log(`  ${fx.home_team} vs ${fx.away_team} (ESPN ${event.id}): ${players.length} stat rows`);

      for (const p of players) {
        const k = `${p.player_name}||${p.team_name}`;
        if (!playerTotals[k]) {
          playerTotals[k] = { player_name: p.player_name, team_name: p.team_name, goals: 0, assists: 0, yellow_cards: 0, red_cards: 0 };
        }
        playerTotals[k].goals        += p.goals;
        playerTotals[k].assists      += p.assists;
        playerTotals[k].yellow_cards += p.yellow_cards;
        playerTotals[k].red_cards    += p.red_cards;
      }
    } catch (err) {
      console.warn(`  ⚠ ${fx.home_team} vs ${fx.away_team} (ESPN ${event.id}): ${err.message}`);
    }
  }
}

// Upsert aggregated totals — overwrite so re-running is always idempotent.
const totals = Object.values(playerTotals);
console.log(`[sync-stats] Upserting ${totals.length} player totals…`);
for (const p of totals) {
  await query(
    `INSERT INTO player_stats
       (player_name, team_name, goals, assists, yellow_cards, red_cards, synced_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (player_name, team_name) DO UPDATE SET
       goals        = EXCLUDED.goals,
       assists      = EXCLUDED.assists,
       yellow_cards = EXCLUDED.yellow_cards,
       red_cards    = EXCLUDED.red_cards,
       synced_at    = now()`,
    [p.player_name, p.team_name, p.goals, p.assists, p.yellow_cards, p.red_cards]
  );
}

console.log(`[sync-stats] Done.`);
