import { BallPhysicsState, ShotParameters } from '../physics/types';
import { PlayerId, RulesState } from '../rules/types';

export type MatchStatus = 'waiting' | 'in_progress' | 'completed' | 'abandoned';

export interface MatchPlayer {
  uid: string;
  username: string;
  rating: number;
  isReady: boolean;
  connected: boolean;
  lastPing: number;
}

export interface LiveAimState {
  shooter: PlayerId;
  aimAngle: number;
  power: number;
  spinX: number;
  spinY: number;
  cueBallPos?: { x: number; z: number };
  updatedAt: number;
}

export interface MatchDocument {
  id: string;
  roomCode: string;
  createdAt: number;
  status: MatchStatus;
  player1: MatchPlayer;
  player2?: MatchPlayer;
  turn: PlayerId;
  rulesState: RulesState;
  balls: BallPhysicsState[];
  liveState?: LiveAimState;
  lastShot?: {
    shooter: PlayerId;
    params: ShotParameters;
    timestamp: number;
    shotSeq: number;
  };
  winnerUid?: string;
  ratingDelta?: number;
}
