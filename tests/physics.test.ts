import { describe, it, expect } from 'vitest';
import { BilliardsPhysicsEngine } from '../physics/engine';
import { TABLE_CONSTANTS, CUSHION_SEGMENTS } from '../physics/constants';
import { BallPhysicsState } from '../physics/types';
import { createStandard8BallRack } from '../physics/setup';

describe('BilliardsPhysicsEngine', () => {
  it('should decelerate rolling balls due to cloth friction', () => {
    const balls: BallPhysicsState[] = [
      {
        id: 0,
        type: 'cue',
        position: { x: 0, z: 0 },
        height: 0,
        velocity: { x: 2.0, z: 0 },
        verticalVelocity: 0,
        angularVelocity: { x: 0, y: 0, z: 2.0 / TABLE_CONSTANTS.BALL_RADIUS },
        state: 'rolling',
      },
    ];

    const engine = new BilliardsPhysicsEngine(balls);
    const snap1 = engine.step(0.1);
    expect(snap1.balls[0].velocity.x).toBeLessThan(2.0);
    expect(snap1.balls[0].velocity.x).toBeGreaterThan(0);

    // Fast-forward to rest
    engine.simulateUntilRest(1000);
    expect(engine.isMoving()).toBe(false);
    expect(engine.getCueBall()?.velocity.x).toBe(0);
  });

  it('should conserve momentum and transfer energy on direct head-on collision', () => {
    const R = TABLE_CONSTANTS.BALL_RADIUS;
    const balls: BallPhysicsState[] = [
      {
        id: 0,
        type: 'cue',
        position: { x: -0.2, z: 0 },
        height: 0,
        velocity: { x: 2.0, z: 0 },
        verticalVelocity: 0,
        angularVelocity: { x: 0, y: 0, z: 2.0 / R },
        state: 'rolling',
      },
      {
        id: 1,
        type: 'solid',
        position: { x: 0, z: 0 },
        height: 0,
        velocity: { x: 0, z: 0 },
        verticalVelocity: 0,
        angularVelocity: { x: 0, y: 0, z: 0 },
        state: 'active',
      },
    ];

    const engine = new BilliardsPhysicsEngine(balls);
    let collisionOccurred = false;

    for (let step = 0; step < 100; step++) {
      const snap = engine.step(TABLE_CONSTANTS.FIXED_TIMESTEP);
      if (snap.events.some(e => e.type === 'ball_ball')) {
        collisionOccurred = true;
        break;
      }
    }

    expect(collisionOccurred).toBe(true);
    // Object ball must have gained forward velocity
    const targetBall = engine.getBalls().find(b => b.id === 1);
    expect(targetBall?.velocity.x).toBeGreaterThan(1.0);
  });

  it('should bounce off cushions with restitution', () => {
    const balls: BallPhysicsState[] = [
      {
        id: 0,
        type: 'cue',
        position: { x: -0.5, z: TABLE_CONSTANTS.PLAYFIELD_MAX_Z - 0.05 },
        height: 0,
        velocity: { x: 0, z: 2.0 }, // moving towards bottom rail
        verticalVelocity: 0,
        angularVelocity: { x: 0, y: 0, z: 0 },
        state: 'rolling',
      },
    ];

    const engine = new BilliardsPhysicsEngine(balls);
    let cushionBounced = false;

    for (let step = 0; step < 60; step++) {
      const snap = engine.step(TABLE_CONSTANTS.FIXED_TIMESTEP);
      if (snap.events.some(e => e.type === 'ball_cushion')) {
        cushionBounced = true;
        break;
      }
    }

    expect(cushionBounced).toBe(true);
    // Ball velocity in Z must have reversed
    const cue = engine.getCueBall();
    expect(cue?.velocity.z).toBeLessThan(0);
  });

  it('should detect when ball drops into a pocket', () => {
    // Place ball right next to top-left corner pocket heading into it
    const balls: BallPhysicsState[] = [
      {
        id: 3,
        type: 'solid',
        position: { x: TABLE_CONSTANTS.PLAYFIELD_MIN_X + 0.02, z: TABLE_CONSTANTS.PLAYFIELD_MIN_Z + 0.02 },
        height: 0,
        velocity: { x: -0.5, z: -0.5 },
        verticalVelocity: 0,
        angularVelocity: { x: 0, y: 0, z: 0 },
        state: 'rolling',
      },
    ];

    const engine = new BilliardsPhysicsEngine(balls);
    let pocketed = false;

    for (let step = 0; step < 100; step++) {
      const snap = engine.step(TABLE_CONSTANTS.FIXED_TIMESTEP);
      if (snap.events.some(e => e.type === 'ball_pocket')) {
        pocketed = true;
        break;
      }
    }

    expect(pocketed).toBe(true);
    const ball3 = engine.getBalls().find(b => b.id === 3);
    expect(ball3?.state).toMatch(/falling|pocketed/);
  });

  it('should define all 6 table cushions with inward normals', () => {
    expect(CUSHION_SEGMENTS).toHaveLength(6);
    const ids = CUSHION_SEGMENTS.map(s => s.id);
    expect(ids).toContain('rail_top_left');
    expect(ids).toContain('rail_top_right');
    expect(ids).toContain('rail_bottom_left');
    expect(ids).toContain('rail_bottom_right');
    expect(ids).toContain('rail_left');
    expect(ids).toContain('rail_right');

    for (const seg of CUSHION_SEGMENTS) {
      const midX = (seg.start.x + seg.end.x) / 2;
      const midZ = (seg.start.z + seg.end.z) / 2;
      const dot = seg.normal.x * (-midX) + seg.normal.z * (-midZ);
      expect(dot).toBeGreaterThanOrEqual(0);
    }
  });

  it('should capture high-speed ball into corner pocket without tunneling outside', () => {
    // Fast break speed ball moving directly towards corner pocket
    const balls: BallPhysicsState[] = [
      {
        id: 1,
        type: 'solid',
        position: { x: -1.0, z: -0.5 },
        height: 0,
        velocity: { x: -5.0, z: -2.5 },
        verticalVelocity: 0,
        angularVelocity: { x: 0, y: 0, z: 0 },
        state: 'sliding',
      },
    ];

    const engine = new BilliardsPhysicsEngine(balls);
    let pocketed = false;

    for (let step = 0; step < 120; step++) {
      const snap = engine.step(TABLE_CONSTANTS.FIXED_TIMESTEP);
      if (snap.events.some(e => e.type === 'ball_pocket')) {
        pocketed = true;
        break;
      }
    }

    expect(pocketed).toBe(true);
    const b = engine.getBalls()[0];
    expect(b.state).toMatch(/falling|pocketed/);
  });

  it('should capture ball entering side pocket', () => {
    const balls: BallPhysicsState[] = [
      {
        id: 2,
        type: 'solid',
        position: { x: 0.02, z: -0.4 },
        height: 0,
        velocity: { x: 0, z: -3.0 }, // moving straight into top side pocket
        verticalVelocity: 0,
        angularVelocity: { x: 0, y: 0, z: 0 },
        state: 'rolling',
      },
    ];

    const engine = new BilliardsPhysicsEngine(balls);
    let pocketed = false;

    for (let step = 0; step < 120; step++) {
      const snap = engine.step(TABLE_CONSTANTS.FIXED_TIMESTEP);
      if (snap.events.some(e => e.type === 'ball_pocket' && e.pocketId === 'pocket_side_t')) {
        pocketed = true;
        break;
      }
    }

    expect(pocketed).toBe(true);
  });

  it('should strictly contain all balls within table perimeter bounds', () => {
    // Place balls heading at various extreme angles and speeds
    const balls: BallPhysicsState[] = [
      {
        id: 4,
        type: 'solid',
        position: { x: 0.5, z: 0.2 },
        height: 0,
        velocity: { x: 7.0, z: 6.0 },
        verticalVelocity: 0,
        angularVelocity: { x: 0, y: 0, z: 0 },
        state: 'sliding',
      },
      {
        id: 5,
        type: 'solid',
        position: { x: -0.5, z: -0.2 },
        height: 0,
        velocity: { x: -6.5, z: 5.5 },
        verticalVelocity: 0,
        angularVelocity: { x: 0, y: 0, z: 0 },
        state: 'sliding',
      },
    ];

    const engine = new BilliardsPhysicsEngine(balls);

    for (let step = 0; step < 240; step++) {
      engine.step(TABLE_CONSTANTS.FIXED_TIMESTEP);
      for (const b of engine.getBalls()) {
        if (b.state === 'pocketed' || b.state === 'falling') continue;
        // Every active rolling ball must remain inside the playfield plus minor cushion tolerance
        expect(b.position.x).toBeGreaterThanOrEqual(TABLE_CONSTANTS.PLAYFIELD_MIN_X - 0.01);
        expect(b.position.x).toBeLessThanOrEqual(TABLE_CONSTANTS.PLAYFIELD_MAX_X + 0.01);
        expect(b.position.z).toBeGreaterThanOrEqual(TABLE_CONSTANTS.PLAYFIELD_MIN_Z - 0.01);
        expect(b.position.z).toBeLessThanOrEqual(TABLE_CONSTANTS.PLAYFIELD_MAX_Z + 0.01);
      }
    }
  });

  it('should deliver tournament-level speed (~14.5 m/s) at 100% shot power', () => {
    const balls = createStandard8BallRack();
    const engine = new BilliardsPhysicsEngine(balls);

    const cueBall = engine.getCueBall();
    expect(cueBall).toBeDefined();

    // Strike at 100% power along X axis
    engine.strikeCueBall({ power: 1.0, angle: 0, spinX: 0, spinY: 0 });

    const speed = Math.hypot(cueBall!.velocity.x, cueBall!.velocity.z);
    expect(speed).toBeCloseTo(14.5, 1);
  });

  it('should explosively scatter the 15-ball rack on a 100% break shot', () => {
    const balls = createStandard8BallRack();
    const engine = new BilliardsPhysicsEngine(balls);

    const initialPositions = balls.map(b => ({ id: b.id, x: b.position.x, z: b.position.z }));

    // Break shot directly towards the apex ball (ball 1)
    engine.strikeCueBall({ power: 1.0, angle: 0, spinX: 0, spinY: 0.2 });

    // Simulate break until rest
    let steps = 0;
    while (engine.isMoving() && steps < 3000) {
      engine.step(TABLE_CONSTANTS.FIXED_TIMESTEP);
      steps++;
    }
    expect(engine.isMoving()).toBe(false);
    expect(steps).toBeLessThan(1200); // Settles naturally in under 10 seconds!

    // Count how many object balls moved significantly from their rack positions
    let scatteredCount = 0;
    for (const b of engine.getBalls()) {
      if (b.id === 0) continue; // skip cue ball
      const init = initialPositions.find(p => p.id === b.id)!;
      const movedDist = Math.hypot(b.position.x - init.x, b.position.z - init.z);
      // Moved at least 15cm from initial triangle rack position
      if (movedDist > 0.15 || b.state === 'pocketed' || b.state === 'falling') {
        scatteredCount++;
      }
    }

    // A powerful break should scatter at least 10+ balls across the table
    expect(scatteredCount).toBeGreaterThanOrEqual(10);
  });
});
