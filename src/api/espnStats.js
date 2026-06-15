// ESPN unofficial public API — per-match player stats via the rosters endpoint.
// No token required. Stats (goals, assists, cards) live in rosters[].roster[].stats
// with the 'abbreviation' property (G, A, YC, RC).

import { normalizeTeamName } from './espn.js';

const STAT_MAP = {
  G:  'goals',        A:   'assists',
  YC: 'yellow_cards', RC:  'red_cards',
};

export function parseRosterStats(summaryJson) {
  const players = [];
  for (const side of (summaryJson?.rosters || [])) {
    const teamName = normalizeTeamName(side.team?.displayName || '');
    if (!teamName) continue;
    for (const entry of (side.roster || [])) {
      const displayName = entry.athlete?.displayName || entry.athlete?.shortName || '';
      if (!displayName) continue;
      const row = { player_name: displayName, team_name: teamName, goals: 0, assists: 0, yellow_cards: 0, red_cards: 0 };
      for (const s of (entry.stats || [])) {
        const key = STAT_MAP[(s.abbreviation || '').toUpperCase()];
        if (key) {
          const v = parseFloat(s.value || 0);
          if (v > 0) row[key] += v;
        }
      }
      if (row.goals > 0 || row.assists > 0 || row.yellow_cards > 0 || row.red_cards > 0) {
        players.push(row);
      }
    }
  }
  return players;
}

// Kept for backwards-compat; prefer the scoreboard-matched approach in sync-stats.mjs.
export async function fetchMatchStats(espnEventId, leagueSlug = 'fifa.world', fetchImpl = globalThis.fetch) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueSlug}/summary?event=${espnEventId}`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`ESPN summary ${res.status} for event ${espnEventId}`);
  return parseRosterStats(await res.json());
}
