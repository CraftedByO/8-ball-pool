import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  doc,
  updateDoc,
  increment,
  addDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { LeaderboardEntry, MatchHistoryEntry, PlayerProfile } from './types';
import { calculateEloDelta, getRankTier } from './elo';

const LOCAL_STORAGE_HISTORY_KEY = 'pool_arena_match_history';

export class LeaderboardService {
  /**
   * Fetch top players for the leaderboard
   */
  public static async getGlobalLeaderboard(maxEntries: number = 25): Promise<LeaderboardEntry[]> {
    if (db) {
      try {
        const q = query(
          collection(db, 'users'),
          orderBy('rating', 'desc'),
          limit(maxEntries)
        );
        const snaps = await getDocs(q);

        if (!snaps.empty) {
          return snaps.docs.map((docSnap, index) => {
            const data = docSnap.data() as PlayerProfile;
            return {
              rank: index + 1,
              uid: data.uid,
              username: data.username,
              rating: data.rating || 1200,
              wins: data.wins || 0,
              losses: data.losses || 0,
              winRate: data.gamesPlayed > 0 ? (data.wins / data.gamesPlayed) * 100 : 0,
              rankTier: getRankTier(data.rating || 1200),
            };
          });
        }
      } catch (err) {
        console.warn('Firestore leaderboard fetch error, using fallback:', err);
      }
    }

    // Default mock competitive leaderboard data for initial launch/offline preview
    return [
      { rank: 1, uid: 'ai_expert', username: 'RonnieO_AI', rating: 2280, wins: 142, losses: 18, winRate: 88.7, rankTier: 'Master' },
      { rank: 2, uid: 'p2', username: 'Efren_ Reyes', rating: 2150, wins: 110, losses: 22, winRate: 83.3, rankTier: 'Master' },
      { rank: 3, uid: 'p3', username: 'CueMaster_X', rating: 1940, wins: 88, losses: 35, winRate: 71.5, rankTier: 'Diamond' },
      { rank: 4, uid: 'p4', username: 'ShadowPocket', rating: 1820, wins: 64, losses: 31, winRate: 67.3, rankTier: 'Diamond' },
      { rank: 5, uid: 'p5', username: 'SpinDoctor', rating: 1710, wins: 55, losses: 40, winRate: 57.8, rankTier: 'Platinum' },
      { rank: 6, uid: 'p6', username: '8BallWizard', rating: 1650, wins: 48, losses: 39, winRate: 55.1, rankTier: 'Platinum' },
      { rank: 7, uid: 'p7', username: 'ChalkAndBank', rating: 1490, wins: 32, losses: 30, winRate: 51.6, rankTier: 'Gold' },
      { rank: 8, uid: 'p8', username: 'BreakShotPro', rating: 1350, wins: 22, losses: 26, winRate: 45.8, rankTier: 'Silver' },
    ];
  }

  /**
   * Record match result and update Elo ratings
   */
  public static async recordMatchResult(params: {
    player1: PlayerProfile;
    player2: PlayerProfile;
    winnerUid: string;
    isAiMatch?: boolean;
  }): Promise<{ ratingDelta: number; newRatingP1: number; newRatingP2: number }> {
    const isP1Winner = params.winnerUid === params.player1.uid;
    const delta = calculateEloDelta(
      params.player1.rating,
      params.player2.rating,
      isP1Winner ? 1 : 0
    );

    const newRatingP1 = Math.max(800, params.player1.rating + delta);
    const newRatingP2 = Math.max(800, params.player2.rating - delta);

    const historyEntry: MatchHistoryEntry = {
      matchId: `hist_${Date.now()}`,
      timestamp: Date.now(),
      player1Uid: params.player1.uid,
      player1Username: params.player1.username,
      player2Uid: params.player2.uid,
      player2Username: params.player2.username,
      winnerUid: params.winnerUid,
      player1Score: isP1Winner ? 1 : 0,
      player2Score: isP1Winner ? 0 : 1,
      ratingDelta: Math.abs(delta),
      isAiMatch: params.isAiMatch,
    };

    // Save locally
    try {
      const localHist = JSON.parse(localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY) || '[]');
      localHist.unshift(historyEntry);
      localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(localHist.slice(0, 20)));
    } catch {
      // ignore
    }

    if (db && !params.isAiMatch) {
      try {
        await addDoc(collection(db, 'match_history'), historyEntry);

        // Update P1
        const p1Ref = doc(db, 'users', params.player1.uid);
        await updateDoc(p1Ref, {
          rating: newRatingP1,
          wins: increment(isP1Winner ? 1 : 0),
          losses: increment(isP1Winner ? 0 : 1),
          gamesPlayed: increment(1),
          rankTier: getRankTier(newRatingP1),
        });

        // Update P2
        const p2Ref = doc(db, 'users', params.player2.uid);
        await updateDoc(p2Ref, {
          rating: newRatingP2,
          wins: increment(isP1Winner ? 0 : 1),
          losses: increment(isP1Winner ? 1 : 0),
          gamesPlayed: increment(1),
          rankTier: getRankTier(newRatingP2),
        });
      } catch (e) {
        console.warn('Firestore update for match result failed:', e);
      }
    }

    return {
      ratingDelta: Math.abs(delta),
      newRatingP1,
      newRatingP2,
    };
  }
}
