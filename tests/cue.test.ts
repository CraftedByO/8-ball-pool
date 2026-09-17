import { describe, it, expect } from 'vitest';
import { calculateCueElevation } from '../game/scene';
import { TABLE_CONSTANTS } from '../physics/constants';

describe('Cue Stick Elevation and Table Clearance', () => {
  const L2 = TABLE_CONSTANTS.TABLE_LENGTH / 2; // 1.27m
  const W2 = TABLE_CONSTANTS.TABLE_WIDTH / 2;  // 0.635m
  const R = TABLE_CONSTANTS.BALL_RADIUS;       // 0.028575m
  const railHeight = 0.048;                   // Rail top height

  function verifyNoTablePenetration(
    cueBall: { x: number; z: number },
    aimAngle: number,
    pullback: number = 0,
    obstacleBalls?: Array<{ x: number; z: number }>
  ) {
    const { pitch, yBase } = calculateCueElevation(cueBall, aimAngle, obstacleBalls);

    const cosA = Math.cos(aimAngle);
    const sinA = Math.sin(aimAngle);
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);

    const distanceOffset = R + 0.015 + pullback * 0.22;
    const tipX = cueBall.x - cosA * distanceOffset * cosP;
    const tipZ = cueBall.z - sinA * distanceOffset * cosP;
    const tipY = yBase + distanceOffset * sinP;

    // Check points along the cue stick from tip (s = 0) to butt (s = 1.455m)
    for (let s = 0; s <= 1.455; s += 0.05) {
      const px = tipX - cosA * s * cosP;
      const pz = tipZ - sinA * s * cosP;
      const py = tipY + s * sinP;

      // Approximate cue radius at distance s (0.006m at tip to 0.014m at butt)
      const cueRadius = 0.006 + (s / 1.455) * 0.008;
      const bottomY = py - cueRadius;

      const isOverCushionOrRail =
        Math.abs(px) > L2 || Math.abs(pz) > W2;

      if (isOverCushionOrRail) {
        // Must clear the wooden rail top (0.048m) with safety margin
        expect(bottomY).toBeGreaterThanOrEqual(railHeight);
      } else {
        // Must clear the table felt bed (0.0m)
        expect(bottomY).toBeGreaterThan(0.0);
      }
    }
  }

  it('maintains a natural low bridge angle on open table shots', () => {
    const cueBall = { x: 0, z: 0 };
    const aimAngle = 0;
    const { pitch } = calculateCueElevation(cueBall, aimAngle);
    // Open table should be close to ~3.8 deg (~0.066 rad)
    expect(pitch).toBeCloseTo(0.066, 2);
    verifyNoTablePenetration(cueBall, aimAngle, 0);
    verifyNoTablePenetration(cueBall, aimAngle, 1.0);
  });

  it('elevates dynamically when ball is near the bottom rail (user reported case)', () => {
    // Cue ball near bottom rail aiming forward (toward top of table)
    // Cue stick extends backwards toward the bottom rail
    const cueBall = { x: 0, z: 0.50 };
    const aimAngle = -Math.PI / 2; // aiming toward negative Z (upwards)
    const { pitch } = calculateCueElevation(cueBall, aimAngle);

    // Should elevate significantly (~12 to 15 degrees)
    expect(pitch).toBeGreaterThan(0.18); // > 10.3 degrees

    // Zero pullback
    verifyNoTablePenetration(cueBall, aimAngle, 0);
    // 50% pullback
    verifyNoTablePenetration(cueBall, aimAngle, 0.5);
    // 100% full power break pullback
    verifyNoTablePenetration(cueBall, aimAngle, 1.0);
  });

  it('elevates cleanly when cue ball is nearly frozen to cushion', () => {
    const cueBall = { x: 0, z: W2 - R - 0.005 }; // 5mm from cushion nose
    const aimAngle = -Math.PI / 2;
    const { pitch, yBase } = calculateCueElevation(cueBall, aimAngle);

    expect(pitch).toBeGreaterThanOrEqual(0.60); // Elevated stance
    expect(yBase).toBeGreaterThan(R);          // Elevated bridge height

    verifyNoTablePenetration(cueBall, aimAngle, 0);
    verifyNoTablePenetration(cueBall, aimAngle, 1.0);
  });

  it('elevates cleanly for side rail shots', () => {
    // Near left rail, shooting right
    const cueBall = { x: -L2 + 0.10, z: 0 };
    const aimAngle = 0; // shooting toward +X
    verifyNoTablePenetration(cueBall, aimAngle, 0);
    verifyNoTablePenetration(cueBall, aimAngle, 1.0);

    // Near right rail, shooting left
    const cueBallRight = { x: L2 - 0.10, z: 0 };
    const aimAngleLeft = Math.PI; // shooting toward -X
    verifyNoTablePenetration(cueBallRight, aimAngleLeft, 0);
    verifyNoTablePenetration(cueBallRight, aimAngleLeft, 1.0);
  });

  it('elevates over an obstacle ball directly behind the cue ball', () => {
    const cueBall = { x: 0, z: 0 };
    const aimAngle = 0; // shooting +X (cue stick extends along -X)
    const obstacleBalls = [{ x: -0.20, z: 0 }]; // ball 20cm behind along line of aim

    const { pitch } = calculateCueElevation(cueBall, aimAngle, obstacleBalls);
    expect(pitch).toBeGreaterThan(0.12); // Elevated to avoid obstacle ball

    verifyNoTablePenetration(cueBall, aimAngle, 0, obstacleBalls);
    verifyNoTablePenetration(cueBall, aimAngle, 1.0, obstacleBalls);
  });
});
