import { ShotParameters } from '../physics/types';

export type AIDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface AIShotDecision {
  targetBallId: number;
  pocketId: string;
  shotParams: ShotParameters;
  confidence: number; // 0 to 1
  isSafetyShot?: boolean;
}
