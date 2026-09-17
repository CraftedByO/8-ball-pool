import { TABLE_CONSTANTS } from './constants';
import { BallPhysicsState, BallType } from './types';

/**
 * Standard WPA 8-Ball Rack Setup:
 * Triangle rack placed at the foot spot (apex facing headstring).
 * 8-ball must be in center of the 3rd row.
 * Back corners must have one solid and one stripe.
 * Other balls are randomized or standard alternate.
 */
export function createStandard8BallRack(): BallPhysicsState[] {
  const R = TABLE_CONSTANTS.BALL_RADIUS;
  const D = TABLE_CONSTANTS.BALL_DIAMETER;
  const spacing = D * 1.002; // microscopic gap to prevent initial overlapping
  const sqrt3Over2 = Math.sqrt(3) / 2;

  // Foot spot is at +X quarter of the table: (TABLE_LENGTH / 4)
  const apexX = TABLE_CONSTANTS.TABLE_LENGTH * 0.25;
  const apexZ = 0;

  // Row layout for 15 balls:
  // Row 0: 1 ball (Apex)
  // Row 1: 2 balls
  // Row 2: 3 balls (center is 8-ball!)
  // Row 3: 4 balls
  // Row 4: 5 balls (corners must be different groups)

  // Standard official distribution pattern:
  // Row 0: [1] (solid)
  // Row 1: [9, 2] (stripe, solid)
  // Row 2: [10, 8, 3] (stripe, 8-ball, solid)
  // Row 3: [11, 4, 12, 5] (stripe, solid, stripe, solid)
  // Row 4: [6, 13, 7, 14, 15] (solid, stripe, solid, stripe, stripe - opposite corners are 6 solid & 15 stripe)
  const rackPattern: number[][] = [
    [1],
    [9, 2],
    [10, 8, 3],
    [11, 4, 12, 5],
    [6, 13, 7, 14, 15],
  ];

  const balls: BallPhysicsState[] = [];

  // 1. Cue Ball placed at head string (-X quarter)
  const cueX = -TABLE_CONSTANTS.TABLE_LENGTH * 0.25;
  balls.push({
    id: 0,
    type: 'cue',
    position: { x: cueX, z: 0 },
    height: 0,
    velocity: { x: 0, z: 0 },
    verticalVelocity: 0,
    angularVelocity: { x: 0, y: 0, z: 0 },
    state: 'active',
  });

  // 2. Rack object balls
  for (let rowIndex = 0; rowIndex < rackPattern.length; rowIndex++) {
    const rowBalls = rackPattern[rowIndex];
    const rowX = apexX + rowIndex * spacing * sqrt3Over2;
    const numInRow = rowBalls.length;
    const startZ = -((numInRow - 1) * spacing) / 2;

    for (let colIndex = 0; colIndex < numInRow; colIndex++) {
      const ballId = rowBalls[colIndex];
      const z = startZ + colIndex * spacing;

      let type: BallType = 'solid';
      if (ballId === 8) type = '8ball';
      else if (ballId >= 9) type = 'stripe';

      balls.push({
        id: ballId,
        type,
        position: { x: rowX, z },
        height: 0,
        velocity: { x: 0, z: 0 },
        verticalVelocity: 0,
        angularVelocity: { x: 0, y: 0, z: 0 },
        state: 'active',
      });
    }
  }

  return balls;
}
