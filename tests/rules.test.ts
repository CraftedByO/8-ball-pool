import { describe, it, expect } from 'vitest';
import { EightBallRulesEngine } from '../rules/engine';
import { CollisionEvent } from '../physics/types';

describe('EightBallRulesEngine', () => {
  it('should foul when cue ball scratches', () => {
    const rules = new EightBallRulesEngine('player1');
    const events: CollisionEvent[] = [];
    const newlyPocketed = [0]; // Scratch
    const remainingOnTable = [1, 2, 3, 8, 9, 10];

    const result = rules.evaluateShot(events, newlyPocketed, remainingOnTable);
    expect(result.isLegal).toBe(false);
    expect(result.fouls.isScratch).toBe(true);
    expect(result.nextTurn).toBe('player2');
    expect(result.ballInHand).toBe(true);
  });

  it('should foul if shooter fails to hit any ball', () => {
    const rules = new EightBallRulesEngine('player1');
    const events: CollisionEvent[] = []; // No collisions
    const newlyPocketed: number[] = [];
    const remainingOnTable = [1, 2, 3, 8, 9, 10];

    const result = rules.evaluateShot(events, newlyPocketed, remainingOnTable);
    expect(result.isLegal).toBe(false);
    expect(result.ballInHand).toBe(true);
    expect(result.nextTurn).toBe('player2');
  });

  it('should assign groups on the first legally pocketed ball when table is open', () => {
    const rules = new EightBallRulesEngine('player1');
    // Simulate post-break shot
    rules.setState({
      ...rules.getState(),
      isBreakShot: false,
      tableOpen: true,
    });

    const events: CollisionEvent[] = [
      { type: 'ball_ball', ballA: 0, ballB: 3, impulse: 1.0, timestamp: 0.1 }, // Hit ball 3 (solid)
      { type: 'ball_cushion', ballA: 3, cushionId: 'rail_left', impulse: 0.5, timestamp: 0.2 },
    ];
    const newlyPocketed = [3]; // Solid pocketed
    const remainingOnTable = [1, 2, 4, 8, 9, 10];

    const result = rules.evaluateShot(events, newlyPocketed, remainingOnTable);
    expect(result.isLegal).toBe(true);
    expect(result.assignedGroup.player1).toBe('solids');
    expect(result.assignedGroup.player2).toBe('stripes');
    expect(result.nextTurn).toBe('player1'); // Shooter pockets own ball, retains turn
  });

  it('should declare a loss if 8-ball is pocketed prematurely', () => {
    const rules = new EightBallRulesEngine('player1');
    rules.setState({
      ...rules.getState(),
      isBreakShot: false,
      tableOpen: false,
      groups: { player1: 'solids', player2: 'stripes' },
    });

    const events: CollisionEvent[] = [
      { type: 'ball_ball', ballA: 0, ballB: 8, impulse: 1.0, timestamp: 0.1 },
    ];
    const newlyPocketed = [8];
    const remainingOnTable = [1, 2, 9, 10]; // player 1 still has solids 1 and 2!

    const result = rules.evaluateShot(events, newlyPocketed, remainingOnTable);
    expect(result.winner).toBe('player2'); // Premature 8-ball loss!
  });

  it('should declare a win when 8-ball is legally pocketed after clearing group', () => {
    const rules = new EightBallRulesEngine('player1');
    rules.setState({
      ...rules.getState(),
      isBreakShot: false,
      tableOpen: false,
      groups: { player1: 'solids', player2: 'stripes' },
    });

    const events: CollisionEvent[] = [
      { type: 'ball_ball', ballA: 0, ballB: 8, impulse: 1.0, timestamp: 0.1 },
    ];
    const newlyPocketed = [8];
    const remainingOnTable = [9, 10, 11]; // No solids left!

    const result = rules.evaluateShot(events, newlyPocketed, remainingOnTable);
    expect(result.winner).toBe('player1'); // Legal win!
  });

  it('should assign groups when breaker pockets only one category of balls', () => {
    const rules = new EightBallRulesEngine('player1'); // isBreakShot: true
    const events: CollisionEvent[] = [
      { type: 'ball_ball', ballA: 0, ballB: 1, impulse: 3.5, timestamp: 0.05 },
      { type: 'ball_cushion', ballA: 1, cushionId: 'rail_top', impulse: 1.0, timestamp: 0.1 },
    ];
    const newlyPocketed = [2]; // Only solid 2 pocketed
    const remainingOnTable = [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

    const result = rules.evaluateShot(events, newlyPocketed, remainingOnTable);
    expect(result.isLegal).toBe(true);
    expect(result.assignedGroup.player1).toBe('solids');
    expect(result.assignedGroup.player2).toBe('stripes');
    expect(rules.getState().tableOpen).toBe(false);
    expect(result.nextTurn).toBe('player1');
  });

  it('should leave table open if breaker pockets both solids and stripes on break', () => {
    const rules = new EightBallRulesEngine('player1');
    const events: CollisionEvent[] = [
      { type: 'ball_ball', ballA: 0, ballB: 1, impulse: 3.5, timestamp: 0.05 },
      { type: 'ball_cushion', ballA: 1, cushionId: 'rail_top', impulse: 1.0, timestamp: 0.1 },
    ];
    const newlyPocketed = [2, 10]; // Solid 2 and Stripe 10
    const remainingOnTable = [1, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15];

    const result = rules.evaluateShot(events, newlyPocketed, remainingOnTable);
    expect(result.isLegal).toBe(true);
    expect(result.assignedGroup.player1).toBe(null);
    expect(rules.getState().tableOpen).toBe(true);
    expect(result.nextTurn).toBe('player1');
  });
});
