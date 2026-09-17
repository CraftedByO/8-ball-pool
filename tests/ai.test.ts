import { describe, it, expect } from 'vitest';
import { BilliardsAIEngine } from '../ai/engine';
import { createStandard8BallRack } from '../physics/setup';
import { EightBallRulesEngine } from '../rules/engine';

describe('BilliardsAIEngine', () => {
  it('should plan a powerful break shot when table is fresh', () => {
    const ai = new BilliardsAIEngine('medium');
    const balls = createStandard8BallRack();
    const rules = new EightBallRulesEngine('player2');

    const decision = ai.planShot(balls, rules, 'player2');
    expect(decision).not.toBeNull();
    expect(decision?.targetBallId).toBe(1); // Apex ball
    expect(decision?.shotParams.power).toBeGreaterThan(0.85); // High break power
  });

  it('should only target 8-ball when player has cleared all group balls', () => {
    const ai = new BilliardsAIEngine('hard');
    const rules = new EightBallRulesEngine('player2');
    rules.setState({
      ...rules.getState(),
      isBreakShot: false,
      tableOpen: false,
      groups: { player1: 'solids', player2: 'stripes' },
    });

    // All stripes pocketed, only 8-ball and solids remain
    const balls = createStandard8BallRack().filter(b => {
      if (b.type === 'stripe') return false;
      return true;
    });

    const decision = ai.planShot(balls, rules, 'player2');
    expect(decision).not.toBeNull();
    expect(decision?.targetBallId).toBe(8); // Must target 8-ball
  });
});
