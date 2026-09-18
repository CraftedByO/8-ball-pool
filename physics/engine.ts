import { TABLE_CONSTANTS, POCKETS, CUSHION_SEGMENTS, Vector2D } from './constants';
import { BallPhysicsState, ShotParameters, CollisionEvent, SimulationSnapshot } from './types';

export class BilliardsPhysicsEngine {
  private balls: BallPhysicsState[] = [];
  private events: CollisionEvent[] = [];
  private simulationTime: number = 0;

  constructor(initialBalls?: BallPhysicsState[]) {
    if (initialBalls) {
      this.balls = initialBalls.map(b => ({
        ...b,
        position: { ...b.position },
        velocity: { ...b.velocity },
        angularVelocity: { ...b.angularVelocity },
      }));
    }
  }

  public setBalls(balls: BallPhysicsState[]) {
    this.balls = balls.map(b => ({
      ...b,
      position: { ...b.position },
      velocity: { ...b.velocity },
      angularVelocity: { ...b.angularVelocity },
    }));
  }

  public getBalls(): BallPhysicsState[] {
    return this.balls;
  }

  public getCueBall(): BallPhysicsState | undefined {
    return this.balls.find(b => b.id === 0);
  }

  public isMoving(): boolean {
    const vEps = TABLE_CONSTANTS.VELOCITY_EPSILON;

    for (const ball of this.balls) {
      if (ball.state === 'pocketed') continue;
      if (ball.state === 'falling') return true;

      const speedSq = ball.velocity.x * ball.velocity.x + ball.velocity.z * ball.velocity.z;
      if (speedSq > vEps * vEps) return true;

      // In-place vertical spin check (spinning like a top)
      if (Math.abs(ball.angularVelocity.y) > 0.5) return true;
    }
    return false;
  }

  /**
   * Strike the cue ball with realistic physics
   * power: 0.0 - 1.0 (maps to 0 - 6.5 m/s break speed)
   * angle: radians on X-Z plane
   * spinX: -1 to 1 (left/right english)
   * spinY: -1 to 1 (topspin/backspin)
   */
  public strikeCueBall(params: ShotParameters): boolean {
    const cueBall = this.getCueBall();
    if (!cueBall || cueBall.state === 'pocketed' || cueBall.state === 'falling') {
      return false;
    }

    const maxSpeed = 14.5; // m/s (pro tournament break speed ~32.4 mph)
    const speed = Math.max(0.2, Math.pow(params.power, 1.25) * maxSpeed);
    const R = TABLE_CONSTANTS.BALL_RADIUS;

    // Contact offset on ball surface (-R to R)
    const maxOffset = 0.75 * R; // safe chalked tip limit
    const a = params.spinX * maxOffset; // horizontal offset (left/right)
    const b = params.spinY * maxOffset; // vertical offset (top/bottom)

    // Primary strike direction
    const cosA = Math.cos(params.angle);
    const sinA = Math.sin(params.angle);

    cueBall.velocity.x = speed * cosA;
    cueBall.velocity.z = speed * sinA;

    // Torque induced by offset hit:
    // Follow (b > 0) creates forward rotation around axis perpendicular to line of shot
    // Draw (b < 0) creates backspin
    // English (a != 0) creates sidespin around vertical Y axis
    const impulse = TABLE_CONSTANTS.BALL_MASS * speed;
    const I = TABLE_CONSTANTS.MOMENT_OF_INERTIA;

    // Angular velocity from strike
    // Shot direction is (cosA, 0, sinA).
    // Forward rolling axis is (sinA, 0, -cosA).
    // Follow (b > 0) creates forward roll; draw (b < 0) creates backspin.
    const rollRate = (b * impulse) / I;
    cueBall.angularVelocity.x = sinA * rollRate;
    cueBall.angularVelocity.z = -cosA * rollRate;
    cueBall.angularVelocity.y = -(a * impulse) / I; // English spin (vertical axis)

    cueBall.state = 'sliding';
    this.events = [];
    return true;
  }

  /**
   * Advance simulation by fixed dt using 8x sub-stepping and Continuous Collision Detection (CCD)
   */
  public step(dt: number = TABLE_CONSTANTS.FIXED_TIMESTEP): SimulationSnapshot {
    const SUBSTEPS = 8;
    const subDt = dt / SUBSTEPS;
    this.events = [];

    for (let sub = 0; sub < SUBSTEPS; sub++) {
      this.simulationTime += subDt;

      // Track previous positions for continuous swept collision detection
      const prevPositions = new Map<number, { x: number; z: number }>();
      for (const ball of this.balls) {
        if (ball.state === 'pocketed') continue;
        prevPositions.set(ball.id, { x: ball.position.x, z: ball.position.z });

        if (ball.state === 'falling') {
          this.updateFallingBall(ball, subDt);
          continue;
        }

        const prevX = ball.position.x;
        const prevZ = ball.position.z;

        this.updateBallDynamics(ball, subDt);
        this.checkPocketProximity(ball, prevX, prevZ);
      }

      // Resolve Ball - Cushion collisions
      this.resolveCushionCollisions();

      // Resolve Ball - Ball collisions with swept sphere TOI
      this.resolveBallCollisions(prevPositions, subDt);

      // Enforce boundary fail-safe
      for (const ball of this.balls) {
        this.enforceTableBoundaries(ball);
      }
    }

    return {
      balls: this.balls,
      isMoving: this.isMoving(),
      events: [...this.events],
    };
  }

  private updateBallDynamics(ball: BallPhysicsState, dt: number) {
    const R = TABLE_CONSTANTS.BALL_RADIUS;
    const g = TABLE_CONSTANTS.GRAVITY;
    const mu_s = TABLE_CONSTANTS.SLIDING_FRICTION_COEFF;
    const mu_r = TABLE_CONSTANTS.ROLLING_RESISTANCE_COEFF;

    // Surface relative velocity at point of contact:
    // v_contact = v + omega x (0, -R, 0) = (vx + R * wz, 0, vz - R * wx)
    const vRelX = ball.velocity.x + R * ball.angularVelocity.z;
    const vRelZ = ball.velocity.z - R * ball.angularVelocity.x;
    const vRelSpeed = Math.hypot(vRelX, vRelZ);

    // Maximum delta vRel that sliding friction can apply in dt without overshooting:
    const maxDeltaVRel = 3.5 * mu_s * g * dt;

    if (vRelSpeed > maxDeltaVRel) {
      // Ball is SLIDING: cloth friction acts opposite to relative contact velocity
      ball.state = 'sliding';
      const uRelX = vRelX / vRelSpeed;
      const uRelZ = vRelZ / vRelSpeed;

      const aLinear = mu_s * g;
      const alphaTorque = (2.5 * aLinear) / R;

      ball.velocity.x -= uRelX * aLinear * dt;
      ball.velocity.z -= uRelZ * aLinear * dt;

      // Friction torque at contact point opposes slip
      ball.angularVelocity.z -= uRelX * alphaTorque * dt;
      ball.angularVelocity.x += uRelZ * alphaTorque * dt;
    } else if (vRelSpeed > 0.0001) {
      // Relative velocity reaches zero within this timestep -> exact transition to pure rolling
      ball.velocity.x -= (2 / 7) * vRelX;
      ball.velocity.z -= (2 / 7) * vRelZ;
      ball.angularVelocity.x = ball.velocity.z / R;
      ball.angularVelocity.z = -ball.velocity.x / R;
      ball.state = 'rolling';
    }

    // Rolling resistance deceleration
    const speed = Math.hypot(ball.velocity.x, ball.velocity.z);
    if (speed > TABLE_CONSTANTS.VELOCITY_EPSILON) {
      const uX = ball.velocity.x / speed;
      const uZ = ball.velocity.z / speed;
      const aRoll = mu_r * g;

      const newSpeed = Math.max(0, speed - aRoll * dt);
      if (newSpeed <= TABLE_CONSTANTS.VELOCITY_EPSILON) {
        ball.velocity.x = 0;
        ball.velocity.z = 0;
        ball.angularVelocity.x = 0;
        ball.angularVelocity.z = 0;
        ball.state = 'active';
      } else {
        ball.velocity.x = uX * newSpeed;
        ball.velocity.z = uZ * newSpeed;

        // In rolling state, synchronize rotation with rolling
        ball.angularVelocity.x = ball.velocity.z / R;
        ball.angularVelocity.z = -ball.velocity.x / R;
        ball.state = 'rolling';
      }
    } else {
      // Ball comes to a crisp, definitive stop
      ball.velocity.x = 0;
      ball.velocity.z = 0;
      ball.angularVelocity.x = 0;
      ball.angularVelocity.z = 0;
      ball.state = 'active';
    }

    // Damp vertical spin (english)
    if (Math.abs(ball.angularVelocity.y) > TABLE_CONSTANTS.ANGULAR_EPSILON) {
      const spinDecel = TABLE_CONSTANTS.SPIN_DECELERATION_COEFF * dt;
      if (Math.abs(ball.angularVelocity.y) <= spinDecel) {
        ball.angularVelocity.y = 0;
      } else {
        ball.angularVelocity.y -= Math.sign(ball.angularVelocity.y) * spinDecel;
      }
    } else {
      ball.angularVelocity.y = 0;
    }

    // Integrate position
    ball.position.x += ball.velocity.x * dt;
    ball.position.z += ball.velocity.z * dt;
  }

  private updateFallingBall(ball: BallPhysicsState, dt: number) {
    ball.verticalVelocity -= TABLE_CONSTANTS.GRAVITY * 1.5 * dt;
    ball.height += ball.verticalVelocity * dt;

    // Continue drawing ball directly towards pocket center while falling
    const pocket = POCKETS.find(p => p.id === ball.pocketedIn);
    if (pocket) {
      const dx = pocket.position.x - ball.position.x;
      const dz = pocket.position.z - ball.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.002) {
        ball.position.x += (dx / d) * 0.8 * dt;
        ball.position.z += (dz / d) * 0.8 * dt;
      }
    } else {
      ball.position.x += ball.velocity.x * dt * 0.2;
      ball.position.z += ball.velocity.z * dt * 0.2;
    }

    // Fully pocketed threshold
    if (ball.height < -TABLE_CONSTANTS.POCKET_DEPTH) {
      ball.state = 'pocketed';
      ball.velocity = { x: 0, z: 0 };
      ball.verticalVelocity = 0;
      ball.angularVelocity = { x: 0, y: 0, z: 0 };
    }
  }

  private checkPocketProximity(ball: BallPhysicsState, prevX: number, prevZ: number) {
    if (ball.state === 'pocketed' || ball.state === 'falling') return;

    for (const pocket of POCKETS) {
      // 1. Current position distance
      const dx = ball.position.x - pocket.position.x;
      const dz = ball.position.z - pocket.position.z;
      const distCurrent = Math.hypot(dx, dz);

      // 2. Continuous swept trajectory distance across the frame
      const segX = ball.position.x - prevX;
      const segZ = ball.position.z - prevZ;
      const segLenSq = segX * segX + segZ * segZ;
      let t = 0;
      if (segLenSq > 0.000001) {
        t = ((pocket.position.x - prevX) * segX + (pocket.position.z - prevZ) * segZ) / segLenSq;
        t = Math.max(0, Math.min(1, t));
      }
      const closestX = prevX + t * segX;
      const closestZ = prevZ + t * segZ;
      const distSegment = Math.hypot(closestX - pocket.position.x, closestZ - pocket.position.z);

      const captureRadius = pocket.captureRadius;

      if (distCurrent < captureRadius || distSegment < captureRadius) {
        ball.state = 'falling';
        ball.pocketedIn = pocket.id;
        ball.verticalVelocity = -1.2;

        // Pull velocity toward pocket center
        const pDist = Math.hypot(pocket.position.x - ball.position.x, pocket.position.z - ball.position.z);
        if (pDist > 0.001) {
          const attractSpeed = 0.8;
          ball.velocity.x = ((pocket.position.x - ball.position.x) / pDist) * attractSpeed;
          ball.velocity.z = ((pocket.position.z - ball.position.z) / pDist) * attractSpeed;
        }

        this.events.push({
          type: 'ball_pocket',
          ballA: ball.id,
          pocketId: pocket.id,
          impulse: Math.hypot(ball.velocity.x, ball.velocity.z),
          timestamp: this.simulationTime,
        });
        break;
      }
    }
  }

  /**
   * Absolute fail-safe containment:
   * Keeps balls securely inside the table and pockets any ball that passes past the cushions.
   */
  private enforceTableBoundaries(ball: BallPhysicsState) {
    if (ball.state === 'pocketed' || ball.state === 'falling') return;

    const R = TABLE_CONSTANTS.BALL_RADIUS;
    const minX = TABLE_CONSTANTS.PLAYFIELD_MIN_X;
    const maxX = TABLE_CONSTANTS.PLAYFIELD_MAX_X;
    const minZ = TABLE_CONSTANTS.PLAYFIELD_MIN_Z;
    const maxZ = TABLE_CONSTANTS.PLAYFIELD_MAX_Z;

    const threshold = 0.005;
    const isOut =
      ball.position.x < minX + R - threshold ||
      ball.position.x > maxX - R + threshold ||
      ball.position.z < minZ + R - threshold ||
      ball.position.z > maxZ - R + threshold;

    if (!isOut) return;

    // Find closest pocket
    let nearestPocket: typeof POCKETS[0] | null = null;
    let nearestDist = 999;
    for (const pocket of POCKETS) {
      const d = Math.hypot(ball.position.x - pocket.position.x, ball.position.z - pocket.position.z);
      if (d < nearestDist) {
        nearestDist = d;
        nearestPocket = pocket;
      }
    }

    // If near any pocket opening mouth, immediately pocket the ball!
    if (nearestPocket && nearestDist < nearestPocket.captureRadius * 1.35) {
      ball.state = 'falling';
      ball.pocketedIn = nearestPocket.id;
      ball.verticalVelocity = -1.2;
      const dx = nearestPocket.position.x - ball.position.x;
      const dz = nearestPocket.position.z - ball.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.001) {
        ball.velocity.x = (dx / d) * 0.8;
        ball.velocity.z = (dz / d) * 0.8;
      }
      this.events.push({
        type: 'ball_pocket',
        ballA: ball.id,
        pocketId: nearestPocket.id,
        impulse: Math.hypot(ball.velocity.x, ball.velocity.z),
        timestamp: this.simulationTime,
      });
      return;
    }

    // Fail-safe bounce back inside playfield
    if (ball.position.x < minX + R) {
      ball.position.x = minX + R;
      ball.velocity.x = Math.abs(ball.velocity.x) * TABLE_CONSTANTS.CUSHION_RESTITUTION;
    } else if (ball.position.x > maxX - R) {
      ball.position.x = maxX - R;
      ball.velocity.x = -Math.abs(ball.velocity.x) * TABLE_CONSTANTS.CUSHION_RESTITUTION;
    }

    if (ball.position.z < minZ + R) {
      ball.position.z = minZ + R;
      ball.velocity.z = Math.abs(ball.velocity.z) * TABLE_CONSTANTS.CUSHION_RESTITUTION;
    } else if (ball.position.z > maxZ - R) {
      ball.position.z = maxZ - R;
      ball.velocity.z = -Math.abs(ball.velocity.z) * TABLE_CONSTANTS.CUSHION_RESTITUTION;
    }
  }

  private resolveCushionCollisions() {
    const R = TABLE_CONSTANTS.BALL_RADIUS;
    const restitution = TABLE_CONSTANTS.CUSHION_RESTITUTION;

    for (const ball of this.balls) {
      if (ball.state === 'pocketed' || ball.state === 'falling') continue;

      for (const segment of CUSHION_SEGMENTS) {
        // Line segment from start to end
        const segX = segment.end.x - segment.start.x;
        const segZ = segment.end.z - segment.start.z;
        const segLenSq = segX * segX + segZ * segZ;

        // Vector from segment start to ball
        const bX = ball.position.x - segment.start.x;
        const bZ = ball.position.z - segment.start.z;

        // Projection factor t
        let t = (bX * segX + bZ * segZ) / segLenSq;
        t = Math.max(0, Math.min(1, t));

        // Closest point on segment
        const closestX = segment.start.x + t * segX;
        const closestZ = segment.start.z + t * segZ;

        const distX = ball.position.x - closestX;
        const distZ = ball.position.z - closestZ;
        const dist = Math.hypot(distX, distZ);

        if (dist < R && dist > 0.0001) {
          // Normal vector pointing from cushion to ball
          const nx = distX / dist;
          const nz = distZ / dist;

          // Ensure normal matches segment inward normal
          const dotNorm = nx * segment.normal.x + nz * segment.normal.z;
          if (dotNorm < -0.2) continue; // ignore reverse collision

          // Penetration depth
          const penetration = R - dist;
          ball.position.x += nx * penetration;
          ball.position.z += nz * penetration;

          // Normal relative velocity
          const vDotN = ball.velocity.x * nx + ball.velocity.z * nz;
          if (vDotN < 0) {
            // Reflect velocity with restitution
            const impulse = -(1 + restitution) * vDotN;
            ball.velocity.x += impulse * nx;
            ball.velocity.z += impulse * nz;

            // Sidespin transfer to tangential velocity
            // Tangent vector: (-nz, nx)
            const tangentSpeed = -ball.velocity.x * nz + ball.velocity.z * nx;
            const spinEffect = ball.angularVelocity.y * R * TABLE_CONSTANTS.CUSHION_FRICTION;
            ball.velocity.x += -nz * spinEffect;
            ball.velocity.z += nx * spinEffect;
            ball.angularVelocity.y *= 0.6; // cushion damps sidespin

            this.events.push({
              type: 'ball_cushion',
              ballA: ball.id,
              cushionId: segment.id,
              impulse: Math.abs(vDotN),
              timestamp: this.simulationTime,
            });
          }
        }
      }
    }
  }

  private resolveBallCollisions(
    prevPositions: Map<number, { x: number; z: number }>,
    subDt: number
  ) {
    const R = TABLE_CONSTANTS.BALL_RADIUS;
    const minDistance = 2 * R;
    const minDistanceSq = minDistance * minDistance;
    const restitution = TABLE_CONSTANTS.BALL_RESTITUTION;

    const n = this.balls.length;
    // Multi-pass collision solver allows impulse to propagate cleanly through tight 15-ball clusters
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < n; i++) {
        const b1 = this.balls[i];
        if (b1.state === 'pocketed' || b1.state === 'falling') continue;

        for (let j = i + 1; j < n; j++) {
          const b2 = this.balls[j];
          if (b2.state === 'pocketed' || b2.state === 'falling') continue;

          const p1Prev = prevPositions.get(b1.id) || b1.position;
          const p2Prev = prevPositions.get(b2.id) || b2.position;

          // Relative position and velocity across subDt
          const p0x = p1Prev.x - p2Prev.x;
          const p0z = p1Prev.z - p2Prev.z;
          const dvx = b1.velocity.x - b2.velocity.x;
          const dvz = b1.velocity.z - b2.velocity.z;
          const vSq = dvx * dvx + dvz * dvz;

          // Current distance squared
          const curDx = b2.position.x - b1.position.x;
          const curDz = b2.position.z - b1.position.z;
          const curDistSq = curDx * curDx + curDz * curDz;

          let collided = false;
          let nx = 0;
          let nz = 0;
          let toi = 0;
          let hit1X = b1.position.x;
          let hit1Z = b1.position.z;
          let hit2X = b2.position.x;
          let hit2Z = b2.position.z;

          // 1. Check Continuous Swept Sphere collision if balls were moving relative to each other
          if (pass === 0 && vSq > 0.0001) {
            const A = vSq;
            const B = 2 * (p0x * dvx + p0z * dvz);
            const C = (p0x * p0x + p0z * p0z) - minDistanceSq;

            // If balls were not already deeply overlapping at start of subDt
            if (C >= -0.000001) {
              const disc = B * B - 4 * A * C;
              if (disc >= 0) {
                const t = (-B - Math.sqrt(disc)) / (2 * A);
                if (t >= -0.00001 && t <= subDt) {
                  collided = true;
                  toi = Math.max(0, Math.min(subDt, t));

                  // Exact contact coordinates at time of impact
                  hit1X = p1Prev.x + b1.velocity.x * toi;
                  hit1Z = p1Prev.z + b1.velocity.z * toi;
                  hit2X = p2Prev.x + b2.velocity.x * toi;
                  hit2Z = p2Prev.z + b2.velocity.z * toi;

                  // Exact normal vector pointing from b1 to b2 at impact instant
                  const hx = hit2X - hit1X;
                  const hz = hit2Z - hit1Z;
                  const hDist = Math.hypot(hx, hz);
                  if (hDist > 0.0001) {
                    nx = hx / hDist;
                    nz = hz / hDist;
                  }
                }
              }
            }
          }

          // 2. Discrete fallback for resting/overlapping spheres or subsequent solver passes
          if (!collided && curDistSq < minDistanceSq && curDistSq > 0.000001) {
            collided = true;
            toi = 0;
            const curDist = Math.sqrt(curDistSq);
            nx = curDx / curDist;
            nz = curDz / curDist;

            // Separate overlapping spheres equally
            const overlap = 0.5 * (minDistance - curDist);
            b1.position.x -= nx * overlap;
            b1.position.z -= nz * overlap;
            b2.position.x += nx * overlap;
            b2.position.z += nz * overlap;
          }

          if (collided && (nx !== 0 || nz !== 0)) {
            // Relative velocity along collision normal (b2 rel to b1)
            const relVn = (b2.velocity.x - b1.velocity.x) * nx + (b2.velocity.z - b1.velocity.z) * nz;

            // Moving towards each other
            if (relVn < 0) {
              const impulseMagnitude = -(1 + restitution) * relVn * 0.5;

              b1.velocity.x -= impulseMagnitude * nx;
              b1.velocity.z -= impulseMagnitude * nz;
              b2.velocity.x += impulseMagnitude * nx;
              b2.velocity.z += impulseMagnitude * nz;

              // Partial spin transfer along contact plane
              const avgSpinY = (b1.angularVelocity.y + b2.angularVelocity.y) * 0.5;
              b1.angularVelocity.y = avgSpinY;
              b2.angularVelocity.y = -avgSpinY * 0.3;

              // For swept collisions, integrate remaining time from contact position
              if (toi > 0) {
                const remT = subDt - toi;
                b1.position.x = hit1X + b1.velocity.x * remT;
                b1.position.z = hit1Z + b1.velocity.z * remT;
                b2.position.x = hit2X + b2.velocity.x * remT;
                b2.position.z = hit2Z + b2.velocity.z * remT;

                prevPositions.set(b1.id, { x: hit1X, z: hit1Z });
                prevPositions.set(b2.id, { x: hit2X, z: hit2Z });
              }

              if (pass === 0) {
                this.events.push({
                  type: 'ball_ball',
                  ballA: b1.id,
                  ballB: b2.id,
                  impulse: Math.abs(relVn),
                  timestamp: this.simulationTime,
                });
              }
            }
          }
        }
      }
    }
  }

  /**
   * Fast-forward simulation until all balls stop moving or max steps reached
   */
  public simulateUntilRest(maxSteps: number = 3000): SimulationSnapshot {
    let steps = 0;
    const accumulatedEvents: CollisionEvent[] = [];

    while (this.isMoving() && steps < maxSteps) {
      const snap = this.step(TABLE_CONSTANTS.FIXED_TIMESTEP);
      if (snap.events.length > 0) {
        accumulatedEvents.push(...snap.events);
      }
      steps++;
    }

    return {
      balls: this.balls,
      isMoving: this.isMoving(),
      events: accumulatedEvents,
    };
  }
}
