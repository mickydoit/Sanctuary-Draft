// Pure view-model builders, ported from src/repo.js but operating on the plain
// arrays returned by store.loadAll() instead of SQL. Reuses the same tested
// rules engine (lib/scoring.js, lib/draft.js).

import { buildPickSequence } from './lib/draft.js?v=2';
import { computeLadder, DEFAULT_STAGE_POINTS } from './lib/scoring.js?v=2';
import { TEAMS_PER_PLAYER } from './lib/teams.js?v=2';

const DISPLAY_TZ = 'Australia/Sydney';
const DATE_FMT = new Intl.DateTimeFormat('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: DISPLAY_TZ });
const SHORT_DATE_FMT = new Intl.DateTimeFormat('en-AU', { day: '2-digit', month: '2-digit', timeZone: DISPLAY_TZ });
const TIME_FMT = new Intl.DateTimeFormat('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: DISPLAY_TZ });
const STAGE_LABEL = { group: 'Group', R32: 'Round of 32', R16: 'Round of 16', QF: 'Quarter-final', SF: 'Semi-final', third: '3rd place', final: 'Final' };

const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));
const ownershipMap = (picks) => Object.fromEntries(picks.map((p) => [p.team_id, p.player_id]));

const KO_STAGES = ['R32', 'R16', 'QF', 'SF', 'third', 'final'];

// Returns a predicate (teamId) => still in the tournament.
// A team is out if it lost a finished knockout match, or — once the knockout
// bracket exists — it never made the bracket (i.e. it was eliminated when the
// group stage finished). The bracket is empty until the group stage ends, so
// during the group stage every team still counts as alive.
function survivingTeams(fixtures) {
  const ko = fixtures.filter((f) => KO_STAGES.includes(f.stage));

  // Teams appearing anywhere in the knockout bracket = the group qualifiers.
  const qualified = new Set();
  for (const f of ko) {
    if (f.home_team_id != null) qualified.add(f.home_team_id);
    if (f.away_team_id != null) qualified.add(f.away_team_id);
  }
  const bracketDrawn = qualified.size > 0;

  // Teams that lost a finished knockout match are knocked out.
  const eliminated = new Set();
  for (const f of ko) {
    if (f.status !== 'finished' || f.winner_team_id == null) continue;
    const loser = f.winner_team_id === f.home_team_id ? f.away_team_id : f.home_team_id;
    if (loser != null) eliminated.add(loser);
  }

  return (teamId) => !eliminated.has(teamId) && (!bracketDrawn || qualified.has(teamId));
}

function rankSort(a, b) {
  const ra = a.ranking ?? Infinity, rb = b.ranking ?? Infinity;
  return ra - rb || String(a.name).localeCompare(String(b.name));
}

export function getDraftState(data) {
  const { settings, picks, teams } = data;
  const started = settings.draft_status !== 'not_started';
  const players = started
    ? data.players.filter((p) => p.draft_slot != null).sort((a, b) => a.draft_slot - b.draft_slot)
    : [...data.players].sort((a, b) => a.id - b.id);

  const teamById = byId(teams);
  const playerById = byId(data.players);
  const takenIds = new Set(picks.map((p) => p.team_id));
  const available = teams.filter((t) => !takenIds.has(t.id)).sort(rankSort);

  const detailed = [...picks]
    .sort((a, b) => a.pick_number - b.pick_number)
    .map((p) => {
      const t = teamById[p.team_id] || {};
      return { ...p, team_name: t.name, team_code: t.code, team_grp: t.grp, team_ranking: t.ranking, player_name: (playerById[p.player_id] || {}).name };
    });

  const rosters = new Map(players.map((p) => [p.id, []]));
  for (const pick of detailed) {
    if (!rosters.has(pick.player_id)) rosters.set(pick.player_id, []);
    rosters.get(pick.player_id).push(pick);
  }

  let current = null, upcoming = [], totalPicks = 0;
  if (started) {
    const seq = buildPickSequence(players.map((p) => p.id), TEAMS_PER_PLAYER);
    totalPicks = seq.length;
    const nameById = Object.fromEntries(players.map((p) => [p.id, p.name]));
    const slot = picks.length;
    current = seq[slot] ? { ...seq[slot], playerName: nameById[seq[slot].playerId] } : null;
    upcoming = seq.slice(slot + 1, slot + 6).map((s) => ({ ...s, playerName: nameById[s.playerId] }));
  }

  return {
    settings,
    players: players.map((p) => ({ ...p, roster: rosters.get(p.id) || [] })),
    available,
    current,
    upcoming,
    picksMade: picks.length,
    totalPicks,
    teamsPerPlayer: TEAMS_PER_PLAYER,
  };
}

function decorateFixture(f, teamById, ownerNameByTeam) {
  const d = f.kickoff ? new Date(f.kickoff) : null;
  const home = teamById[f.home_team_id] || {};
  const away = teamById[f.away_team_id] || {};
  return {
    ...f,
    home_name: home.name, home_code: home.code,
    away_name: away.name, away_code: away.code,
    home_owner: ownerNameByTeam[f.home_team_id] || null,
    away_owner: ownerNameByTeam[f.away_team_id] || null,
    home_is_winner: f.winner_team_id != null && f.winner_team_id === f.home_team_id,
    away_is_winner: f.winner_team_id != null && f.winner_team_id === f.away_team_id,
    time_label: d ? TIME_FMT.format(d) : '',
    date_label: d ? DATE_FMT.format(d) : 'Date TBC',
    short_date_label: d ? SHORT_DATE_FMT.format(d) : '',
    stage_label: f.stage === 'group' ? `Group ${f.grp}` : (STAGE_LABEL[f.stage] || f.stage),
  };
}

function ownerNames(data) {
  const playerById = byId(data.players);
  const own = ownershipMap(data.picks);
  const out = {};
  for (const [teamId, playerId] of Object.entries(own)) out[teamId] = (playerById[playerId] || {}).name || null;
  return out;
}

const fxSort = (a, b) => {
  const ka = a.kickoff ? Date.parse(a.kickoff) : Infinity;
  const kb = b.kickoff ? Date.parse(b.kickoff) : Infinity;
  return ka - kb || a.id - b.id;
};

export function getFixturesView(data) {
  const teamById = byId(data.teams);
  const owners = ownerNames(data);
  const fixtures = [...data.fixtures].sort(fxSort).map((f) => decorateFixture(f, teamById, owners));
  const groups = {};
  for (const f of fixtures) (groups[f.date_label] ||= []).push(f);
  return Object.entries(groups).map(([title, items]) => ({
    title,
    fixtures: items,
    allPlayed: items.every(f => f.status === 'finished'),
    date_ts: items[0]?.kickoff ? Date.parse(items[0].kickoff) : null,
  }));
}

const KO_ROUNDS = [
  { stage: 'R32', label: 'Round of 32', expected: 16, pts: 1 },
  { stage: 'R16', label: 'Round of 16', expected: 8, pts: 2 },
  { stage: 'QF', label: 'Quarter-finals', expected: 4, pts: 3 },
  { stage: 'SF', label: 'Semi-finals', expected: 2, pts: 4 },
  { stage: 'final', label: 'Final', expected: 1, pts: 5 },
];

export function getBracket(data) {
  const teamById = byId(data.teams);
  const owners = ownerNames(data);
  const ko = data.fixtures.filter((f) => KO_STAGES.includes(f.stage));
  const decorated = [...ko].sort(fxSort).map((f) => decorateFixture(f, teamById, owners));

  const byStage = {};
  for (const f of decorated) (byStage[f.stage] ||= []).push(f);

  const rounds = KO_ROUNDS.map((rd) => {
    const matches = (byStage[rd.stage] || []).slice();
    while (matches.length < rd.expected) matches.push({ tbd: true, stage: rd.stage });
    return { ...rd, matches };
  });

  return { rounds, thirdPlace: (byStage.third || [])[0] || null, hasAny: ko.length > 0 };
}

export function getLadder(data, bonusByPlayer = []) {
  const ownership = ownershipMap(data.picks);
  const finished = data.fixtures
    .filter((f) => f.status === 'finished')
    .map((f) => ({ id: f.id, stage: f.stage, homeTeamId: f.home_team_id, awayTeamId: f.away_team_id, homeScore: f.home_score, awayScore: f.away_score, winnerTeamId: f.winner_team_id }));

  const stagePoints = { ...DEFAULT_STAGE_POINTS, third: data.settings.score_third_place ? 1 : 0 };
  const totals = computeLadder(finished, { ownership, stagePoints });

  const alive = survivingTeams(data.fixtures);
  const teamCounts = {};
  for (const pick of data.picks) {
    if (alive(pick.team_id)) teamCounts[pick.player_id] = (teamCounts[pick.player_id] || 0) + 1;
  }

  const bonusMap = Object.fromEntries(bonusByPlayer.map(({ name, pts }) => [name, pts]));

  const current = [...data.players]
    .map((p) => {
      const base = totals[p.id] ?? 0;
      const bonus = bonusMap[p.name] ?? 0;
      return { ...p, points: base + bonus, basePoints: base, bonusPoints: bonus, teamCount: teamCounts[p.id] ?? 0 };
    })
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

  // Movement: compare current rank to rank before the last completed matchday
  const finDates = [...new Set(
    data.fixtures.filter(f => f.status === 'finished' && f.kickoff).map(f => f.kickoff.slice(0, 10))
  )].sort();
  let prevRankById = null;
  if (finDates.length >= 2) {
    const lastDate = finDates[finDates.length - 1];
    const prevFin = data.fixtures
      .filter(f => f.status === 'finished' && f.kickoff && f.kickoff.slice(0, 10) < lastDate)
      .map(f => ({ id: f.id, stage: f.stage, homeTeamId: f.home_team_id, awayTeamId: f.away_team_id, homeScore: f.home_score, awayScore: f.away_score, winnerTeamId: f.winner_team_id }));
    const prevTotals = computeLadder(prevFin, { ownership, stagePoints });
    const prevRanked = [...data.players]
      .map(p => ({ id: p.id, name: p.name, pts: (prevTotals[p.id] ?? 0) + (bonusMap[p.name] ?? 0) }))
      .sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name));
    prevRankById = Object.fromEntries(prevRanked.map((p, i) => [p.id, i + 1]));
  }

  return current.map((p, i) => ({
    ...p,
    movement: prevRankById ? (prevRankById[p.id] ?? null) - (i + 1) : null,
  }));
}

export function getGroupStandings(data) {
  const stand = {};
  for (const t of data.teams) {
    stand[t.id] = { id: t.id, name: t.name, code: t.code, grp: t.grp, P:0, W:0, D:0, L:0, GF:0, GA:0, GD:0, Pts:0 };
  }
  for (const f of data.fixtures) {
    if (f.stage !== 'group' || f.status !== 'finished' || f.home_score == null || f.away_score == null) continue;
    const h = stand[f.home_team_id], a = stand[f.away_team_id];
    if (!h || !a) continue;
    h.P++; a.P++;
    h.GF += f.home_score; h.GA += f.away_score;
    a.GF += f.away_score; a.GA += f.home_score;
    if (f.home_score > f.away_score) { h.W++; h.Pts += 3; a.L++; }
    else if (f.home_score < f.away_score) { a.W++; a.Pts += 3; h.L++; }
    else { h.D++; h.Pts++; a.D++; a.Pts++; }
  }
  for (const s of Object.values(stand)) s.GD = s.GF - s.GA;
  const grpMap = {};
  for (const s of Object.values(stand)) (grpMap[s.grp] ||= []).push(s);
  for (const teams of Object.values(grpMap)) {
    teams.sort((a, b) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF || a.name.localeCompare(b.name));
  }
  return Object.entries(grpMap).sort(([a], [b]) => a.localeCompare(b)).map(([grp, teams]) => ({ grp, teams }));
}

export function getTeamsView(data) {
  const teamById = byId(data.teams);
  const rosterByPlayer = {};
  for (const pick of data.picks) (rosterByPlayer[pick.player_id] ||= []).push(pick.team_id);
  return [...data.players]
    .sort((a, b) => (a.draft_slot ?? 99) - (b.draft_slot ?? 99) || a.name.localeCompare(b.name))
    .map((p) => ({
      ...p,
      teams: (rosterByPlayer[p.id] || []).map((tid) => teamById[tid]).filter(Boolean).sort(rankSort),
    }));
}

export function getPlayerView(data, playerId) {
  const teamById = byId(data.teams);
  const owners = ownerNames(data);
  const player = data.players.find((p) => p.id === playerId);
  if (!player) return null;
  const teamIds = new Set(data.picks.filter((p) => p.player_id === playerId).map((p) => p.team_id));
  return {
    player,
    teams: [...teamIds].map((tid) => teamById[tid]).filter(Boolean).sort(rankSort),
    fixtures: [...data.fixtures]
      .filter((f) => teamIds.has(f.home_team_id) || teamIds.has(f.away_team_id))
      .sort(fxSort)
      .map((f) => decorateFixture(f, teamById, owners)),
  };
}

export function getTeamView(data, teamId) {
  const teamById = byId(data.teams);
  const owners = ownerNames(data);
  const team = teamById[teamId];
  if (!team) return null;
  return {
    team,
    fixtures: [...data.fixtures]
      .filter((f) => f.home_team_id === teamId || f.away_team_id === teamId)
      .sort(fxSort)
      .map((f) => decorateFixture(f, teamById, owners)),
  };
}

// ---------------------------------------------------------------- Stats
const FIFA_AWARDS = [
  { key: 'golden_glove',      label: 'Golden Glove',          desc: 'Best goalkeeper — announced by FIFA. Owner of that keeper\'s team wins.' },
  { key: 'best_young_player', label: 'Best Young Player',     desc: 'FIFA\'s best U21 player. Owner of that player\'s team wins.' },
  { key: 'goal_of_tournament',label: 'Goal of the Tournament',desc: 'FIFA fan vote. Owner of the scoring player\'s team wins.' },
];

export function getStats(data, statsData) {
  const { playerStats = [], awardWinners = [] } = statsData || {};
  const { teams, picks, players, fixtures } = data;

  // team name (lowercase) → owner's display name
  const playerById2 = byId(players);
  const ownerByTeamName = {};
  for (const pick of picks) {
    const t = teams.find((x) => x.id === pick.team_id);
    if (t) ownerByTeamName[t.name.toLowerCase()] = (playerById2[pick.player_id] || {}).name || null;
  }
  const getOwner = (teamName) => ownerByTeamName[(teamName || '').toLowerCase()] || null;

  // --- Golden Boot (top scorers) ---
  const goldenBoot = [...playerStats]
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists)
    .slice(0, 5)
    .map((ps) => ({ ...ps, ownerName: getOwner(ps.team_name) }));

  // --- Top Assists ---
  const topAssists = [...playerStats]
    .sort((a, b) => b.assists - a.assists || b.goals - a.goals)
    .slice(0, 5)
    .map((ps) => ({ ...ps, ownerName: getOwner(ps.team_name) }));

  // --- Cards per team (aggregate from player_stats) ---
  const cardsByTeam = {};
  for (const ps of playerStats) {
    const k = ps.team_name;
    if (!cardsByTeam[k]) cardsByTeam[k] = { team_name: k, yellow_cards: 0, red_cards: 0 };
    cardsByTeam[k].yellow_cards += ps.yellow_cards;
    cardsByTeam[k].red_cards    += ps.red_cards;
  }
  const teamCardList = Object.values(cardsByTeam);

  // --- Most Red Cards ---
  const mostRedCards = [...teamCardList]
    .sort((a, b) => b.red_cards - a.red_cards || b.yellow_cards - a.yellow_cards)
    .slice(0, 5)
    .map((tc) => ({ ...tc, ownerName: getOwner(tc.team_name) }));

  // --- Fair Play (fewest cards) ---
  const fairPlay = [...teamCardList]
    .filter((tc) => tc.yellow_cards > 0 || tc.red_cards > 0) // only teams with card data
    .sort((a, b) => a.yellow_cards - b.yellow_cards || a.red_cards - b.red_cards)
    .slice(0, 5)
    .map((tc) => ({ ...tc, ownerName: getOwner(tc.team_name) }));

  // --- Clean Sheets (computed from fixtures table) ---
  const csMap = {};
  const gaMap = {};
  const teamNameById = Object.fromEntries(teams.map((t) => [t.id, t.name]));
  for (const f of fixtures) {
    if (f.status !== 'finished' || f.home_score == null || f.away_score == null) continue;
    const hn = teamNameById[f.home_team_id];
    const an = teamNameById[f.away_team_id];
    if (hn) {
      gaMap[hn] = (gaMap[hn] || 0) + f.away_score;
      if (f.away_score === 0) csMap[hn] = (csMap[hn] || 0) + 1;
    }
    if (an) {
      gaMap[an] = (gaMap[an] || 0) + f.home_score;
      if (f.home_score === 0) csMap[an] = (csMap[an] || 0) + 1;
    }
  }
  const cleanSheets = Object.entries(csMap)
    .map(([name, cs]) => ({ team_name: name, clean_sheets: cs, goals_against: gaMap[name] || 0, ownerName: getOwner(name) }))
    .sort((a, b) => b.clean_sheets - a.clean_sheets || a.goals_against - b.goals_against)
    .slice(0, 5);

  // --- Group Standings (computed from fixtures) ---
  const allGroups = [...new Set(teams.filter((t) => t.grp).map((t) => t.grp))].sort();
  const gStandings = {}; // grp → { teamId → { pts, gd, played } }
  for (const f of fixtures) {
    if (f.stage !== 'group' || f.status !== 'finished' || f.home_score == null) continue;
    const grp = f.grp || '?';
    if (!gStandings[grp]) gStandings[grp] = {};
    for (const [tid, scored, conceded] of [
      [f.home_team_id, f.home_score, f.away_score],
      [f.away_team_id, f.away_score, f.home_score],
    ]) {
      if (!tid) continue;
      if (!gStandings[grp][tid]) gStandings[grp][tid] = { teamId: tid, pts: 0, gd: 0, played: 0 };
      const row = gStandings[grp][tid];
      row.played++;
      row.gd += scored - conceded;
      if (scored > conceded) row.pts += 3;
      else if (scored === conceded) row.pts += 1;
    }
  }

  const groups = allGroups.map((grp) => {
    const standings = gStandings[grp];
    if (!standings || !Object.keys(standings).length) {
      return { grp, top: null, pts: null, played: false };
    }
    const sorted = Object.values(standings).sort((a, b) => b.pts - a.pts || b.gd - a.gd);
    const topRow = sorted[0];
    const team = teams.find((t) => t.id === topRow.teamId);
    // Only confirmed as "top" if group play is complete (3 matches per team = 3 matchdays)
    const complete = sorted.every((r) => r.played >= 3);
    return {
      grp,
      top: team ? team.name : null,
      pts: topRow.pts,
      played: true,
      complete,
      ownerName: team ? getOwner(team.name) : null,
    };
  });

  // --- FIFA Awards ---
  const awardsMap = Object.fromEntries(awardWinners.map((a) => [a.award, a]));
  const fifaAwards = FIFA_AWARDS.map((def) => {
    const w = awardsMap[def.key] || null;
    return { ...def, winner: w, ownerName: w?.team_name ? getOwner(w.team_name) : null };
  });

  // --- Bonus pts per player (each award leader = +0.25) ---
  const bonusMap = {};
  const award = (teamName) => {
    const o = getOwner(teamName);
    if (o) bonusMap[o] = (bonusMap[o] || 0) + 0.25;
  };
  if (goldenBoot[0])   award(goldenBoot[0].team_name);
  if (topAssists[0])   award(topAssists[0].team_name);
  if (mostRedCards[0]) award(mostRedCards[0].team_name);
  if (cleanSheets[0])  award(cleanSheets[0].team_name);
  if (fairPlay[0])     award(fairPlay[0].team_name);
  for (const g of groups) { if (g.top) award(g.top); }
  for (const fa of fifaAwards) { if (fa.winner?.team_name) award(fa.winner.team_name); }

  const bonusByPlayer = players
    .map((p) => ({ name: p.name, pts: bonusMap[p.name] || 0 }))
    .sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name));

  return { goldenBoot, topAssists, mostRedCards, fairPlay, cleanSheets, groups, fifaAwards, bonusByPlayer };
}
