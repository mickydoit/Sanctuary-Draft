// Pure scoring engine for the World Cup draft. No database or framework deps.
//
// Rules encoded here:
//   - Group stage:  win = 1, draw = 0.5, loss = 0.
//   - Knockout win points: R32 = 1, R16 = 2, QF = 3, SF = 4, Final = 5.
//   - Knockouts decided by penalties: the advancing team takes the FULL win
//     points (there is no 0.5 outside the group stage).
//   - Third-place playoff: scored as a 1-point win (configurable on/off).
//   - Own-vs-own (one player owns both teams in a fixture): a guaranteed
//     result. A draw scores 0.5; any decisive result scores the full win
//     points (the player is certain to own whichever team wins).

export const STAGES = ['group', 'R32', 'R16', 'QF', 'SF', 'third', 'final'];

/** Points awarded for a WIN at each stage. (Group draws are worth 0.5.) */
export const DEFAULT_STAGE_POINTS = {
  group: 1,
  R32: 1,
  R16: 2,
  QF: 3,
  SF: 4,
  third: 1, // third-place playoff scored as a 1-point win
  final: 5,
};

const ownerOf = (ownership, teamId) =>
  ownership instanceof Map ? ownership.get(teamId) : ownership?.[teamId];

/**
 * Determine the winning team id for a finished fixture.
 * Group games derive it from the score; knockouts use winnerTeamId (which the
 * API/admin sets, and which already accounts for extra time and penalties).
 * Returns null for a group-stage draw.
 */
function winnerOf(fx) {
  if (fx.stage === 'group') {
    if (fx.homeScore === fx.awayScore) return null;
    return fx.homeScore > fx.awayScore ? fx.homeTeamId : fx.awayTeamId;
  }
  return fx.winnerTeamId ?? null;
}

/**
 * Compute the points each player earns from a single FINISHED fixture.
 *
 * @param {object} fx - { id, stage, homeTeamId, awayTeamId, homeScore, awayScore, winnerTeamId }
 * @param {object} opts
 *   - ownership:   Map or object of teamId -> playerId (undrafted teams absent)
 *   - stagePoints: override for DEFAULT_STAGE_POINTS
 * @returns {Object<string, number>} playerId -> points earned from this fixture
 */
export function scoreFixture(fx, { ownership, stagePoints = DEFAULT_STAGE_POINTS } = {}) {
  const homeOwner = ownerOf(ownership, fx.homeTeamId);
  const awayOwner = ownerOf(ownership, fx.awayTeamId);
  const winValue = stagePoints[fx.stage] ?? 0;

  const result = {};
  const add = (player, pts) => {
    if (player == null || pts === 0) return;
    result[player] = (result[player] ?? 0) + pts;
  };

  const isGroup = fx.stage === 'group';
  const drawn = isGroup && fx.homeScore === fx.awayScore;
  const winner = winnerOf(fx);

  // Same player owns BOTH teams -> guaranteed result: a draw scores 0.5, any
  // decisive result scores the full win points (no winner to nominate, since
  // whichever of their teams wins, the player owns it).
  if (homeOwner != null && homeOwner === awayOwner) {
    add(homeOwner, drawn ? 0.5 : winValue);
    return result;
  }

  // Different owners (one or both may be undrafted -> ownerOf returns undefined).
  if (drawn) {
    add(homeOwner, 0.5);
    add(awayOwner, 0.5);
    return result;
  }
  add(ownerOf(ownership, winner), winValue);
  // the loser earns 0
  return result;
}

/**
 * Sum points across many finished fixtures.
 * @returns {Object<string, number>} playerId -> total points
 */
export function computeLadder(fixtures, opts) {
  const totals = {};
  for (const fx of fixtures) {
    for (const [player, pts] of Object.entries(scoreFixture(fx, opts))) {
      totals[player] = (totals[player] ?? 0) + pts;
    }
  }
  return totals;
}
