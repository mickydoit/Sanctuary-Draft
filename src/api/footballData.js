// Client for football-data.org (free tier covers the World Cup, competition WC).
// Network access is isolated in fetchMatches(); the mapping/normalisation below
// is pure and unit-tested.

const BASE = 'https://api.football-data.org/v4';
const COMPETITION = 'WC';

const STAGE_MAP = {
  GROUP_STAGE: 'group',
  LAST_32: 'R32',
  ROUND_OF_32: 'R32',
  LAST_16: 'R16',
  ROUND_OF_16: 'R16',
  QUARTER_FINALS: 'QF',
  QUARTER_FINAL: 'QF',
  SEMI_FINALS: 'SF',
  SEMI_FINAL: 'SF',
  THIRD_PLACE: 'third',
  FINAL: 'final',
};

export function mapStage(apiStage) {
  return STAGE_MAP[apiStage] || null;
}

/** 'GROUP_A' -> 'A'; anything without a trailing letter -> null. */
export function mapGroup(apiGroup) {
  if (!apiGroup) return null;
  const m = /([A-L])\s*$/i.exec(apiGroup);
  return m ? m[1].toUpperCase() : null;
}

export function normalizeMatch(m) {
  const tla = (t) => (t?.tla ? t.tla : null);
  const apiIdOf = (t) => (t?.id != null ? String(t.id) : null);
  return {
    apiId: String(m.id),
    utcDate: m.utcDate || null,
    status: m.status,
    finished: m.status === 'FINISHED',
    stage: mapStage(m.stage),
    group: mapGroup(m.group),
    home: { apiId: apiIdOf(m.homeTeam), name: m.homeTeam?.name || null, code: tla(m.homeTeam) },
    away: { apiId: apiIdOf(m.awayTeam), name: m.awayTeam?.name || null, code: tla(m.awayTeam) },
    homeScore: m.score?.fullTime?.home ?? null,
    awayScore: m.score?.fullTime?.away ?? null,
    winnerSide: m.score?.winner ?? null, // HOME_TEAM | AWAY_TEAM | DRAW | null
  };
}

export function normalizeMatches(json) {
  return (json?.matches || []).map(normalizeMatch);
}

/** Fetch + normalise all World Cup matches. `fetchImpl` is injectable for tests. */
export async function fetchMatches(token, fetchImpl = fetch) {
  if (!token) throw new Error('FOOTBALL_DATA_TOKEN is not set');
  const res = await fetchImpl(`${BASE}/competitions/${COMPETITION}/matches`, {
    headers: { 'X-Auth-Token': token },
  });
  if (!res.ok) {
    throw new Error(`football-data.org returned ${res.status} ${res.statusText || ''}`.trim());
  }
  return normalizeMatches(await res.json());
}
