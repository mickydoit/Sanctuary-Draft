import { query } from './index.js';
import { ensureSchema } from './setup.js';
import { TEAMS, DEFAULT_PLAYERS } from '../data/teams.js';
import { buildGroupFixtures } from '../data/schedule2026.js';

/** True if there are no teams loaded yet. */
async function isEmpty() {
  const { rows } = await query('SELECT COUNT(*)::int AS n FROM teams');
  return rows[0].n === 0;
}

/**
 * Seed players, teams and group fixtures. Wipes existing draft/fixture/team
 * data first so it is safe to re-run during testing.
 */
export async function seed() {
  await ensureSchema();

  // Clear in dependency order.
  await query('DELETE FROM nominations');
  await query('DELETE FROM picks');
  await query('DELETE FROM fixtures');
  await query('DELETE FROM teams');
  await query('DELETE FROM players');
  await query("UPDATE settings SET draft_status='not_started', draft_started_at=NULL WHERE id=1");

  // Players (default names; editable later in admin).
  for (const name of DEFAULT_PLAYERS) {
    await query('INSERT INTO players (name) VALUES ($1)', [name]);
  }

  // Teams. Keep each team's returned id paired with its code so fixtures can be
  // resolved by code (ids come from the SERIAL sequence, not necessarily 1..48).
  const teamRows = [];
  for (const t of TEAMS) {
    const { rows } = await query(
      'INSERT INTO teams (name, code, grp, ranking) VALUES ($1, $2, $3, $4) RETURNING id',
      [t.name, t.code, t.grp, t.ranking]
    );
    teamRows.push({ id: rows[0].id, code: t.code });
  }

  // Group fixtures: the REAL 2026 schedule (pairings, dates, kick-off times),
  // already sorted chronologically by buildGroupFixtures.
  const fixtures = buildGroupFixtures(teamRows);
  for (const fx of fixtures) {
    await query(
      `INSERT INTO fixtures (stage, grp, matchday, kickoff, home_team_id, away_team_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [fx.stage, fx.grp, fx.matchday, fx.kickoff, fx.homeTeamId, fx.awayTeamId]
    );
  }

  // No knockout fixtures are seeded: the Round of 32 onwards depends on group
  // results, so those teams are unknown until the tournament. The bracket page
  // shows the empty TBD structure until the real knockout fixtures arrive via
  // the API import.

  console.log(
    `Seeded ${DEFAULT_PLAYERS.length} players, ${TEAMS.length} teams, ${fixtures.length} group fixtures.`
  );
}

/** Seed only if the database has no teams yet (used on server boot). */
export async function seedIfEmpty() {
  await ensureSchema();
  if (await isEmpty()) await seed();
}

// Allow running directly: `npm run db:seed`
if (process.argv[1]?.endsWith('seed.js')) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
