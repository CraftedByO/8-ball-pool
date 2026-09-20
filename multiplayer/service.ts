import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { MatchDocument, MatchPlayer } from './types';
import { createStandard8BallRack } from '../physics/setup';
import { EightBallRulesEngine } from '../rules/engine';
import { ShotParameters } from '../physics/types';
import { BilliardsPhysicsEngine } from '../physics/engine';
import { calculateEloDelta } from '../leaderboard/elo';

export class MultiplayerService {
  /**
   * Generate an uppercase 6-character room code
   */
  public static generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Create a new match room in Firestore
   */
  public static async createRoom(creator: MatchPlayer): Promise<MatchDocument> {
    const roomCode = this.generateRoomCode();
    const matchId = `match_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const rules = new EightBallRulesEngine('player1');
    const initialBalls = createStandard8BallRack();

    const matchDoc: MatchDocument = {
      id: matchId,
      roomCode,
      createdAt: Date.now(),
      status: 'waiting',
      player1: creator,
      turn: 'player1',
      rulesState: rules.getState(),
      balls: initialBalls,
    };

    if (db) {
      try {
        const ref = doc(db, 'matches', matchId);
        await setDoc(ref, matchDoc);
      } catch (err) {
        console.warn('Firestore room creation fallback to mock/local:', err);
      }
    }

    return matchDoc;
  }

  /**
   * Join an existing match room by roomCode
   */
  public static async joinRoom(roomCode: string, joiner: MatchPlayer): Promise<MatchDocument | null> {
    const code = roomCode.trim().toUpperCase();

    if (db) {
      try {
        const q = query(
          collection(db, 'matches'),
          where('roomCode', '==', code),
          where('status', '==', 'waiting'),
          limit(1)
        );
        const snaps = await getDocs(q);

        if (!snaps.empty) {
          const docSnap = snaps.docs[0];
          const matchData = docSnap.data() as MatchDocument;

          if (matchData.player1.uid === joiner.uid) {
            return matchData; // Rejoining as creator
          }

          const updated: Partial<MatchDocument> = {
            player2: joiner,
            status: 'in_progress',
          };

          await updateDoc(docSnap.ref, updated);
          return { ...matchData, ...updated } as MatchDocument;
        }
      } catch (err) {
        console.warn('Firestore joinRoom failed:', err);
      }
    }

    return null;
  }

  /**
   * Subscribe to real-time changes of a match
   */
  public static subscribeToMatch(
    matchId: string,
    callback: (match: MatchDocument) => void
  ): () => void {
    if (!db) {
      return () => {};
    }

    const ref = doc(db, 'matches', matchId);
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        callback(snap.data() as MatchDocument);
      }
    });
  }

  /**
   * Submit shot and validate deterministically on server/referee
   */
  public static async submitShot(
    match: MatchDocument,
    shooterUid: string,
    shotParams: ShotParameters
  ): Promise<MatchDocument> {
    const shooter = match.turn;
    const shooterPlayer = shooter === 'player1' ? match.player1 : match.player2;

    if (!shooterPlayer || shooterPlayer.uid !== shooterUid) {
      throw new Error('Not your turn to shoot');
    }

    // 1. Reconstruct physics engine with current balls
    const physics = new BilliardsPhysicsEngine(match.balls);
    physics.strikeCueBall(shotParams);

    // Track newly pocketed
    const previouslyPocketed = new Set(
      match.balls.filter(b => b.state === 'pocketed').map(b => b.id)
    );

    // Simulate to rest
    const simulationResult = physics.simulateUntilRest();
    const finalBalls = simulationResult.balls;

    const newlyPocketed: number[] = [];
    for (const b of finalBalls) {
      if (b.state === 'pocketed' && !previouslyPocketed.has(b.id)) {
        newlyPocketed.push(b.id);
      }
    }

    const remainingOnTable = finalBalls
      .filter(b => b.state !== 'pocketed')
      .map(b => b.id);

    // 2. Evaluate with Rules engine
    const rules = new EightBallRulesEngine(match.turn);
    rules.setState(match.rulesState);

    const validation = rules.evaluateShot(
      simulationResult.events,
      newlyPocketed,
      remainingOnTable
    );

    // 3. Handle scratch/ball in hand
    if (validation.fouls.isScratch) {
      const cueBall = finalBalls.find(b => b.id === 0);
      if (cueBall) {
        cueBall.state = 'active';
        cueBall.position = { x: -0.635, z: 0 }; // Reposition cue ball behind headstring
        cueBall.velocity = { x: 0, z: 0 };
        cueBall.height = 0;
      }
    }

    // 4. Update match document
    const updatedMatch: MatchDocument = {
      ...match,
      turn: validation.nextTurn,
      rulesState: rules.getState(),
      balls: finalBalls,
      lastShot: {
        shooter,
        params: shotParams,
        timestamp: Date.now(),
        shotSeq: (match.lastShot?.shotSeq || 0) + 1,
      },
    };

    if (validation.winner) {
      updatedMatch.status = 'completed';
      const winnerPlayer = validation.winner === 'player1' ? match.player1 : match.player2;
      updatedMatch.winnerUid = winnerPlayer?.uid;

      if (match.player1 && match.player2) {
        const delta = calculateEloDelta(
          match.player1.rating,
          match.player2.rating,
          validation.winner === 'player1' ? 1 : 0
        );
        updatedMatch.ratingDelta = Math.abs(delta);
      }
    }

    if (db) {
      try {
        const ref = doc(db, 'matches', match.id);
        await updateDoc(ref, {
          turn: updatedMatch.turn,
          rulesState: updatedMatch.rulesState,
          balls: updatedMatch.balls,
          lastShot: updatedMatch.lastShot,
          status: updatedMatch.status,
          winnerUid: updatedMatch.winnerUid || null,
          ratingDelta: updatedMatch.ratingDelta || null,
        });
      } catch (err) {
        console.warn('Error updating match in Firestore:', err);
      }
    }

    return updatedMatch;
  }

  /**
   * Update cue ball position during Ball-in-Hand placement
   */
  public static async updateCueBallPlacement(
    matchId: string,
    position: { x: number; z: number }
  ): Promise<void> {
    if (!db) return;
    try {
      const ref = doc(db, 'matches', matchId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;

      const matchData = snap.data() as MatchDocument;
      const balls = matchData.balls.map(b => {
        if (b.id === 0) {
          return {
            ...b,
            position: { x: position.x, z: position.z },
            velocity: { x: 0, z: 0 },
            height: 0,
            state: 'active' as const,
          };
        }
        return b;
      });

      await updateDoc(ref, { balls });
    } catch (err) {
      console.warn('Failed to sync cue ball placement:', err);
    }
  }

  /**
   * Forfeit/concede a match
   */
  public static async forfeitMatch(
    matchId: string,
    forfeiterUid: string
  ): Promise<void> {
    if (!db) return;
    try {
      const ref = doc(db, 'matches', matchId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;

      const match = snap.data() as MatchDocument;
      const winnerPlayer = match.player1.uid === forfeiterUid ? match.player2 : match.player1;
      if (!winnerPlayer) return;

      await updateDoc(ref, {
        status: 'completed',
        winnerUid: winnerPlayer.uid,
      });
    } catch (err) {
      console.warn('Failed to forfeit match:', err);
    }
  }
}
