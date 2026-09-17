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

/**
 * Validates whether a target coordinate is legal for Ball-in-Hand placement:
 * 1. Inside table cushion playing boundaries
 * 2. Behind head string if break scratch foul
 * 3. Does not collide or overlap with any active object balls
 */
export function isBallInHandPlacementValid(
  pos: { x: number; z: number },
  balls: BallPhysicsState[],
  isBreakShot: boolean = false
): boolean {
  const L = TABLE_CONSTANTS.TABLE_LENGTH;
  const W = TABLE_CONSTANTS.TABLE_WIDTH;
  const R = TABLE_CONSTANTS.BALL_RADIUS;

  const minX = -L / 2 + R + 0.004;
  const maxX = isBreakShot ? -L * 0.25 : L / 2 - R - 0.004;
  const minZ = -W / 2 + R + 0.004;
  const maxZ = W / 2 - R - 0.004;

  if (pos.x < minX || pos.x > maxX || pos.z < minZ || pos.z > maxZ) {
    return false;
  }

  // Minimum required center-to-center distance between cue ball and object balls
  const minBallDistance = R * 2 + 0.003;

  for (const b of balls) {
    if (b.id === 0 || b.state === 'pocketed' || b.state === 'falling') continue;
    const dist = Math.hypot(b.position.x - pos.x, b.position.z - pos.z);
    if (dist < minBallDistance) {
      return false;
    }
  }

  return true;
}

/**
 * Clamps coordinates strictly within legal table cloth boundaries
 */
export function clampBallInHandPosition(
  pos: { x: number; z: number },
  isBreakShot: boolean = false
): { x: number; z: number } {
  const L = TABLE_CONSTANTS.TABLE_LENGTH;
  const W = TABLE_CONSTANTS.TABLE_WIDTH;
  const R = TABLE_CONSTANTS.BALL_RADIUS;

  const minX = -L / 2 + R + 0.004;
  const maxX = isBreakShot ? -L * 0.25 : L / 2 - R - 0.004;
  const minZ = -W / 2 + R + 0.004;
  const maxZ = W / 2 - R - 0.004;

  return {
    x: Math.max(minX, Math.min(maxX, pos.x)),
    z: Math.max(minZ, Math.min(maxZ, pos.z)),
  };
}

/**
 * Finds an unobstructed legal spot near a preferred position
 */
export function findClearCueBallSpot(
  preferredPos: { x: number; z: number },
  balls: BallPhysicsState[],
  isBreakShot: boolean = false
): { x: number; z: number } {
  const clamped = clampBallInHandPosition(preferredPos, isBreakShot);
  if (isBallInHandPlacementValid(clamped, balls, isBreakShot)) {
    return clamped;
  }

  // Spiral search outward in increments of ball diameter
  const R = TABLE_CONSTANTS.BALL_RADIUS;
  for (let radius = 0.06; radius <= 0.8; radius += 0.06) {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      const candidate = clampBallInHandPosition(
        {
          x: clamped.x + Math.cos(angle) * radius,
          z: clamped.z + Math.sin(angle) * radius,
        },
        isBreakShot
      );
      if (isBallInHandPlacementValid(candidate, balls, isBreakShot)) {
        return candidate;
      }
    }
  }

  return clamped;
}
