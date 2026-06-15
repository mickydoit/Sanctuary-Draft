// Fetch per-player stats from ESPN for every finished fixture not yet synced.
// Upserts accumulate (goals += EXCLUDED.goals etc.) so it is safe to re-run.
// Each synced fixture gets stats_synced_at stamped so it isn't re-fetched.
//
// Usage:
//   DATABASE_URL="postgres://…supabase…" node scripts/sync-stats.mjs

import { query } from '../src/db/index.js';
import { fetchMatchStats } from '../src/api/espnStats.js';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set — point it at your Supabase connection string.');
  process.exit(1);
}

const { rows: fixtures } = await query(
  `SELECT id, api_id FROM fixtures
   WHERE status = 'finished'
     AND stats_synced_at IS NULL
     AND api_id IS NOT NULL
   ORDER BY kickoff ASC`
);

if (!fixtures.length) {
  console.log('[sync-stats] No unsynced finished fixtures.');
  process.exit(0);
}

console.log(`[sync-stats] Processing ${fixtures.length} fixture(s)…`);

let totalRows = 0;

for (const fx of fixtures) {
  try {
    const players = await fetchMatchStats(fx.api_id);
    console.log(`  fixture ${fx.id} (ESPN ${fx.api_id}): ${players.length} stat rows`);

    for (const p of players) {
      await query(
        `INSERT INTO player_stats (player_name, team_name, goals, assists, yellow_cards, red_cards, synced_at)
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
    console.warn(`  ⚠ fixture ${fx.id}: ${err.message}`);
  }
}

console.log(`[sync-stats] Done — ${totalRows} player stat rows upserted.`);
process.exit(0);
