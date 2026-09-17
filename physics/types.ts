import { Vector2D, Vector3D } from './constants';

export type BallType = 'cue' | 'solid' | 'stripe' | '8ball';

export type BallState = 'active' | 'sliding' | 'rolling' | 'pocketed' | 'falling';

export interface BallPhysicsState {
  id: number; // 0 for cue, 1-7 solids, 8 8-ball, 9-15 stripes
  type: BallType;
  position: Vector2D; // x, z coordinates on table plane (y = BALL_RADIUS)
  height: number; // y coordinate (drops when in pocket)
  velocity: Vector2D; // vx, vz (m/s)
  verticalVelocity: number; // vy for falling into pocket
  angularVelocity: Vector3D; // wx, wy, wz (rad/s)
  state: BallState;
  pocketedIn?: string; // pocket id
}

export interface ShotParameters {
  power: number; // 0 to 1 (normalized strike force)
  angle: number; // shot direction in radians on table plane
  spinX: number; // -1 to 1 (left/right english)
  spinY: number; // -1 to 1 (topspin / backspin)
}

export interface CollisionEvent {
  type: 'ball_ball' | 'ball_cushion' | 'ball_pocket';
  ballA: number;
  ballB?: number;
  cushionId?: string;
  pocketId?: string;
  impulse: number;
  timestamp: number;
}

export interface SimulationSnapshot {
  balls: BallPhysicsState[];
  isMoving: boolean;
  events: CollisionEvent[];
}
