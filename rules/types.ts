export type PlayerId = 'player1' | 'player2';

export type BallGroup = 'solids' | 'stripes';

export type GameStatus =
  | 'not_started'
  | 'break'
  | 'in_turn'
  | 'shot_in_progress'
  | 'ball_in_hand'
  | 'game_over';

export interface FoulInfo {
  isFoul: boolean;
  reason?: string;
  isScratch: boolean;
}

export interface ShotResultValidation {
  isLegal: boolean;
  fouls: FoulInfo;
  pocketedBalls: number[];
  firstBallHit: number | null;
  cushionHitAfterContact: boolean;
  assignedGroup: {
    player1: BallGroup | null;
    player2: BallGroup | null;
  };
  winner: PlayerId | null;
  nextTurn: PlayerId;
  ballInHand: boolean;
  gameOverReason?: string;
}

export interface RulesState {
  currentTurn: PlayerId;
  status: GameStatus;
  tableOpen: boolean;
  groups: {
    player1: BallGroup | null;
    player2: BallGroup | null;
  };
  winner: PlayerId | null;
  loser: PlayerId | null;
  winReason?: string;
  isBallInHand: boolean;
  isBreakShot: boolean;
  lastFoul?: string;
  consecutiveFouls: {
    player1: number;
    player2: number;
  };
}
