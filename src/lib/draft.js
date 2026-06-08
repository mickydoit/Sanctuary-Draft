// Pure snake-draft helpers. No database or framework dependencies, so they are
// trivial to unit test.

/**
 * Build the full pick sequence for a snake draft.
 *
 * Round 1 follows `order` (the randomised player order); every even round
 * reverses it, producing 1,2,3,4,5, 5,4,3,2,1, 1,2,3,4,5, ...
 *
 * @param {Array<number|string>} order - player ids in round-1 pick order
 * @param {number} rounds - number of rounds (i.e. teams per player)
 * @returns {Array<{pickNumber:number, round:number, slot:number, playerId:*}>}
 */
export function buildPickSequence(order, rounds) {
  if (!Array.isArray(order) || order.length === 0) {
    throw new Error('order must be a non-empty array');
  }
  if (!Number.isInteger(rounds) || rounds < 1) {
    throw new Error('rounds must be a positive integer');
  }

  const picks = [];
  let pickNumber = 0;
  for (let r = 0; r < rounds; r++) {
    const roundOrder = r % 2 === 0 ? order : [...order].reverse();
    roundOrder.forEach((playerId, i) => {
      pickNumber += 1;
      picks.push({ pickNumber, round: r + 1, slot: i + 1, playerId });
    });
  }
  return picks;
}

/**
 * Fisher–Yates shuffle returning a new array. Used to randomise the initial
 * draft order. `rng` is injectable so tests can be deterministic.
 */
export function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Whose turn is it, given how many picks have already been made?
 * Returns the pick descriptor, or null when the draft is complete.
 */
export function pickAt(sequence, picksMade) {
  return sequence[picksMade] ?? null;
}
