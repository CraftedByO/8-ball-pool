/**
 * Elo Rating System Calculation
 */
export function calculateEloDelta(
  playerRating: number,
  opponentRating: number,
  actualScore: number, // 1 for win, 0 for loss, 0.5 for draw
  kFactor: number = 32
): number {
  // Expected score formula: E = 1 / (1 + 10^((R_opponent - R_player) / 400))
  const exponent = (opponentRating - playerRating) / 400;
  const expectedScore = 1 / (1 + Math.pow(10, exponent));

  // Delta: K * (Actual - Expected)
  const delta = Math.round(kFactor * (actualScore - expectedScore));
  return delta;
}

export function getRankTier(rating: number): 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Master' {
  if (rating >= 2000) return 'Master';
  if (rating >= 1800) return 'Diamond';
  if (rating >= 1600) return 'Platinum';
  if (rating >= 1400) return 'Gold';
  if (rating >= 1200) return 'Silver';
  return 'Bronze';
}
