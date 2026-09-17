import { TABLE_CONSTANTS, CUSHION_SEGMENTS, Vector2D } from './constants';
import { BallPhysicsState } from './types';

export interface TrajectoryPoint {
  cueStart: Vector2D;
  cueHitPoint: Vector2D;
  cueReflectDir?: Vector2D;
  cushionReflectDir?: Vector2D;
  targetBallId?: number;
  targetBallStart?: Vector2D;
  targetBallDir?: Vector2D;
  hitCushion?: boolean;
}

/**
 * Predicts the initial cue-ball trajectory ray and first collision (ball or cushion)
 */
export function calculateAimTrajectory(
  cueBall: BallPhysicsState,
  aimAngle: number,
  allBalls: BallPhysicsState[]
): TrajectoryPoint {
  const R = TABLE_CONSTANTS.BALL_RADIUS;
  const rayDirX = Math.cos(aimAngle);
  const rayDirZ = Math.sin(aimAngle);

  const startX = cueBall.position.x;
  const startZ = cueBall.position.z;

  let closestDist = 999.0;
  let targetBall: BallPhysicsState | null = null;
  let hitCushion = false;
  let cushionNormal: Vector2D | null = null;

  // 1. Raycast against all object balls
  for (const b of allBalls) {
    if (b.id === 0 || b.state === 'pocketed' || b.state === 'falling') continue;

    // Vector from cue to object ball
    const ox = b.position.x - startX;
    const oz = b.position.z - startZ;

    // Project onto ray
    const proj = ox * rayDirX + oz * rayDirZ;
    if (proj <= 0) continue; // Behind cue ball

    // Distance squared from ball center to ray line
    const perpDistSq = (ox * ox + oz * oz) - (proj * proj);
    const collisionDistThreshold = 2 * R;

    if (perpDistSq < collisionDistThreshold * collisionDistThreshold) {
      // Ray intersects expanded collision circle (radius 2R)
      const d = proj - Math.sqrt(collisionDistThreshold * collisionDistThreshold - perpDistSq);
      if (d > 0 && d < closestDist) {
        closestDist = d;
        targetBall = b;
        hitCushion = false;
      }
    }
  }

  // 2. Exact Raycast against cushions
  for (const cushion of CUSHION_SEGMENTS) {
    const ax = cushion.start.x;
    const az = cushion.start.z;
    const bx = cushion.end.x;
    const bz = cushion.end.z;
    const nx = cushion.normal.x;
    const nz = cushion.normal.z;

    // Check if moving towards cushion plane
    const dirDotNorm = rayDirX * nx + rayDirZ * nz;
    if (dirDotNorm >= -0.0001) continue; // Moving parallel or away

    // Distance from cue center to cushion plane along normal
    const distToPlane = (startX - ax) * nx + (startZ - az) * nz;
    // Cue ball touches when center is at distance R from plane
    const s = (R - distToPlane) / dirDotNorm;

    if (s > 0 && s < closestDist) {
      // Impact center point
      const impactCenterX = startX + rayDirX * s;
      const impactCenterZ = startZ + rayDirZ * s;

      // Check if impact point lies along the segment [A, B]
      const segDx = bx - ax;
      const segDz = bz - az;
      const segLenSq = segDx * segDx + segDz * segDz;
      const u = ((impactCenterX - ax) * segDx + (impactCenterZ - az) * segDz) / segLenSq;

      // Allow slight extension for corner blend
      if (u >= -0.05 && u <= 1.05) {
        closestDist = s;
        targetBall = null;
        hitCushion = true;
        cushionNormal = { x: nx, z: nz };
      }
    }
  }

  // Calculate contact center point
  const hitPoint: Vector2D = {
    x: startX + rayDirX * closestDist,
    z: startZ + rayDirZ * closestDist,
  };

  // Guideline emerges cleanly from outer perimeter of cue ball
  const visibleStart: Vector2D = {
    x: startX + rayDirX * R,
    z: startZ + rayDirZ * R,
  };

  const result: TrajectoryPoint = {
    cueStart: visibleStart,
    cueHitPoint: hitPoint,
    hitCushion,
  };

  if (targetBall) {
    // Normal from cue contact center to target ball center
    const nx = targetBall.position.x - hitPoint.x;
    const nz = targetBall.position.z - hitPoint.z;
    const nDist = Math.hypot(nx, nz);

    if (nDist > 0.0001) {
      const dirX = nx / nDist;
      const dirZ = nz / nDist;

      // Target ball direction travels along line of centers
      result.targetBallId = targetBall.id;
      result.targetBallStart = { x: targetBall.position.x, z: targetBall.position.z };
      result.targetBallDir = { x: dirX, z: dirZ };

      // Cue ball reflects perpendicular to line of centers (natural 90-degree tangent)
      const dot = rayDirX * dirX + rayDirZ * dirZ;
      const cueReflectX = rayDirX - dirX * dot;
      const cueReflectZ = rayDirZ - dirZ * dot;
      const cueReflectLen = Math.hypot(cueReflectX, cueReflectZ);

      if (cueReflectLen > 0.001) {
        result.cueReflectDir = {
          x: cueReflectX / cueReflectLen,
          z: cueReflectZ / cueReflectLen,
        };
      }
    }
  } else if (hitCushion && cushionNormal) {
    // Reflect cue ball off cushion
    const dot = rayDirX * cushionNormal.x + rayDirZ * cushionNormal.z;
    result.cushionReflectDir = {
      x: rayDirX - 2 * dot * cushionNormal.x,
      z: rayDirZ - 2 * dot * cushionNormal.z,
    };
  }

  return result;
}
