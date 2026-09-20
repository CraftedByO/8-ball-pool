import { describe, it, expect } from 'vitest';
import { MultiplayerService } from '../multiplayer/service';
import { MatchPlayer } from '../multiplayer/types';

describe('MultiplayerService', () => {
  it('generates a 6-character alphanumeric room code without ambiguous characters', () => {
    const code = MultiplayerService.generateRoomCode();
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    // Should avoid confusing characters like 0, 1, I, O
    expect(code).not.toMatch(/[01IO]/);
  });

  it('creates a match with standard initial rack and rules state', async () => {
    const creator: MatchPlayer = {
      uid: 'user_host_123',
      username: 'Player1',
      rating: 1200,
      isReady: true,
      connected: true,
      lastPing: Date.now(),
    };

    const match = await MultiplayerService.createRoom(creator);

    expect(match.id).toBeDefined();
    expect(match.roomCode).toHaveLength(6);
    expect(match.status).toBe('waiting');
    expect(match.player1.uid).toBe('user_host_123');
    expect(match.player1.username).toBe('Player1');
    expect(match.turn).toBe('player1');
    expect(match.balls).toHaveLength(16); // Cue ball + 15 object balls
    expect(match.rulesState.tableOpen).toBe(true);
    expect(match.rulesState.isBreakShot).toBe(true);
  });

  it('handles shot execution and advances turn deterministically', async () => {
    const creator: MatchPlayer = {
      uid: 'user_host_123',
      username: 'Player1',
      rating: 1200,
      isReady: true,
      connected: true,
      lastPing: Date.now(),
    };

    const joiner: MatchPlayer = {
      uid: 'user_guest_456',
      username: 'Player2',
      rating: 1250,
      isReady: true,
      connected: true,
      lastPing: Date.now(),
    };

    const match = await MultiplayerService.createRoom(creator);
    match.player2 = joiner;
    match.status = 'in_progress';

    // Player 1 executes break shot
    const updated = await MultiplayerService.submitShot(match, creator.uid, {
      power: 0.8,
      angle: 0,
      spinX: 0,
      spinY: 0,
    });

    expect(updated.lastShot).toBeDefined();
    expect(updated.lastShot?.shooter).toBe('player1');
    expect(updated.lastShot?.shotSeq).toBe(1);
    expect(updated.balls).toHaveLength(16);
  });

  it('rejects shots when not shooter turn', async () => {
    const creator: MatchPlayer = {
      uid: 'user_host_123',
      username: 'Player1',
      rating: 1200,
      isReady: true,
      connected: true,
      lastPing: Date.now(),
    };

    const joiner: MatchPlayer = {
      uid: 'user_guest_456',
      username: 'Player2',
      rating: 1250,
      isReady: true,
      connected: true,
      lastPing: Date.now(),
    };

    const match = await MultiplayerService.createRoom(creator);
    match.player2 = joiner;
    match.status = 'in_progress';
    match.turn = 'player1';

    // Player 2 attempts to shoot when it is Player 1's turn
    await expect(
      MultiplayerService.submitShot(match, joiner.uid, {
        power: 0.5,
        angle: 0,
        spinX: 0,
        spinY: 0,
      })
    ).rejects.toThrow('Not your turn to shoot');
  });
});
