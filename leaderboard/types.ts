export interface PlayerProfile {
  uid: string;
  username: string;
  normalizedUsername: string; // lowercase for uniqueness
  createdAt: number;
  lastActive: number;
  rating: number; // Elo rating, starting at 1200
  wins: number;
  losses: number;
  gamesPlayed: number;
  winRate: number; // 0 to 1
  rankTier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Master';
}

export interface MatchHistoryEntry {
  matchId: string;
  timestamp: number;
  player1Uid: string;
  player1Username: string;
  player2Uid: string;
  player2Username: string;
  winnerUid: string;
  player1Score: number;
  player2Score: number;
  ratingDelta: number;
  isAiMatch?: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  uid: string;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  winRate: number;
  rankTier: string;
}
