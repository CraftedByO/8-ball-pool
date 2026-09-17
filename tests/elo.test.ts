import { describe, it, expect } from 'vitest';
import { calculateEloDelta, getRankTier } from '../leaderboard/elo';

describe('Elo Rating Engine', () => {
  it('should calculate higher delta when lower rated player wins against higher rated player', () => {
    // Underdog (1200) beats Master (1800)
    const underdogWinDelta = calculateEloDelta(1200, 1800, 1);
    expect(underdogWinDelta).toBeGreaterThan(25);

    // Favorite (1800) beats Underdog (1200)
    const favoriteWinDelta = calculateEloDelta(1800, 1200, 1);
    expect(favoriteWinDelta).toBeLessThan(10);
  });

  it('should produce equal and opposite deltas in symmetrical match', () => {
    const delta1 = calculateEloDelta(1400, 1400, 1);
    const delta2 = calculateEloDelta(1400, 1400, 0);

    expect(delta1).toBe(16);
    expect(delta2).toBe(-16);
  });

  it('should assign correct rank tiers based on rating', () => {
    expect(getRankTier(1100)).toBe('Bronze');
    expect(getRankTier(1250)).toBe('Silver');
    expect(getRankTier(1450)).toBe('Gold');
    expect(getRankTier(1650)).toBe('Platinum');
    expect(getRankTier(1850)).toBe('Diamond');
    expect(getRankTier(2100)).toBe('Master');
  });
});
