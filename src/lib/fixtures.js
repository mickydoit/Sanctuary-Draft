// Pure helpers for generating group-stage fixtures (round-robin). No deps.

/**
 * Round-robin schedule via the circle method.
 * @param {Array} ids - team ids in a group
 * @returns {Array<Array<[home, away]>>} rounds, each an array of [home, away] pairs
 */
export function roundRobin(ids) {
  const arr = [...ids];
  if (arr.length % 2 !== 0) arr.push(null); // bye marker for odd counts
  const m = arr.length;
  const rounds = [];
  for (let r = 0; r < m - 1; r++) {
    const pairs = [];
    for (let i = 0; i < m / 2; i++) {
      const home = arr[i];
      const away = arr[m - 1 - i];
      if (home != null && away != null) pairs.push([home, away]);
    }
    rounds.push(pairs);
    arr.splice(1, 0, arr.pop()); // rotate, keeping the first element fixed
  }
  return rounds;
}

/**
 * Build flat group-stage fixture rows from teams that each have { id, grp }.
 * @returns {Array<{stage:'group', grp:string, matchday:number, homeTeamId, awayTeamId}>}
 */
export function generateGroupFixtures(teams) {
  const byGroup = new Map();
  for (const t of teams) {
    if (!byGroup.has(t.grp)) byGroup.set(t.grp, []);
    byGroup.get(t.grp).push(t.id);
  }

  const fixtures = [];
  for (const grp of [...byGroup.keys()].sort()) {
    const rounds = roundRobin(byGroup.get(grp));
    rounds.forEach((pairs, idx) => {
      for (const [homeTeamId, awayTeamId] of pairs) {
        fixtures.push({ stage: 'group', grp, matchday: idx + 1, homeTeamId, awayTeamId });
      }
    });
  }
  return fixtures;
}
