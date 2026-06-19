// Fetch per-player stats from ESPN for every finished fixture not yet synced.
// Looks up correct ESPN event IDs by fetching the scoreboard for each match date
// and matching on normalised team names — avoids relying on Sportmonks api_ids.
// Upserts accumulate (goals += EXCLUDED.goals) so it is safe to re-run.
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

// Returns a stable key for a match regardless of home/away order.
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
    AND  f.stats_synced_at IS NULL
    AND  f.home_score IS NOT NULL
  ORDER  BY f.kickoff ASC
`);

if (!fixtures.length) {
  console.log('[sync-stats] No unsynced finished fixtures.');
  process.exit(0);
}

console.log(`[sync-stats] Processing ${fixtures.length} fixture(s)…`);

// Group by date string (YYYYMMDD in UTC) for efficient scoreboard lookups.
const byDate = {};
for (const fx of fixtures) {
  const d = new Date(fx.kickoff).toISOString().slice(0, 10).replace(/-/g, '');
  (byDate[d] ||= []).push(fx);
}

let totalRows = 0;

// Build a global lookup across ALL dates so ESPN date ≠ UTC date mismatches still resolve.
const fxByKey = {};
for (const fx of fixtures) {
  fxByKey[matchKey(fx.home_team, fx.away_team)] = fx;
}

// Collect unique dates and also the day before/after each to handle TZ offsets.
const dateSet = new Set();
for (const date of Object.keys(byDate)) {
  const ms = new Date(`${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}T12:00:00Z`).getTime();
  for (const delta of [-86400000, 0, 86400000]) {
    dateSet.add(new Date(ms + delta).toISOString().slice(0, 10).replace(/-/g, ''));
  }
}

const seenEventIds = new Set();

for (const date of [...dateSet].sort()) {
  // Fetch ESPN scoreboard for this calendar date.
  let espnEvents = [];
  try {
    const res = await fetch(`${SCOREBOARD}?dates=${date}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    espnEvents = (await res.json()).events || [];
  } catch (err) {
    console.warn(`  ⚠ ESPN scoreboard ${date}: ${err.message}`);
    continue;
  }
  console.log(`  [${date}] ESPN events: ${espnEvents.length}`);

  for (const event of espnEvents) {
    if (seenEventIds.has(event.id)) continue;
    seenEventIds.add(event.id);

    const comp  = event.competitions?.[0];
    const home  = comp?.competitors?.find(c => c.homeAway === 'home');
    const away  = comp?.competitors?.find(c => c.homeAway === 'away');
    if (!home || !away) continue;

    const espnHome = home.team?.displayName || '';
    const espnAway = away.team?.displayName || '';
    const key = matchKey(espnHome, espnAway);
    const fx  = fxByKey[key];
    if (!fx) {
      console.log(`    no match: "${espnHome}" vs "${espnAway}" (key="${key}")`);
      continue;
    }

    try {
      const res = await fetch(`${SUMMARY}?event=${event.id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const players = parseRosterStats(await res.json());
      console.log(`  ${fx.home_team} vs ${fx.away_team} (ESPN ${event.id}): ${players.length} stat rows`);

      for (const p of players) {
        await query(
          `INSERT INTO player_stats
             (player_name, team_name, goals, assists, yellow_cards, red_cards, synced_at)
           VALUES ($1, $2, $3, $4, $5, $6, now())
           ON CONFLICT (player_name, team_name) DO UPDATE SET
             goals        = player_stats.goals        + EXCLUDED.goals,
             assists      = player_stats.assists      + EXCLUDED.assists,
             yellow_cards = player_stats.yellow_cards + EXCLUDED.yellow_cards,
             red_cards    = player_stats.red_cards    + EXCLUDED.red_cards,
             synced_at    = now()`,
          [p.player_name, p.team_name, p.goals, p.assists, p.yellow_cards, p.red_cards]
        );
      }

      await query(`UPDATE fixtures SET stats_synced_at = now() WHERE id = $1`, [fx.id]);
      totalRows += players.length;
    } catch (err) {
      console.warn(`  ⚠ ${fx.home_team} vs ${fx.away_team} (ESPN ${event.id}): ${err.message}`);
    }
  }
}

console.log(`[sync-stats] Done — ${totalRows} player stat rows upserted.`);
