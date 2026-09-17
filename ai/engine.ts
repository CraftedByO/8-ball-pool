import { TABLE_CONSTANTS, POCKETS, Vector2D } from '../physics/constants';
import { BallPhysicsState } from '../physics/types';
import { EightBallRulesEngine } from '../rules/engine';
import { PlayerId } from '../rules/types';
import { AIDifficulty, AIShotDecision } from './types';

export class BilliardsAIEngine {
  private difficulty: AIDifficulty;

  constructor(difficulty: AIDifficulty = 'medium') {
    this.difficulty = difficulty;
  }

  public setDifficulty(difficulty: AIDifficulty) {
    this.difficulty = difficulty;
  }

  /**
   * Evaluate best legal shot for AI player
   */
  public planShot(
    balls: BallPhysicsState[],
    rules: EightBallRulesEngine,
    aiPlayer: PlayerId
  ): AIShotDecision | null {
    const cueBall = balls.find(b => b.id === 0);
    if (!cueBall || cueBall.state === 'pocketed') return null;

    const remainingBalls = balls.filter(b => b.state !== 'pocketed' && b.state !== 'falling');
    const remainingIds = remainingBalls.map(b => b.id);
    const on8Ball = rules.isPlayerOnEightBall(aiPlayer, remainingIds);
    const rulesState = rules.getState();

    // 1. Identify legal candidate balls
    let legalCandidateBalls: BallPhysicsState[] = [];

    if (rulesState.isBreakShot) {
      // Break shot: Aim directly into apex of rack (ball 1) with maximum power
      const apex = balls.find(b => b.id === 1);
      const targetAngle = apex
        ? Math.atan2(apex.position.z - cueBall.position.z, apex.position.x - cueBall.position.x)
        : 0;

      return {
        targetBallId: 1,
        pocketId: 'pocket_side_t',
        shotParams: {
          power: 1.0, // full explosive break
          angle: targetAngle + (Math.random() - 0.5) * 0.02,
          spinX: 0,
          spinY: 0.3, // topspin follow
        },
        confidence: 0.9,
      };
    }

    if (on8Ball) {
      // Must target 8-ball
      const eightBall = balls.find(b => b.id === 8);
      if (eightBall && eightBall.state !== 'pocketed') {
        legalCandidateBalls = [eightBall];
      }
    } else if (rulesState.tableOpen) {
      // Any object ball except 8-ball
      legalCandidateBalls = remainingBalls.filter(b => b.id !== 0 && b.id !== 8);
    } else {
      const myGroup = rulesState.groups[aiPlayer];
      legalCandidateBalls = remainingBalls.filter(
        b => b.id !== 0 && b.id !== 8 && rules.getGroupForBall(b.id) === myGroup
      );
    }

    if (legalCandidateBalls.length === 0) {
      // Fallback: 8-ball or any ball
      const eightBall = balls.find(b => b.id === 8);
      if (eightBall) legalCandidateBalls = [eightBall];
      else return null;
    }

    // 2. Evaluate all candidate ball-to-pocket combinations
    const evaluatedShots: AIShotDecision[] = [];
    const R = TABLE_CONSTANTS.BALL_RADIUS;

    for (const ball of legalCandidateBalls) {
      for (const pocket of POCKETS) {
        // Line from pocket to ball center
        const pbx = ball.position.x - pocket.position.x;
        const pbz = ball.position.z - pocket.position.z;
        const pbDist = Math.hypot(pbx, pbz);
        if (pbDist < 0.001) continue;

        const pbDirX = pbx / pbDist;
        const pbDirZ = pbz / pbDist;

        // Ghost ball center position: Ball position + 2R along pocket-to-ball vector
        const ghostX = ball.position.x + pbDirX * (2 * R);
        const ghostZ = ball.position.z + pbDirZ * (2 * R);

        // Vector from cue ball to ghost ball
        const cgx = ghostX - cueBall.position.x;
        const cgz = ghostZ - cueBall.position.z;
        const cueGhostDist = Math.hypot(cgx, cgz);
        if (cueGhostDist < 0.001) continue;

        const cueDirX = cgx / cueGhostDist;
        const cueDirZ = cgz / cueGhostDist;

        // Cut angle: dot product between cue-to-ghost direction and ball-to-pocket direction
        // Dot product of (cueDir) and (-pbDir)
        const ballToPocketX = -pbDirX;
        const ballToPocketZ = -pbDirZ;
        const cutDot = cueDirX * ballToPocketX + cueDirZ * ballToPocketZ;

        // If cut angle is greater than ~80 degrees (cutDot < 0.17), shot is impossible or extreme cut
        if (cutDot <= 0.15) continue;

        // Check for line-of-sight obstacles:
        // A) cue to ghost ball
        if (this.isPathBlocked(cueBall.position, { x: ghostX, z: ghostZ }, balls, [0, ball.id])) {
          continue;
        }

        // B) ball to pocket
        if (this.isPathBlocked(ball.position, pocket.position, balls, [0, ball.id])) {
          continue;
        }

        // Calculate score/confidence: based on cut angle, distance to pocket, and cue distance
        const distPenalty = (pbDist / 2.5) * 0.35 + (cueGhostDist / 2.5) * 0.25;
        const cutBonus = cutDot * 0.4;
        let confidence = Math.max(0.1, Math.min(0.99, cutBonus + 0.6 - distPenalty));

        // Calculate required power based on total travel distance
        const totalDist = pbDist + cueGhostDist;
        let power = Math.min(0.85, Math.max(0.18, totalDist / 3.4));

        // Calculate spin
        let spinX = 0;
        let spinY = 0;

        if (this.difficulty === 'hard' || this.difficulty === 'expert') {
          // Add follow or draw depending on distance
          if (cueGhostDist < 0.5) {
            spinY = -0.4; // Draw back to keep cue ball in play
          } else {
            spinY = 0.2; // Slight follow
          }
        }

        const aimAngle = Math.atan2(cgz, cgx);

        evaluatedShots.push({
          targetBallId: ball.id,
          pocketId: pocket.id,
          shotParams: {
            angle: aimAngle,
            power,
            spinX,
            spinY,
          },
          confidence,
        });
      }
    }

    // Sort by confidence descending
    evaluatedShots.sort((a, b) => b.confidence - a.confidence);

    let chosenShot: AIShotDecision | null = null;

    if (evaluatedShots.length > 0) {
      if (this.difficulty === 'expert') {
        // Expert picks top choice with nearly zero error
        chosenShot = evaluatedShots[0];
      } else if (this.difficulty === 'hard') {
        // Hard picks from top 2
        chosenShot = evaluatedShots[Math.min(evaluatedShots.length - 1, Math.random() < 0.85 ? 0 : 1)];
      } else if (this.difficulty === 'medium') {
        // Medium picks from top 3 with slight jitter
        const pickIdx = Math.floor(Math.random() * Math.min(3, evaluatedShots.length));
        chosenShot = evaluatedShots[pickIdx];
      } else {
        // Easy picks somewhat randomly from available pot opportunities
        const pickIdx = Math.floor(Math.random() * evaluatedShots.length);
        chosenShot = evaluatedShots[pickIdx];
      }
    } else {
      // Defensive or safety fallback: hit any legal ball gently
      const fallbackTarget = legalCandidateBalls[0];
      const angle = Math.atan2(
        fallbackTarget.position.z - cueBall.position.z,
        fallbackTarget.position.x - cueBall.position.x
      );
      chosenShot = {
        targetBallId: fallbackTarget.id,
        pocketId: 'safety',
        shotParams: {
          angle,
          power: 0.3,
          spinX: 0,
          spinY: 0,
        },
        confidence: 0.2,
        isSafetyShot: true,
      };
    }

    // Apply difficulty-based aiming error
    this.applyAimJitter(chosenShot);

    return chosenShot;
  }

  /**
   * Check if a linear ray between p1 and p2 is obstructed by any other ball
   */
  private isPathBlocked(
    p1: Vector2D,
    p2: Vector2D,
    balls: BallPhysicsState[],
    ignoredIds: number[]
  ): boolean {
    const R = TABLE_CONSTANTS.BALL_RADIUS;
    const thresholdSq = (2 * R) * (2 * R);

    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const lenSq = dx * dx + dz * dz;
    if (lenSq < 0.0001) return false;

    for (const b of balls) {
      if (ignoredIds.includes(b.id) || b.state === 'pocketed' || b.state === 'falling') continue;

      const bx = b.position.x - p1.x;
      const bz = b.position.z - p1.z;

      // Project b onto p1-p2
      const t = (bx * dx + bz * dz) / lenSq;
      if (t < 0.02 || t > 0.98) continue; // Not between p1 and p2

      const closestX = p1.x + t * dx;
      const closestZ = p1.z + t * dz;
      const distSq = (b.position.x - closestX) ** 2 + (b.position.z - closestZ) ** 2;

      if (distSq < thresholdSq) {
        return true; // Path is blocked!
      }
    }

    return false;
  }

  /**
   * Apply Gaussian error jitter to shot based on difficulty
   */
  private applyAimJitter(decision: AIShotDecision) {
    let maxErrorRadians = 0;
    let powerJitter = 0;

    switch (this.difficulty) {
      case 'easy':
        maxErrorRadians = 0.07; // ~4 degrees max error
        powerJitter = 0.15;
        break;
      case 'medium':
        maxErrorRadians = 0.03; // ~1.7 degrees max error
        powerJitter = 0.08;
        break;
      case 'hard':
        maxErrorRadians = 0.01; // ~0.5 degrees
        powerJitter = 0.03;
        break;
      case 'expert':
        maxErrorRadians = 0.002; // razor sharp pro accuracy
        powerJitter = 0.01;
        break;
    }

    const jitterAngle = (Math.random() - 0.5) * 2 * maxErrorRadians;
    const jitterPower = (Math.random() - 0.5) * 2 * powerJitter;

    decision.shotParams.angle += jitterAngle;
    decision.shotParams.power = Math.max(0.15, Math.min(1.0, decision.shotParams.power + jitterPower));
  }
}
