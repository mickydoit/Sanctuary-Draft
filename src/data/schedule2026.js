// The REAL 2026 FIFA World Cup group-stage schedule — all 72 matches with their
// official kick-off times. Source: FIFA / Wikipedia per-group fixture tables
// (verified June 2026). This replaces the old algorithmic round-robin generator,
// whose pairings/dates/times were placeholders.
//
// Each row is [group, matchday, kickoffUTC, homeCode, awayCode]:
//   - kickoffUTC is the real kick-off instant in UTC (ISO 8601, "Z").
//     The app stores UTC and renders it in the viewer's display timezone.
//   - matchday is the group round (1, 2 or 3).
//   - teams are referenced by their 3-letter code (see teams.js); the builder
//     below resolves codes to the seeded numeric team ids.
//
// NOTE: "home"/"away" mirror the official listing order. The scoring rules treat
// a fixture symmetrically (win/draw/loss), so the order only affects display.

export const GROUP_SCHEDULE = [
  // ---- Group A ----
  ['A', 1, '2026-06-11T19:00:00Z', 'MEX', 'RSA'],
  ['A', 1, '2026-06-12T02:00:00Z', 'KOR', 'CZE'],
  ['A', 2, '2026-06-18T16:00:00Z', 'CZE', 'RSA'],
  ['A', 2, '2026-06-19T01:00:00Z', 'MEX', 'KOR'],
  ['A', 3, '2026-06-25T01:00:00Z', 'CZE', 'MEX'],
  ['A', 3, '2026-06-25T01:00:00Z', 'RSA', 'KOR'],

  // ---- Group B ----
  ['B', 1, '2026-06-12T19:00:00Z', 'CAN', 'BIH'],
  ['B', 1, '2026-06-13T19:00:00Z', 'QAT', 'SUI'],
  ['B', 2, '2026-06-18T19:00:00Z', 'SUI', 'BIH'],
  ['B', 2, '2026-06-18T22:00:00Z', 'CAN', 'QAT'],
  ['B', 3, '2026-06-24T19:00:00Z', 'SUI', 'CAN'],
  ['B', 3, '2026-06-24T19:00:00Z', 'BIH', 'QAT'],

  // ---- Group C ----
  ['C', 1, '2026-06-13T22:00:00Z', 'BRA', 'MAR'],
  ['C', 1, '2026-06-14T01:00:00Z', 'HAI', 'SCO'],
  ['C', 2, '2026-06-19T22:00:00Z', 'SCO', 'MAR'],
  ['C', 2, '2026-06-20T00:30:00Z', 'BRA', 'HAI'],
  ['C', 3, '2026-06-24T22:00:00Z', 'SCO', 'BRA'],
  ['C', 3, '2026-06-24T22:00:00Z', 'MAR', 'HAI'],

  // ---- Group D ----
  ['D', 1, '2026-06-13T01:00:00Z', 'USA', 'PAR'],
  ['D', 1, '2026-06-14T04:00:00Z', 'AUS', 'TUR'],
  ['D', 2, '2026-06-19T19:00:00Z', 'USA', 'AUS'],
  ['D', 2, '2026-06-20T03:00:00Z', 'TUR', 'PAR'],
  ['D', 3, '2026-06-26T02:00:00Z', 'TUR', 'USA'],
  ['D', 3, '2026-06-26T02:00:00Z', 'PAR', 'AUS'],

  // ---- Group E ----
  ['E', 1, '2026-06-14T17:00:00Z', 'GER', 'CUW'],
  ['E', 1, '2026-06-14T23:00:00Z', 'CIV', 'ECU'],
  ['E', 2, '2026-06-20T20:00:00Z', 'GER', 'CIV'],
  ['E', 2, '2026-06-21T00:00:00Z', 'ECU', 'CUW'],
  ['E', 3, '2026-06-25T20:00:00Z', 'CUW', 'CIV'],
  ['E', 3, '2026-06-25T20:00:00Z', 'ECU', 'GER'],

  // ---- Group F ----
  ['F', 1, '2026-06-14T20:00:00Z', 'NED', 'JPN'],
  ['F', 1, '2026-06-15T02:00:00Z', 'SWE', 'TUN'],
  ['F', 2, '2026-06-20T17:00:00Z', 'NED', 'SWE'],
  ['F', 2, '2026-06-21T04:00:00Z', 'TUN', 'JPN'],
  ['F', 3, '2026-06-25T23:00:00Z', 'JPN', 'SWE'],
  ['F', 3, '2026-06-25T23:00:00Z', 'TUN', 'NED'],

  // ---- Group G ----
  ['G', 1, '2026-06-15T19:00:00Z', 'BEL', 'EGY'],
  ['G', 1, '2026-06-16T01:00:00Z', 'IRN', 'NZL'],
  ['G', 2, '2026-06-21T19:00:00Z', 'BEL', 'IRN'],
  ['G', 2, '2026-06-22T01:00:00Z', 'NZL', 'EGY'],
  ['G', 3, '2026-06-27T03:00:00Z', 'EGY', 'IRN'],
  ['G', 3, '2026-06-27T03:00:00Z', 'NZL', 'BEL'],

  // ---- Group H ----
  ['H', 1, '2026-06-15T16:00:00Z', 'ESP', 'CPV'],
  ['H', 1, '2026-06-15T22:00:00Z', 'KSA', 'URU'],
  ['H', 2, '2026-06-21T16:00:00Z', 'ESP', 'KSA'],
  ['H', 2, '2026-06-21T22:00:00Z', 'URU', 'CPV'],
  ['H', 3, '2026-06-27T00:00:00Z', 'CPV', 'KSA'],
  ['H', 3, '2026-06-27T00:00:00Z', 'URU', 'ESP'],

  // ---- Group I ----
  ['I', 1, '2026-06-16T19:00:00Z', 'FRA', 'SEN'],
  ['I', 1, '2026-06-16T22:00:00Z', 'IRQ', 'NOR'],
  ['I', 2, '2026-06-22T21:00:00Z', 'FRA', 'IRQ'],
  ['I', 2, '2026-06-23T00:00:00Z', 'NOR', 'SEN'],
  ['I', 3, '2026-06-26T19:00:00Z', 'NOR', 'FRA'],
  ['I', 3, '2026-06-26T19:00:00Z', 'SEN', 'IRQ'],

  // ---- Group J ----
  ['J', 1, '2026-06-17T01:00:00Z', 'ARG', 'ALG'],
  ['J', 1, '2026-06-17T04:00:00Z', 'AUT', 'JOR'],
  ['J', 2, '2026-06-22T17:00:00Z', 'ARG', 'AUT'],
  ['J', 2, '2026-06-23T03:00:00Z', 'JOR', 'ALG'],
  ['J', 3, '2026-06-28T02:00:00Z', 'ALG', 'AUT'],
  ['J', 3, '2026-06-28T02:00:00Z', 'JOR', 'ARG'],

  // ---- Group K ----
  ['K', 1, '2026-06-17T17:00:00Z', 'POR', 'COD'],
  ['K', 1, '2026-06-18T02:00:00Z', 'UZB', 'COL'],
  ['K', 2, '2026-06-23T17:00:00Z', 'POR', 'UZB'],
  ['K', 2, '2026-06-24T02:00:00Z', 'COL', 'COD'],
  ['K', 3, '2026-06-27T23:30:00Z', 'COL', 'POR'],
  ['K', 3, '2026-06-27T23:30:00Z', 'COD', 'UZB'],

  // ---- Group L ----
  ['L', 1, '2026-06-17T20:00:00Z', 'ENG', 'CRO'],
  ['L', 1, '2026-06-17T23:00:00Z', 'GHA', 'PAN'],
  ['L', 2, '2026-06-23T20:00:00Z', 'ENG', 'GHA'],
  ['L', 2, '2026-06-23T23:00:00Z', 'PAN', 'CRO'],
  ['L', 3, '2026-06-27T21:00:00Z', 'PAN', 'ENG'],
  ['L', 3, '2026-06-27T21:00:00Z', 'CRO', 'GHA'],
];

/**
 * Build flat group-stage fixture rows from the real schedule.
 * @param {Array<{code:string, id?:number}>} teams - team list; id defaults to (index + 1),
 *   matching how the seed assigns team ids in ranking order.
 * @returns {Array<{stage:'group', grp:string, matchday:number, kickoff:string, homeTeamId:number, awayTeamId:number}>}
 *   sorted chronologically by kickoff (then group), so callers can assign ids in order.
 */
export function buildGroupFixtures(teams) {
  const idByCode = new Map(teams.map((t, i) => [t.code, t.id ?? i + 1]));
  return GROUP_SCHEDULE.map(([grp, matchday, kickoff, home, away]) => ({
    stage: 'group',
    grp,
    matchday,
    kickoff,
    homeTeamId: idByCode.get(home),
    awayTeamId: idByCode.get(away),
  })).sort(
    (a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff) || a.grp.localeCompare(b.grp)
  );
}
