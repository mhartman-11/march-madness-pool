// Snake draft logic for 12 teams, 10 rounds (120 total picks)

export const TOTAL_TEAMS = 12;
export const TOTAL_ROUNDS = 10;
export const TOTAL_PICKS = TOTAL_TEAMS * TOTAL_ROUNDS; // 120

// Draft window (Eastern Time)
export const DRAFT_OPEN = "2026-03-15T19:00:00-05:00";
export const DRAFT_CLOSE = "2026-03-19T04:59:00-05:00"; // 11:59 PM ET on 3/18

/**
 * Get which round a pick belongs to (1-based).
 */
export function getRoundForPick(pickNumber) {
  return Math.ceil(pickNumber / TOTAL_TEAMS);
}

/**
 * Get the team index (0-based) for a given pick number in a snake draft.
 * Round 1: 0,1,2,...,10
 * Round 2: 10,9,8,...,0
 * Round 3: 0,1,2,...,10
 * etc.
 */
export function getTeamIndexForPick(pickNumber) {
  const round = getRoundForPick(pickNumber);
  const posInRound = (pickNumber - 1) % TOTAL_TEAMS;
  const isReversed = round % 2 === 0;
  return isReversed ? TOTAL_TEAMS - 1 - posInRound : posInRound;
}

/**
 * Get the position within the current round (1-based).
 */
export function getPositionInRound(pickNumber) {
  return ((pickNumber - 1) % TOTAL_TEAMS) + 1;
}

/**
 * Generate the full draft order mapping: pickNumber -> teamIndex
 * for all 110 picks.
 */
export function generateFullDraftOrder() {
  const order = [];
  for (let pick = 1; pick <= TOTAL_PICKS; pick++) {
    order.push({
      pick,
      round: getRoundForPick(pick),
      teamIndex: getTeamIndexForPick(pick),
    });
  }
  return order;
}

/**
 * Fisher-Yates shuffle for randomizing draft order.
 */
export function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Check if draft is within its open window.
 */
export function isDraftWindowOpen(now = new Date()) {
  const open = new Date(DRAFT_OPEN);
  const close = new Date(DRAFT_CLOSE);
  return now >= open && now <= close;
}

/**
 * Check if draft deadline has passed.
 */
export function isDraftDeadlinePassed(now = new Date()) {
  return now > new Date(DRAFT_CLOSE);
}
