// Poll the score provider (SportMonks by default) and write results straight
// into Supabase. This is what the scheduled GitHub Action runs; you can also run
// it by hand:
//
//   DATABASE_URL="postgres://…supabase…" SPORTMONKS_TOKEN="…" node scripts/sync-scores.mjs
//
// DATABASE_URL must be your Supabase *connection string* (use the IPv4 "Session
// pooler" URI from Supabase → Project Settings → Database). src/db/index.js opens
// it with SSL automatically for any non-localhost host.
import { syncFromApi, scoreProviderStatus } from '../src/api/sync.js';
import { findWorldCupLeagues } from '../src/api/sportmonks.js';

const { name, tokenSet } = scoreProviderStatus();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set — point it at your Supabase connection string.');
  process.exit(1);
}
if (!tokenSet) {
  console.error(`No API token set for provider "${name}". Set SPORTMONKS_TOKEN (or FOOTBALL_DATA_TOKEN).`);
  process.exit(1);
}

try {
  const r = await syncFromApi();
  console.log(
    `[sync] provider=${r.provider} fetched=${r.fetched} ` +
      `teamsLinked=${r.teamsLinked} fixturesLinked=${r.fixturesLinked} ` +
      `updated=${r.updated} inserted=${r.inserted}`
  );

  if (r.fetched === 0) {
    console.warn(`⚠ ${r.provider} returned 0 World Cup matches.`);
    if (name === 'sportmonks') {
      console.warn(
        `  Likely the plan doesn't cover the World Cup, or SPORTMONKS_WC_LEAGUE_ID ` +
          `(currently ${process.env.SPORTMONKS_WC_LEAGUE_ID || 26618}) is wrong.`
      );
      try {
        const leagues = await findWorldCupLeagues(process.env.SPORTMONKS_TOKEN);
        if (!leagues.length) {
          console.warn('  No leagues matched "world cup" for this token — check the token / plan.');
        } else {
          console.warn('  Leagues this token can search — set SPORTMONKS_WC_LEAGUE_ID to the one with fixtures > 0:');
          for (const l of leagues) {
            console.warn(`    id=${l.id}  name="${l.name}"  fixtures_in_window=${l.fixtures}${l.hasMore ? '+' : ''}`);
          }
        }
      } catch (e) {
        console.warn(`  League lookup failed: ${e.message}`);
      }
    } else if (name === 'football-data') {
      console.warn(
        '  The 2026 World Cup matches may not be published on football-data.org yet ' +
          '(they often appear closer to kickoff). If they never show up, double-check ' +
          'that FOOTBALL_DATA_TOKEN is valid.'
      );
    }
  }
  if (r.unmatched.length) {
    console.warn(
      `⚠ Could not match these API teams to seeded teams: ${r.unmatched.join(', ')}. ` +
        'Add the spelling to the table in src/data/fifaRankings.js.'
    );
  }
  process.exit(0);
} catch (err) {
  console.error('[sync] failed:', err.message);
  process.exit(1);
}
