// Client for the SportMonks Football API v3.
//
// We poll /fixtures/between/{from}/{to} filtered to the World Cup league, which
// returns finished, in-play AND upcoming matches in one call (the ladder needs
// finished results, so the /livescores/inplay endpoint alone is insufficient).
// normalizeFixture() translates a SportMonks fixture into the same neutral shape
// our sync layer (src/api/sync.js) consumes, so it's a drop-in score provider.
//
// Field references (SportMonks v3):
//   participants[].meta.location = 'home' | 'away', meta.winner = bool
//   scores[] = { participant_id, description, score: { goals, participant } }
//     -> description 'CURRENT' is the running/full-time total
//   state_id: 5 = FT, 7 = AET (after extra time), 8 = FT_PEN (after penalties)

const BASE = 'https://api.sportmonks.com/v3/football';
const WC_LEAGUE_ID = Number(process.env.SPORTMONKS_WC_LEAGUE_ID || 26618);
const WC_FROM = process.env.SPORTMONKS_WC_FROM || '2026-06-01';
const WC_TO = process.env.SPORTMONKS_WC_TO || '2026-07-31';
const INCLUDES = 'participants;scores;state;round;stage;group;league';

const FINISHED_STATE_IDS = new Set([5, 7, 8]); // FT, AET, FT_PEN

/** Map a SportMonks stage/round name to our stage code. Order matters. */
export function mapStageName(name) {
  if (!name) return null;
  const s = name.toLowerCase();
  if (s.includes('group')) return 'group';
  if (s.includes('quarter')) return 'QF';
  if (s.includes('semi')) return 'SF';
  if (s.includes('third') || s.includes('3rd')) return 'third';
  if (s.includes('round of 16') || s.includes('last 16') || s.includes('8th') || s.includes('eighth')) return 'R16';
  if (s.includes('round of 32') || s.includes('last 32') || s.includes('16th')) return 'R32';
  if (s.includes('final')) return 'final'; // checked last so it doesn't catch *-final
  return null;
}

function stageOf(fx) {
  if (fx.group || fx.group_id) return 'group';
  return mapStageName(fx.stage?.name) || mapStageName(fx.round?.name);
}

function groupLetterOf(fx) {
  const name = fx.group?.name;
  if (!name) return null;
  const m = /([A-L])\s*$/i.exec(name);
  return m ? m[1].toUpperCase() : null;
}

function kickoffIso(fx) {
  if (fx.starting_at_timestamp) return new Date(fx.starting_at_timestamp * 1000).toISOString();
  if (fx.starting_at) return fx.starting_at.replace(' ', 'T') + 'Z';
  return null;
}

const goalsFor = (scores, participantId, description) => {
  const e = scores.find((s) => s.participant_id === participantId && s.description === description);
  return e?.score?.goals ?? null;
};

export function normalizeFixture(fx) {
  const participants = fx.participants || [];
  const home = participants.find((p) => p.meta?.location === 'home') || null;
  const away = participants.find((p) => p.meta?.location === 'away') || null;
  const scores = fx.scores || [];

  const stateId = fx.state_id ?? fx.state?.id ?? null;
  const finished = FINISHED_STATE_IDS.has(stateId);
  const homeScore = home ? goalsFor(scores, home.id, 'CURRENT') : null;
  const awayScore = away ? goalsFor(scores, away.id, 'CURRENT') : null;

  // Winner: prefer the explicit meta.winner flag (correct even on penalties),
  // then fall back to the current score, then the penalty shootout score.
  let winnerSide = null;
  const flagged = participants.find((p) => p.meta?.winner === true);
  if (flagged) {
    winnerSide = flagged.meta.location === 'home' ? 'HOME_TEAM' : 'AWAY_TEAM';
  } else if (finished && homeScore != null && awayScore != null) {
    if (homeScore > awayScore) winnerSide = 'HOME_TEAM';
    else if (awayScore > homeScore) winnerSide = 'AWAY_TEAM';
    else {
      const hp = home ? goalsFor(scores, home.id, 'PENALTIES') : null;
      const ap = away ? goalsFor(scores, away.id, 'PENALTIES') : null;
      if (hp != null && ap != null && hp !== ap) winnerSide = hp > ap ? 'HOME_TEAM' : 'AWAY_TEAM';
    }
  }

  const side = (p) => (p ? { apiId: String(p.id), name: p.name || null, code: p.short_code || null } : { apiId: null, name: null, code: null });

  return {
    apiId: String(fx.id),
    utcDate: kickoffIso(fx),
    status: finished ? 'FINISHED' : String(stateId ?? 'SCHEDULED'),
    finished,
    stage: stageOf(fx),
    group: groupLetterOf(fx),
    home: side(home),
    away: side(away),
    homeScore,
    awayScore,
    winnerSide,
  };
}

/** Filter a raw fixtures array to the World Cup league and normalize. */
export function normalizeResponse(fixtures) {
  return (fixtures || [])
    .filter((fx) => (fx.league_id ?? fx.league?.id) === WC_LEAGUE_ID)
    .map(normalizeFixture);
}

/** Fetch all World Cup fixtures in the tournament window (handles pagination). */
export async function fetchMatches(token, fetchImpl = fetch) {
  if (!token) throw new Error('SPORTMONKS_TOKEN is not set');
  const all = [];
  let page = 1;
  for (let guard = 0; guard < 20; guard++) {
    const url = new URL(`${BASE}/fixtures/between/${WC_FROM}/${WC_TO}`);
    url.searchParams.set('api_token', token);
    url.searchParams.set('include', INCLUDES);
    url.searchParams.set('filters', `fixtureLeagues:${WC_LEAGUE_ID}`);
    url.searchParams.set('per_page', '50');
    url.searchParams.set('page', String(page));

    const res = await fetchImpl(url.toString());
    if (!res.ok) throw new Error(`SportMonks returned ${res.status} ${res.statusText || ''}`.trim());
    const json = await res.json();
    if (Array.isArray(json.data)) all.push(...json.data);
    if (json.pagination?.has_more) page += 1;
    else break;
  }
  return normalizeResponse(all);
}

/**
 * Diagnostic for when a normal fetch returns no World Cup fixtures: search the
 * provider's leagues for "world cup" and, for each hit, count fixtures in the
 * tournament window. This reveals which league id THIS token can actually pull
 * (the one with fixtures > 0 is the value to use for SPORTMONKS_WC_LEAGUE_ID).
 * Returns [{ id, name, fixtures, hasMore }]; a single league's probe failing is
 * swallowed (reported as 0) so one bad id doesn't hide the others.
 */
export async function findWorldCupLeagues(token, fetchImpl = fetch) {
  if (!token) throw new Error('SPORTMONKS_TOKEN is not set');
  const searchUrl = `${BASE}/leagues/search/${encodeURIComponent('world cup')}?api_token=${token}`;
  const res = await fetchImpl(searchUrl);
  if (!res.ok) throw new Error(`leagues/search returned ${res.status} ${res.statusText || ''}`.trim());
  const json = await res.json();
  const leagues = Array.isArray(json.data) ? json.data : [];

  const out = [];
  for (const l of leagues) {
    const url = new URL(`${BASE}/fixtures/between/${WC_FROM}/${WC_TO}`);
    url.searchParams.set('api_token', token);
    url.searchParams.set('filters', `fixtureLeagues:${l.id}`);
    url.searchParams.set('per_page', '50');
    let fixtures = 0;
    let hasMore = false;
    try {
      const fr = await fetchImpl(url.toString());
      if (fr.ok) {
        const fj = await fr.json();
        fixtures = Array.isArray(fj.data) ? fj.data.length : 0;
        hasMore = Boolean(fj.pagination?.has_more);
      }
    } catch {
      // ignore a single league's probe failure; it's reported as 0 fixtures
    }
    out.push({ id: l.id, name: l.name, fixtures, hasMore });
  }
  return out;
}
