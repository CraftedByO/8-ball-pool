import { describe, it, expect } from 'vitest';
import { TABLE_CONSTANTS } from '../physics/constants';
import {
  createStandard8BallRack,
  isBallInHandPlacementValid,
  clampBallInHandPosition,
  findClearCueBallSpot,
} from '../physics/setup';
import { BilliardsAIEngine } from '../ai/engine';
import { EightBallRulesEngine } from '../rules/engine';

describe('Ball-in-Hand Placement Engine', () => {
  it('validates legal positions on the open table felt', () => {
    const balls = createStandard8BallRack();
    const valid = isBallInHandPlacementValid({ x: 0, z: 0 }, balls, false);
    expect(valid).toBe(true);
  });

  it('rejects coordinates outside cushion boundaries', () => {
    const balls = createStandard8BallRack();
    const outOfBoundsX = isBallInHandPlacementValid({ x: 2.0, z: 0 }, balls, false);
    const outOfBoundsZ = isBallInHandPlacementValid({ x: 0, z: 1.5 }, balls, false);
    expect(outOfBoundsX).toBe(false);
    expect(outOfBoundsZ).toBe(false);
  });

  it('enforces behind head string constraint during break shot', () => {
    const balls = createStandard8BallRack();
    const pastHeadString = isBallInHandPlacementValid({ x: 0, z: 0 }, balls, true);
    const behindHeadString = isBallInHandPlacementValid({ x: -0.8, z: 0 }, balls, true);
    expect(pastHeadString).toBe(false);
    expect(behindHeadString).toBe(true);
  });

  it('detects ball-to-ball overlap collisions', () => {
    const balls = createStandard8BallRack();
    const apexBall = balls.find(b => b.id === 1)!;
    const overlapping = isBallInHandPlacementValid(
      { x: apexBall.position.x, z: apexBall.position.z },
      balls,
      false
    );
    expect(overlapping).toBe(false);
  });

  it('clamps out of bounds coordinates into playable cloth area', () => {
    const clamped = clampBallInHandPosition({ x: 5.0, z: -5.0 }, false);
    const halfL = TABLE_CONSTANTS.TABLE_LENGTH / 2;
    const halfW = TABLE_CONSTANTS.TABLE_WIDTH / 2;
    expect(clamped.x).toBeLessThan(halfL);
    expect(clamped.x).toBeGreaterThan(-halfL);
    expect(clamped.z).toBeLessThan(halfW);
    expect(clamped.z).toBeGreaterThan(-halfW);
  });

  it('finds clear spot when preferred spot is occupied by a ball', () => {
    const balls = createStandard8BallRack();
    const apexBall = balls.find(b => b.id === 1)!;
    const clearSpot = findClearCueBallSpot(
      { x: apexBall.position.x, z: apexBall.position.z },
      balls,
      false
    );

    const valid = isBallInHandPlacementValid(clearSpot, balls, false);
    expect(valid).toBe(true);
  });

  it('allows AI to strategically place cue ball in hand', () => {
    const balls = createStandard8BallRack();
    const rules = new EightBallRulesEngine('player1');
    const ai = new BilliardsAIEngine('expert');

    const placement = ai.chooseBallInHandPlacement(balls, rules, 'player2');
    expect(isBallInHandPlacementValid(placement, balls, false)).toBe(true);
  });
});
