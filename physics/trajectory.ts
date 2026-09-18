import { TABLE_CONSTANTS, CUSHION_SEGMENTS, POCKETS, Vector2D } from './constants';
import { BallPhysicsState } from './types';

export interface TrajectoryPoint {
  cueStart: Vector2D;
  cueHitPoint: Vector2D;
  cueReflectDir?: Vector2D;
  cushionReflectDir?: Vector2D;
  targetBallId?: number;
  targetBallStart?: Vector2D;
  targetBallDir?: Vector2D;
  targetBallEnd?: Vector2D;
  targetBallWillPocket?: boolean;
  targetPocketId?: string;
  cueWillPocket?: boolean;
  hitCushion?: boolean;
}

/**
 * Predicts the cue-ball trajectory ray, first collision, target ball deflection path,
 * and pocket targeting with high mathematical fidelity.
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
  let cueWillPocket = false;
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
        cueWillPocket = false;
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
        cueWillPocket = false;
        cushionNormal = { x: nx, z: nz };
      }
    }
  }

  // 3. Raycast cue ball against pockets to catch direct pocket scratches or aimed pots
  for (const pocket of POCKETS) {
    const pox = pocket.position.x - startX;
    const poz = pocket.position.z - startZ;
    const proj = pox * rayDirX + poz * rayDirZ;
    if (proj > 0) {
      const perpSq = (pox * pox + poz * poz) - (proj * proj);
      if (perpSq < pocket.captureRadius * pocket.captureRadius) {
        if (proj < closestDist) {
          closestDist = proj;
          targetBall = null;
          hitCushion = false;
          cueWillPocket = true;
        }
      }
    }
  }

  // Clamp ray length to table bounds (prevents 1000m line glitch when aiming at gaps)
  const maxTableDist = 2.6;
  if (closestDist > maxTableDist) {
    closestDist = maxTableDist;
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
    cueWillPocket,
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

      // --- Project Full Target Ball Trajectory Path ---
      const tbStartX = targetBall.position.x;
      const tbStartZ = targetBall.position.z;
      let tbClosest = maxTableDist;
      let targetBallWillPocket = false;
      let targetPocketId: string | undefined = undefined;

      // A. Check collision with pockets along targetBallDir
      for (const pocket of POCKETS) {
        const pox = pocket.position.x - tbStartX;
        const poz = pocket.position.z - tbStartZ;
        const proj = pox * dirX + poz * dirZ;
        if (proj > 0.01) {
          const perpSq = (pox * pox + poz * poz) - (proj * proj);
          if (perpSq < pocket.captureRadius * pocket.captureRadius) {
            if (proj < tbClosest) {
              tbClosest = proj;
              targetBallWillPocket = true;
              targetPocketId = pocket.id;
            }
          }
        }
      }

      // B. Check collision with other obstacle balls along targetBallDir
      for (const other of allBalls) {
        if (
          other.id === 0 ||
          other.id === targetBall.id ||
          other.state === 'pocketed' ||
          other.state === 'falling'
        ) {
          continue;
        }

        const ox = other.position.x - tbStartX;
        const oz = other.position.z - tbStartZ;
        const proj = ox * dirX + oz * dirZ;
        if (proj <= 0) continue;

        const perpDistSq = (ox * ox + oz * oz) - (proj * proj);
        const colThresh = 2 * R;
        if (perpDistSq < colThresh * colThresh) {
          const d = proj - Math.sqrt(colThresh * colThresh - perpDistSq);
          if (d > 0.01 && d < tbClosest) {
            tbClosest = d;
            targetBallWillPocket = false;
            targetPocketId = undefined;
          }
        }
      }

      // C. Check collision with cushions along targetBallDir
      for (const cushion of CUSHION_SEGMENTS) {
        const cnx = cushion.normal.x;
        const cnz = cushion.normal.z;
        const dirDotN = dirX * cnx + dirZ * cnz;
        if (dirDotN >= -0.0001) continue;

        const distP = (tbStartX - cushion.start.x) * cnx + (tbStartZ - cushion.start.z) * cnz;
        const s = (R - distP) / dirDotN;
        if (s > 0.01 && s < tbClosest) {
          const impactX = tbStartX + dirX * s;
          const impactZ = tbStartZ + dirZ * s;
          const segDx = cushion.end.x - cushion.start.x;
          const segDz = cushion.end.z - cushion.start.z;
          const segLenSq = segDx * segDx + segDz * segDz;
          const u = ((impactX - cushion.start.x) * segDx + (impactZ - cushion.start.z) * segDz) / segLenSq;
          if (u >= -0.05 && u <= 1.05) {
            tbClosest = s;
            targetBallWillPocket = false;
            targetPocketId = undefined;
          }
        }
      }

      result.targetBallEnd = {
        x: tbStartX + dirX * tbClosest,
        z: tbStartZ + dirZ * tbClosest,
      };
      result.targetBallWillPocket = targetBallWillPocket;
      result.targetPocketId = targetPocketId;
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
