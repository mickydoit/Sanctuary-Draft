// ESPN unofficial public API — per-match player stats.
// No token required. Fetches the match summary endpoint for a specific event
// and parses goals, assists, yellow cards, and red cards per player+team.

import { normalizeTeamName } from './espn.js';

const SUMMARY_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary';

// ESPN stat label → canonical key (handles ESPN's inconsistent naming)
const STAT_MAP = {
  G: 'goals', GLS: 'goals', GOALS: 'goals',
  A: 'assists', AST: 'assists', ASSISTS: 'assists',
  YC: 'yellow_cards', YLW: 'yellow_cards', YEL: 'yellow_cards', YELLOW: 'yellow_cards',
  RC: 'red_cards', RED: 'red_cards', REDS: 'red_cards',
};

function parseBoxScore(data) {
  const players = [];

  for (const side of (data?.boxscore?.players || [])) {
    const teamName = normalizeTeamName(side.team?.displayName || '');
    if (!teamName) continue;

    for (const statGroup of (side.statistics || [])) {
      const names = statGroup.names || [];

      // Map column index → stat key (skip unrecognised columns)
      const colMap = {};
      names.forEach((n, i) => {
        const key = STAT_MAP[n.toUpperCase()];
        if (key) colMap[i] = key;
      });
      if (!Object.keys(colMap).length) continue;

      for (const entry of (statGroup.athletes || [])) {
        const displayName =
          entry.athlete?.shortName ||
          entry.athlete?.displayName ||
          entry.athlete?.name ||
          '';
        if (!displayName) continue;

        const stats = entry.stats || [];
        const row = {
          player_name: displayName,
          team_name: teamName,
          goals: 0,
          assists: 0,
          yellow_cards: 0,
          red_cards: 0,
        };

        for (const [idx, key] of Object.entries(colMap)) {
          const v = parseInt(stats[idx], 10);
          if (!isNaN(v) && v > 0) row[key] += v;
        }

        if (row.goals > 0 || row.assists > 0 || row.yellow_cards > 0 || row.red_cards > 0) {
          players.push(row);
        }
      }
    }
  }

  return players;
}

export async function fetchMatchStats(espnEventId, fetchImpl = globalThis.fetch) {
  const url = `${SUMMARY_BASE}?event=${espnEventId}`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`ESPN summary ${res.status} for event ${espnEventId}`);
  return parseBoxScore(await res.json());
}
