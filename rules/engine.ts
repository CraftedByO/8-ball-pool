import { PlayerId, BallGroup, RulesState, ShotResultValidation } from './types';
import { CollisionEvent } from '../physics/types';

export class EightBallRulesEngine {
  private state: RulesState;

  constructor(initialTurn: PlayerId = 'player1') {
    this.state = {
      currentTurn: initialTurn,
      status: 'break',
      tableOpen: true,
      groups: {
        player1: null,
        player2: null,
      },
      winner: null,
      loser: null,
      isBallInHand: false,
      isBreakShot: true,
      consecutiveFouls: {
        player1: 0,
        player2: 0,
      },
    };
  }

  public getState(): RulesState {
    return { ...this.state, groups: { ...this.state.groups }, consecutiveFouls: { ...this.state.consecutiveFouls } };
  }

  public setState(state: RulesState) {
    this.state = { ...state, groups: { ...state.groups }, consecutiveFouls: { ...state.consecutiveFouls } };
  }

  public getOpponent(player: PlayerId): PlayerId {
    return player === 'player1' ? 'player2' : 'player1';
  }

  public getGroupForBall(ballId: number): BallGroup | '8ball' | 'cue' {
    if (ballId === 0) return 'cue';
    if (ballId === 8) return '8ball';
    if (ballId >= 1 && ballId <= 7) return 'solids';
    return 'stripes';
  }

  /**
   * Determine if player must shoot the 8-ball (all group balls pocketed)
   */
  public isPlayerOnEightBall(player: PlayerId, remainingBalls: number[]): boolean {
    const group = this.state.groups[player];
    if (!group) return false;

    const groupBallsRemaining = remainingBalls.filter(id => {
      if (id === 0 || id === 8) return false;
      return this.getGroupForBall(id) === group;
    });

    return groupBallsRemaining.length === 0;
  }

  /**
   * Validate a completed shot given collision events, newly pocketed balls, and remaining balls.
   */
  public evaluateShot(
    events: CollisionEvent[],
    newlyPocketed: number[],
    remainingOnTable: number[]
  ): ShotResultValidation {
    const shooter = this.state.currentTurn;
    const opponent = this.getOpponent(shooter);
    const isBreak = this.state.isBreakShot;

    let isFoul = false;
    let foulReason: string | undefined;
    let isScratch = false;
    let winner: PlayerId | null = null;
    let gameOverReason: string | undefined;

    // 1. Check cue scratch
    if (newlyPocketed.includes(0)) {
      isFoul = true;
      isScratch = true;
      foulReason = 'Cue ball scratched in pocket';
    }

    // 2. Find first ball contacted by cue ball
    let firstBallHit: number | null = null;
    let cueCollisionIndex = -1;

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (ev.type === 'ball_ball') {
        if (ev.ballA === 0 && ev.ballB !== undefined) {
          firstBallHit = ev.ballB;
          cueCollisionIndex = i;
          break;
        } else if (ev.ballB === 0) {
          firstBallHit = ev.ballA;
          cueCollisionIndex = i;
          break;
        }
      }
    }

    // Check if cue ball failed to hit any ball
    if (firstBallHit === null) {
      isFoul = true;
      if (!foulReason) foulReason = 'Cue ball failed to contact any object ball';
    }

    // 3. Check legal first ball contact
    const shooterGroup = this.state.groups[shooter];
    const on8Ball = this.isPlayerOnEightBall(shooter, remainingOnTable);

    if (firstBallHit !== null) {
      const firstHitGroup = this.getGroupForBall(firstBallHit);

      if (isBreak) {
        // Any ball can be contacted on break, but typically head ball
        // Standard WPA: legal contact is any object ball
      } else if (this.state.tableOpen) {
        // Table is open: can hit any ball EXCEPT the 8-ball
        if (firstHitGroup === '8ball') {
          isFoul = true;
          if (!foulReason) foulReason = 'Illegal contact: Cannot hit 8-ball first while table is open';
        }
      } else {
        // Table closed with assigned groups
        if (on8Ball) {
          // Must hit 8-ball first
          if (firstHitGroup !== '8ball') {
            isFoul = true;
            if (!foulReason) foulReason = 'Illegal contact: Must contact the 8-ball first';
          }
        } else {
          // Must hit own group ball first
          if (firstHitGroup !== shooterGroup) {
            isFoul = true;
            if (!foulReason) foulReason = `Illegal contact: Must hit ${shooterGroup} first`;
          }
        }
      }
    }

    // 4. Cushion requirement after contact
    // If no ball was pocketed, at least one ball must touch a cushion after the first collision
    let cushionContactOccurred = false;
    if (cueCollisionIndex !== -1) {
      for (let i = cueCollisionIndex + 1; i < events.length; i++) {
        if (events[i].type === 'ball_cushion') {
          cushionContactOccurred = true;
          break;
        }
      }
    }

    if (!isFoul && newlyPocketed.length === 0 && !cushionContactOccurred) {
      isFoul = true;
      if (!foulReason) foulReason = 'No ball was pocketed and no ball reached a cushion after contact';
    }

    // 5. 8-Ball Pocketing outcomes
    const eightPocketed = newlyPocketed.includes(8);
    if (eightPocketed) {
      if (isBreak) {
        // 8-ball on break (WPA rule: win or respotted depending on variant; we award a spectacular win)
        if (isScratch) {
          winner = opponent;
          gameOverReason = `${shooter} pocketed 8-ball but scratched on break`;
        } else {
          winner = shooter;
          gameOverReason = `${shooter} won by pocketing the 8-ball on break!`;
        }
      } else if (on8Ball && !isFoul) {
        // Legal win on 8-ball!
        winner = shooter;
        gameOverReason = `${shooter} legally pocketed the 8-ball to win!`;
      } else {
        // Premature 8-ball pocketed OR pocketed during a foul -> LOSS
        winner = opponent;
        gameOverReason = `${shooter} committed a foul or prematurely pocketed the 8-ball`;
      }
    }

    // 6. Group Assignment if table was open
    const objectPocketed = newlyPocketed.filter(id => id !== 0 && id !== 8);
    let nextTurn: PlayerId = shooter;
    let ballInHand = false;

    if (this.state.tableOpen && !isFoul && objectPocketed.length > 0) {
      const allSolids = objectPocketed.every(id => this.getGroupForBall(id) === 'solids');
      const allStripes = objectPocketed.every(id => this.getGroupForBall(id) === 'stripes');

      // Assign groups if post-break, or if break pocketed exclusively solids or stripes
      if (!isBreak || allSolids || allStripes) {
        const targetBall = (firstBallHit && firstBallHit !== 8 && objectPocketed.includes(firstBallHit))
          ? firstBallHit
          : objectPocketed[0];
        const assigned = allStripes ? 'stripes' : allSolids ? 'solids' : this.getGroupForBall(targetBall);

        if (assigned === 'solids') {
          this.state.groups[shooter] = 'solids';
          this.state.groups[opponent] = 'stripes';
        } else {
          this.state.groups[shooter] = 'stripes';
          this.state.groups[opponent] = 'solids';
        }
        this.state.tableOpen = false;
      }
    }

    // 7. Turn Decision
    if (winner !== null) {
      this.state.status = 'game_over';
      this.state.winner = winner;
      this.state.loser = this.getOpponent(winner);
      this.state.winReason = gameOverReason;
      nextTurn = shooter;
    } else if (isFoul) {
      this.state.consecutiveFouls[shooter]++;
      nextTurn = opponent;
      ballInHand = true;
      this.state.isBallInHand = true;
      this.state.lastFoul = foulReason;
    } else {
      this.state.consecutiveFouls[shooter] = 0;
      this.state.isBallInHand = false;

      // Shooter continues turn if they pocketed at least one legal ball
      let pocketedOwn = false;
      if (this.state.tableOpen) {
        pocketedOwn = objectPocketed.length > 0;
      } else {
        const myGroup = this.state.groups[shooter];
        pocketedOwn = objectPocketed.some(id => this.getGroupForBall(id) === myGroup);
      }

      if (pocketedOwn) {
        nextTurn = shooter;
      } else {
        nextTurn = opponent;
      }
    }

    // Update internal state
    this.state.isBreakShot = false;
    this.state.currentTurn = nextTurn;
    if (this.state.status !== 'game_over') {
      this.state.status = ballInHand ? 'ball_in_hand' : 'in_turn';
    }

    return {
      isLegal: !isFoul,
      fouls: {
        isFoul,
        reason: foulReason,
        isScratch,
      },
      pocketedBalls: newlyPocketed,
      firstBallHit,
      cushionHitAfterContact: cushionContactOccurred,
      assignedGroup: { ...this.state.groups },
      winner,
      nextTurn,
      ballInHand,
      gameOverReason,
    };
  }

  public clearBallInHand() {
    this.state.isBallInHand = false;
    if (this.state.status === 'ball_in_hand') {
      this.state.status = 'in_turn';
    }
  }
}
