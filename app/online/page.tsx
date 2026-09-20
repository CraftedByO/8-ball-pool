'use client';

import React, { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { NavigationHeader } from '../../components/NavigationHeader';
import { GameHUD } from '../../components/GameHUD';
import { PowerMeter } from '../../components/PowerMeter';
import { SpinControl } from '../../components/SpinControl';
import { MatchResultModal } from '../../components/MatchResultModal';
import { initAnonymousAuth, getPlayerProfile, claimUsername } from '../../firebase/auth';
import { PlayerProfile } from '../../leaderboard/types';
import { MultiplayerService } from '../../multiplayer/service';
import { MatchDocument, MatchPlayer, LiveAimState } from '../../multiplayer/types';
import { BilliardsPhysicsEngine } from '../../physics/engine';
import { EightBallRulesEngine } from '../../rules/engine';
import { PoolGameRenderer } from '../../game/scene';
import { soundFX } from '../../game/sound';
import { TABLE_CONSTANTS } from '../../physics/constants';
import { ShotParameters, BallPhysicsState } from '../../physics/types';
import { calculateAimTrajectory } from '../../physics/trajectory';
import { clampBallInHandPosition, isBallInHandPlacementValid } from '../../physics/setup';
import {
  Users,
  Copy,
  Check,
  Share2,
  ArrowRight,
  Shield,
  Loader2,
  Move,
  User,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

function OnlineMultiplayerContent() {
  const searchParams = useSearchParams();
  const roomQuery = searchParams.get('room');

  // Player & Auth State
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [customUsername, setCustomUsername] = useState('');
  const [isEditingUsername, setIsEditingUsername] = useState(false);

  // Match & Lobby State
  const [match, setMatch] = useState<MatchDocument | null>(null);
  const [roomCodeInput, setRoomCodeInput] = useState(roomQuery ? roomQuery.toUpperCase() : '');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [lobbyError, setLobbyError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Gameplay Refs & State
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<PoolGameRenderer | null>(null);
  const physicsRef = useRef<BilliardsPhysicsEngine | null>(null);
  const rulesRef = useRef<EightBallRulesEngine | null>(null);
  const lastShotSeqRef = useRef<number>(0);

  const [aimAngle, setAimAngle] = useState(0);
  const [power, setPower] = useState(0.5);
  const [spinX, setSpinX] = useState(0);
  const [spinY, setSpinY] = useState(0);
  const [isShooting, setIsShooting] = useState(false);
  const [cameraMode, setCameraMode] = useState<'overhead' | 'player'>('player');
  const [isMuted, setIsMuted] = useState(false);
  const [isPlacementValid, setIsPlacementValid] = useState(true);

  // Ref tracking for requestAnimationFrame loop to prevent stale closures
  const aimAngleRef = useRef(aimAngle);
  aimAngleRef.current = aimAngle;
  const powerRef = useRef(power);
  powerRef.current = power;
  const isShootingRef = useRef(isShooting);
  isShootingRef.current = isShooting;

  const isPlayer1 = user?.uid === match?.player1.uid;
  const isMyTurn =
    match?.status === 'in_progress' &&
    ((match.turn === 'player1' && isPlayer1) || (match.turn === 'player2' && !isPlayer1));
  const isMyTurnRef = useRef(isMyTurn);
  isMyTurnRef.current = isMyTurn;

  const isBallInHand = !!match?.rulesState.isBallInHand;
  const isBallInHandRef = useRef(isBallInHand);
  isBallInHandRef.current = isBallInHand;

  const isBreakShot = !!match?.rulesState.isBreakShot;
  const isBreakShotRef = useRef(isBreakShot);
  isBreakShotRef.current = isBreakShot;

  // Pointer interaction refs
  const isPointerAiming = useRef(false);
  const isDraggingCueBallRef = useRef(false);
  const lastPointerX = useRef(0);
  const pointerDownPos = useRef({ x: 0, y: 0 });

  // Opponent live aiming and interaction refs
  const matchRef = useRef<MatchDocument | null>(null);
  matchRef.current = match;
  const oppLiveStateRef = useRef<LiveAimState | null>(null);
  const oppAimAngleRef = useRef<number>(0);
  const oppPowerRef = useRef<number>(0);
  const lastBroadcastRef = useRef<number>(0);

  const broadcastLiveAimState = useCallback(
    (params?: {
      customAim?: number;
      customPower?: number;
      customPos?: { x: number; z: number };
      immediate?: boolean;
    }) => {
      if (!match?.id || !isMyTurnRef.current || isShootingRef.current) return;
      const now = performance.now();
      if (!params?.immediate && now - lastBroadcastRef.current < 70) {
        return;
      }
      lastBroadcastRef.current = now;

      const myRole = isPlayer1 ? 'player1' : 'player2';
      const angle = params?.customAim !== undefined ? params.customAim : aimAngleRef.current;
      const pow = params?.customPower !== undefined ? params.customPower : powerRef.current;
      const pos = params?.customPos;

      MultiplayerService.updateLiveAimState(match.id, {
        shooter: myRole,
        aimAngle: angle,
        power: pow,
        spinX,
        spinY,
        cueBallPos: pos,
        updatedAt: Date.now(),
      });
    },
    [match?.id, isPlayer1, spinX, spinY]
  );

  // 1. Initialize Auth & Profile
  useEffect(() => {
    initAnonymousAuth().then(authUser => {
      if (authUser) {
        setUser({ uid: authUser.uid });
        getPlayerProfile(authUser.uid).then(p => {
          if (p) {
            setProfile(p);
            setCustomUsername(p.username);
          } else {
            const defaultName = `Player_${authUser.uid.substring(0, 5)}`;
            setCustomUsername(defaultName);
          }
        });
      }
    });
  }, []);

  // Update roomCodeInput if URL param changes
  useEffect(() => {
    if (roomQuery) {
      setRoomCodeInput(roomQuery.trim().toUpperCase());
    }
  }, [roomQuery]);

  // Handle username claim
  const handleSaveUsername = async () => {
    if (!user || !customUsername.trim()) return;
    try {
      const result = await claimUsername(user, customUsername.trim());
      if (result.success && result.profile) {
        setProfile(result.profile);
        setIsEditingUsername(false);
      } else {
        setLobbyError(result.error || 'Could not update username');
      }
    } catch (err: unknown) {
      setLobbyError(err instanceof Error ? err.message : 'Could not update username');
    }
  };

  // 2. Create Match Room
  const handleCreateRoom = async () => {
    if (!user) return;
    setIsCreatingRoom(true);
    setLobbyError(null);

    try {
      const creator: MatchPlayer = {
        uid: user.uid,
        username: profile?.username || customUsername || `Player_${user.uid.substring(0, 5)}`,
        rating: profile?.rating || 1200,
        isReady: true,
        connected: true,
        lastPing: Date.now(),
      };

      const newMatch = await MultiplayerService.createRoom(creator);
      setMatch(newMatch);
      lastShotSeqRef.current = newMatch.lastShot?.shotSeq || 0;
    } catch (err: unknown) {
      setLobbyError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setIsCreatingRoom(false);
    }
  };

  // 3. Join Match Room
  const handleJoinRoom = async () => {
    if (!user || !roomCodeInput.trim()) return;
    setIsJoiningRoom(true);
    setLobbyError(null);

    try {
      const joiner: MatchPlayer = {
        uid: user.uid,
        username: profile?.username || customUsername || `Player_${user.uid.substring(0, 5)}`,
        rating: profile?.rating || 1200,
        isReady: true,
        connected: true,
        lastPing: Date.now(),
      };

      const joinedMatch = await MultiplayerService.joinRoom(roomCodeInput.trim(), joiner);
      if (!joinedMatch) {
        setLobbyError('Room not found or game already in progress. Check the 6-character code.');
        return;
      }

      setMatch(joinedMatch);
      lastShotSeqRef.current = joinedMatch.lastShot?.shotSeq || 0;
    } catch (err: unknown) {
      setLobbyError(err instanceof Error ? err.message : 'Failed to join room');
    } finally {
      setIsJoiningRoom(false);
    }
  };

  // 4. Subscribe to Realtime Match Updates
  useEffect(() => {
    if (!match?.id) return;

    const unsubscribe = MultiplayerService.subscribeToMatch(match.id, updatedMatch => {
      // Sync opponent live aiming / positioning telemetry
      if (updatedMatch.liveState) {
        oppLiveStateRef.current = updatedMatch.liveState;
      } else {
        oppLiveStateRef.current = null;
      }

      setMatch(prevMatch => {
        // Detect if an opponent shot was received
        if (
          updatedMatch.lastShot &&
          updatedMatch.lastShot.shotSeq > lastShotSeqRef.current
        ) {
          lastShotSeqRef.current = updatedMatch.lastShot.shotSeq;
          oppLiveStateRef.current = null;

          // If shooter is opponent, animate shot on local 3D table!
          const isLocalShooter =
            (updatedMatch.lastShot.shooter === 'player1' && user?.uid === updatedMatch.player1.uid) ||
            (updatedMatch.lastShot.shooter === 'player2' && user?.uid === updatedMatch.player2?.uid);

          if (!isLocalShooter && physicsRef.current) {
            const oppShot = updatedMatch.lastShot.params;
            setIsShooting(true);
            soundFX.playCueStrike(oppShot.power);
            physicsRef.current.strikeCueBall(oppShot);

            const checkRestInterval = setInterval(() => {
              if (physicsRef.current && !physicsRef.current.isMoving()) {
                clearInterval(checkRestInterval);
                setIsShooting(false);
                if (rendererRef.current && updatedMatch.balls) {
                  physicsRef.current.setBalls(updatedMatch.balls);
                  rendererRef.current.updateBalls(updatedMatch.balls);
                }
              }
            }, 50);
          }
        }
        return updatedMatch;
      });
    });

    return () => unsubscribe();
  }, [match?.id, user?.uid]);

  // 5. Initialize 3D Engine when match becomes in_progress
  useEffect(() => {
    if (match?.status !== 'in_progress' || !containerRef.current || rendererRef.current) return;

    const renderer = new PoolGameRenderer(containerRef.current);
    rendererRef.current = renderer;

    const initialBalls = match.balls || [];
    const physics = new BilliardsPhysicsEngine(initialBalls);
    physicsRef.current = physics;

    const rules = new EightBallRulesEngine(match.turn);
    rules.setState(match.rulesState);
    rulesRef.current = rules;

    renderer.updateBalls(physics.getBalls());

    let accumulator = 0;
    let lastTime = performance.now();
    let animId: number;

    const loop = (now: number) => {
      animId = requestAnimationFrame(loop);
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      accumulator += dt;

      let movedInThisFrame = false;
      while (accumulator >= TABLE_CONSTANTS.FIXED_TIMESTEP) {
        if (physics.isMoving()) {
          movedInThisFrame = true;
          const snapshot = physics.step(TABLE_CONSTANTS.FIXED_TIMESTEP);

          for (const ev of snapshot.events) {
            if (ev.type === 'ball_ball') soundFX.playBallHit(ev.impulse);
            else if (ev.type === 'ball_cushion') soundFX.playCushionHit(ev.impulse);
            else if (ev.type === 'ball_pocket') soundFX.playPocketDrop();
          }
        }
        accumulator -= TABLE_CONSTANTS.FIXED_TIMESTEP;
      }

      if (movedInThisFrame || physics.isMoving()) {
        renderer.updateBalls(physics.getBalls());
        renderer.updateCueStick(physics.getCueBall(), aimAngleRef.current, 0, false);
        renderer.updateTrajectory(null, false);
        renderer.updateBallInHandGuide(false);
      } else {
        const cueBall = physics.getCueBall();
        renderer.updateBalls(physics.getBalls());

        if (isMyTurnRef.current) {
          if (cueBall && !isShootingRef.current && !isBallInHandRef.current) {
            const traj = calculateAimTrajectory(cueBall, aimAngleRef.current, physics.getBalls());
            renderer.updateTrajectory(traj, true);
            renderer.updateCueStick(cueBall, aimAngleRef.current, powerRef.current, true);
            renderer.updateBallInHandGuide(false);
          } else if (isBallInHandRef.current && cueBall) {
            renderer.updateTrajectory(null, false);
            renderer.updateCueStick(cueBall, aimAngleRef.current, 0, false);
            const valid = isBallInHandPlacementValid(
              cueBall.position,
              physics.getBalls(),
              isBreakShotRef.current
            );
            renderer.updateBallInHandGuide(true, cueBall.position, valid);
          } else {
            renderer.updateTrajectory(null, false);
            renderer.updateCueStick(cueBall, aimAngleRef.current, 0, false);
            renderer.updateBallInHandGuide(false);
          }

          renderer.updateCamera(cueBall, aimAngleRef.current, isBallInHandRef.current);
        } else {
          // SPECTATOR MODE: Live Opponent Movement Synchronization!
          const oppLive = oppLiveStateRef.current;
          if (oppLive) {
            // Shortest-arc lerp for smooth opponent cue rotation
            let angleDiff = (oppLive.aimAngle - oppAimAngleRef.current + Math.PI) % (Math.PI * 2) - Math.PI;
            oppAimAngleRef.current += angleDiff * Math.min(1, dt * 14);

            // Smooth lerp for power pullback
            oppPowerRef.current += (oppLive.power - oppPowerRef.current) * Math.min(1, dt * 14);
          }

          if (isBallInHandRef.current && cueBall) {
            if (oppLive?.cueBallPos) {
              cueBall.position.x += (oppLive.cueBallPos.x - cueBall.position.x) * Math.min(1, dt * 18);
              cueBall.position.z += (oppLive.cueBallPos.z - cueBall.position.z) * Math.min(1, dt * 18);
              cueBall.height = 0;
              cueBall.state = 'active';
              renderer.updateBalls(physics.getBalls());
              renderer.updateBallInHandGuide(true, cueBall.position, true);
            }
            renderer.updateTrajectory(null, false);
            renderer.updateCueStick(cueBall, 0, 0, false);
            renderer.updateCamera(cueBall, 0, true);
          } else if (cueBall && !isShootingRef.current && oppLive) {
            const oppAngle = oppAimAngleRef.current;
            const oppPow = oppPowerRef.current;
            const oppTraj = calculateAimTrajectory(cueBall, oppAngle, physics.getBalls());
            renderer.updateTrajectory(oppTraj, true);
            renderer.updateCueStick(cueBall, oppAngle, oppPow, true);
            renderer.updateBallInHandGuide(false);
            renderer.updateCamera(cueBall, oppAngle, false);
          } else {
            renderer.updateTrajectory(null, false);
            renderer.updateCueStick(cueBall, 0, 0, false);
            renderer.updateBallInHandGuide(false);
            renderer.updateCamera(cueBall, 0, false);
          }
        }
      }
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [match?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep rules and balls in sync when remote match updates outside active shooting
  useEffect(() => {
    if (!match || !physicsRef.current || !rendererRef.current || isShooting) return;
    physicsRef.current.setBalls(match.balls);
    rendererRef.current.updateBalls(match.balls);
    if (rulesRef.current) {
      rulesRef.current.setState(match.rulesState);
    }
  }, [match, isShooting]);

  // 6. Shot Action
  const handleShoot = async () => {
    if (!isMyTurn || isShooting || !physicsRef.current || !match || !user) return;

    const shotParams: ShotParameters = {
      power,
      angle: aimAngle,
      spinX,
      spinY,
    };

    setIsShooting(true);
    soundFX.playCueStrike(power);
    physicsRef.current.strikeCueBall(shotParams);

    // Clear opponent's live aim stick immediately
    MultiplayerService.updateLiveAimState(match.id, null);

    try {
      const updatedMatch = await MultiplayerService.submitShot(match, user.uid, shotParams);
      lastShotSeqRef.current = updatedMatch.lastShot?.shotSeq || 0;
      setMatch(updatedMatch);
    } catch (err) {
      console.error('Error submitting shot:', err);
    }

    const checkRest = setInterval(() => {
      if (physicsRef.current && !physicsRef.current.isMoving()) {
        clearInterval(checkRest);
        setIsShooting(false);
      }
    }, 50);
  };

  // 7. Aim & Touch Handlers
  const moveCueBallTo = useCallback((clientX: number, clientY: number) => {
    if (!physicsRef.current || !rendererRef.current) return;
    const pt = rendererRef.current.getTableIntersection(clientX, clientY);
    if (!pt) return;

    const isBreak = rulesRef.current ? rulesRef.current.getState().isBreakShot : false;
    const clamped = clampBallInHandPosition(pt, isBreak);
    const valid = isBallInHandPlacementValid(clamped, physicsRef.current.getBalls(), isBreak);

    const cue = physicsRef.current.getCueBall();
    if (cue) {
      cue.state = 'active';
      cue.position.x = clamped.x;
      cue.position.z = clamped.z;
      cue.height = 0;
      cue.velocity = { x: 0, z: 0 };
      cue.angularVelocity = { x: 0, y: 0, z: 0 };
    }

    setIsPlacementValid(valid);
    rendererRef.current.updateBalls(physicsRef.current.getBalls());
    rendererRef.current.updateBallInHandGuide(true, clamped, valid);
    broadcastLiveAimState({ customPos: clamped });
  }, [broadcastLiveAimState]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isMyTurn || isShooting || !rendererRef.current || !physicsRef.current) return;
    pointerDownPos.current = { x: e.clientX, y: e.clientY };

    if (match?.rulesState.isBallInHand) {
      isDraggingCueBallRef.current = true;
      moveCueBallTo(e.clientX, e.clientY);
      return;
    }

    isPointerAiming.current = true;
    lastPointerX.current = e.clientX;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (match?.rulesState.isBallInHand) {
      if (isDraggingCueBallRef.current) {
        moveCueBallTo(e.clientX, e.clientY);
      }
      return;
    }

    if (!isPointerAiming.current) return;

    const deltaX = e.clientX - lastPointerX.current;
    lastPointerX.current = e.clientX;
    const sensitivity = 0.0024;
    setAimAngle(prev => {
      const next = prev + deltaX * sensitivity;
      broadcastLiveAimState({ customAim: next });
      return next;
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingCueBallRef.current = false;
    isPointerAiming.current = false;

    // Tap-to-aim: snap aim toward clicked object ball
    const dragDist = Math.hypot(e.clientX - pointerDownPos.current.x, e.clientY - pointerDownPos.current.y);
    if (dragDist < 6 && rendererRef.current && physicsRef.current) {
      const pt = rendererRef.current.getTableIntersection(e.clientX, e.clientY);
      const cue = physicsRef.current.getCueBall();
      if (pt && cue) {
        const balls = physicsRef.current.getBalls();
        let closestBall: BallPhysicsState | null = null;
        let minDist = 0.09;
        for (const b of balls) {
          if (b.id === 0 || b.state === 'pocketed' || b.state === 'falling') continue;
          const d = Math.hypot(b.position.x - pt.x, b.position.z - pt.z);
          if (d < minDist) {
            minDist = d;
            closestBall = b;
          }
        }
        if (closestBall) {
          const dx = closestBall.position.x - cue.position.x;
          const dz = closestBall.position.z - cue.position.z;
          const newAngle = Math.atan2(dz, dx);
          setAimAngle(newAngle);
          broadcastLiveAimState({ customAim: newAngle, immediate: true });
        }
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!isMyTurn || isShooting) return;
    e.preventDefault();
    setAimAngle(a => {
      const next = a + e.deltaY * 0.0008;
      broadcastLiveAimState({ customAim: next });
      return next;
    });
  };

  const handleConfirmPlacement = async () => {
    if (!isPlacementValid || !match || !physicsRef.current) return;
    const cueBall = physicsRef.current.getCueBall();
    if (!cueBall) return;

    // 1. Immediately reset cue ball physics velocity & active state
    cueBall.state = 'active';
    cueBall.velocity = { x: 0, z: 0 };
    cueBall.angularVelocity = { x: 0, y: 0, z: 0 };
    cueBall.height = 0;

    // 2. Clear ball in hand in rules engine
    if (rulesRef.current) {
      rulesRef.current.clearBallInHand();
    }

    // 3. Update React match state immediately so UI transitions to shooting mode
    setMatch(prev => {
      if (!prev) return null;
      return {
        ...prev,
        rulesState: {
          ...prev.rulesState,
          isBallInHand: false,
          status: prev.rulesState.status === 'game_over' ? 'game_over' : 'in_turn',
        },
        balls: physicsRef.current ? physicsRef.current.getBalls() : prev.balls,
      };
    });

    // 4. Update 3D renderer and play cue ball placement audio
    if (rendererRef.current) {
      rendererRef.current.updateBallInHandGuide(false);
      rendererRef.current.updateBalls(physicsRef.current.getBalls());
    }
    soundFX.playCushionHit(0.25);

    // 5. Persist to Firestore to notify opponent and update server match document
    try {
      await MultiplayerService.confirmCueBallPlacement(match.id, {
        x: cueBall.position.x,
        z: cueBall.position.z,
      });
    } catch (err) {
      console.error('Failed to confirm placement in Firestore:', err);
    }
  };

  // 8. Surrender/Forfeit Match
  const handleSurrender = async () => {
    if (!match || !user) return;
    const confirmSurrender = window.confirm('Are you sure you want to forfeit this match?');
    if (!confirmSurrender) return;

    await MultiplayerService.forfeitMatch(match.id, user.uid);
  };

  const toggleCamera = () => {
    const nextMode = cameraMode === 'player' ? 'overhead' : 'player';
    setCameraMode(nextMode);
    if (rendererRef.current) {
      rendererRef.current.cameraMode = nextMode;
    }
  };

  // Helper to copy room link or code
  const handleCopyLink = () => {
    if (!match) return;
    const url = `${window.location.origin}/online?room=${match.roomCode}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    if (!match) return;
    navigator.clipboard.writeText(match.roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // ==========================================
  // RENDER: LOBBY & ROOM CREATION SCREEN
  // ==========================================
  if (!match || match.status === 'waiting') {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col text-white selection:bg-emerald-500 selection:text-black">
        <NavigationHeader />

        <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 sm:py-16 flex flex-col items-center justify-center">
          {/* Header pill */}
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold mb-6 shadow-inner">
            <Users className="w-4 h-4" />
            <span>Real-time Online 2-Player Match</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-3 text-center">
            Play with a Friend
          </h1>
          <p className="text-neutral-400 text-sm sm:text-base text-center max-w-md mb-8 leading-relaxed">
            Create a private room to generate a 6-character code, or join your friend’s match using their room code.
          </p>

          {/* Player Profile Quick Card */}
          <div className="w-full bg-neutral-900/80 border border-neutral-800 rounded-3xl p-4 sm:p-5 mb-8 backdrop-blur-md shadow-xl flex items-center justify-between">
            <div className="flex items-center space-x-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white font-black text-sm shadow-md">
                <User className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-extrabold text-white">
                    {profile?.username || customUsername || 'Loading...'}
                  </span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-mono font-bold px-1.5 py-0.5 rounded">
                    Rating: {profile?.rating || 1200}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Guest Profile • Auto-saved
                </p>
              </div>
            </div>

            {isEditingUsername ? (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={customUsername}
                  onChange={e => setCustomUsername(e.target.value)}
                  maxLength={15}
                  className="bg-neutral-950 border border-neutral-700 text-white text-xs px-2.5 py-1.5 rounded-xl font-medium w-28 sm:w-36 focus:outline-none focus:border-emerald-500"
                  placeholder="Username"
                />
                <button
                  onClick={handleSaveUsername}
                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition"
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditingUsername(true)}
                className="text-xs text-neutral-400 hover:text-white underline underline-offset-4 font-medium transition"
              >
                Change Name
              </button>
            )}
          </div>

          {/* Lobby Error Alert */}
          {lobbyError && (
            <div className="w-full p-4 mb-6 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2.5 text-left">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{lobbyError}</span>
            </div>
          )}

          {/* WAITING SCREEN (When Creator Has Room Open) */}
          {match && match.status === 'waiting' ? (
            <div className="w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 text-center shadow-2xl animate-in fade-in duration-200">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto mb-4">
                <Share2 className="w-8 h-8 animate-pulse" />
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-white">Room Created!</h2>
              <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                Share this 6-character room code with your friend
              </p>

              {/* Large Room Code Display */}
              <div className="my-6 p-4 rounded-2xl bg-neutral-950 border-2 border-dashed border-neutral-700 flex items-center justify-center space-x-4">
                <span className="font-mono text-3xl sm:text-4xl font-black tracking-widest text-emerald-400 select-all">
                  {match.roomCode}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition"
                  title="Copy Room Code"
                >
                  {copiedCode ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                <button
                  onClick={handleCopyLink}
                  className="w-full sm:flex-1 py-3.5 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-xl shadow-emerald-600/20 transition flex items-center justify-center space-x-2"
                >
                  {copiedLink ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                  <span>{copiedLink ? 'Link Copied to Clipboard!' : 'Copy Shareable Link'}</span>
                </button>

                <button
                  onClick={() => setMatch(null)}
                  className="w-full sm:w-auto py-3.5 px-5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white font-bold text-sm transition"
                >
                  Cancel Room
                </button>
              </div>

              {/* Waiting Indicator */}
              <div className="mt-8 flex items-center justify-center space-x-2 text-xs text-neutral-400 font-medium">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Waiting for your friend to enter code...</span>
              </div>
            </div>
          ) : (
            /* CREATE OR JOIN SELECTION GRID */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              {/* Option A: Create Private Room */}
              <div className="p-6 rounded-3xl bg-neutral-900/90 border border-neutral-800 flex flex-col justify-between text-left shadow-xl hover:border-neutral-700 transition">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-4">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-extrabold text-white">Create Room</h3>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    Host a new match. You’ll receive a private room code to send to your friend via WhatsApp, Discord, or text.
                  </p>
                </div>

                <button
                  onClick={handleCreateRoom}
                  disabled={isCreatingRoom}
                  className="mt-6 w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm shadow-xl shadow-emerald-600/20 transition flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {isCreatingRoom ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Create Private Room</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {/* Option B: Join Existing Room */}
              <div className="p-6 rounded-3xl bg-neutral-900/90 border border-neutral-800 flex flex-col justify-between text-left shadow-xl hover:border-neutral-700 transition">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mb-4">
                    <Users className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-extrabold text-white">Join Friend’s Room</h3>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    Enter the 6-character room code your friend shared with you to jump straight into the arena.
                  </p>

                  <div className="mt-4">
                    <input
                      type="text"
                      value={roomCodeInput}
                      onChange={e => setRoomCodeInput(e.target.value.toUpperCase().slice(0, 6))}
                      placeholder="e.g. K9W4MZ"
                      className="w-full bg-neutral-950 border border-neutral-700 focus:border-cyan-400 text-center font-mono text-xl font-bold tracking-widest text-white px-3 py-2.5 rounded-2xl focus:outline-none uppercase placeholder:text-neutral-600 placeholder:normal-case placeholder:font-sans placeholder:text-sm"
                    />
                  </div>
                </div>

                <button
                  onClick={handleJoinRoom}
                  disabled={isJoiningRoom || roomCodeInput.trim().length !== 6}
                  className="mt-6 w-full py-3.5 px-4 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold text-sm shadow-xl shadow-cyan-600/20 transition flex items-center justify-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isJoiningRoom ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Join Match</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // ==========================================
  // RENDER: ACTIVE 3D MULTIPLAYER ARENA
  // ==========================================
  const remainingBallIds = match.balls
    ? match.balls.filter(b => b.state !== 'pocketed' && b.id !== 0).map(b => b.id)
    : [];

  const opponentName = isPlayer1
    ? match.player2?.username || 'Opponent'
    : match.player1.username;

  return (
    <div className="fixed inset-0 w-full h-[100dvh] overflow-hidden bg-neutral-950 flex flex-col select-none">
      {/* 3D WebGL Canvas Container */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        className={`relative flex-1 w-full h-full touch-none select-none ${
          isMyTurn && match.rulesState.isBallInHand
            ? 'cursor-move'
            : isMyTurn
            ? 'cursor-grab active:cursor-grabbing'
            : 'cursor-default'
        }`}
      />

      {/* Real-time Multiplayer Game HUD */}
      <GameHUD
        player1Name={match.player1.username}
        player2Name={match.player2?.username || 'Player 2'}
        player1Rating={match.player1.rating}
        player2Rating={match.player2?.rating}
        currentTurn={match.turn}
        groups={match.rulesState.groups}
        tableOpen={match.rulesState.tableOpen}
        remainingBalls={remainingBallIds}
        isBallInHand={match.rulesState.isBallInHand}
        lastFoul={match.rulesState.lastFoul}
        onToggleCamera={toggleCamera}
        cameraMode={cameraMode}
        isMuted={isMuted}
        onToggleMute={() => {
          setIsMuted(!isMuted);
          soundFX.setMuted(!isMuted);
        }}
        onSurrender={handleSurrender}
        onExit={() => setMatch(null)}
      />

      {/* Ball-in-Hand Placement Controls (When it is local player's turn) */}
      {isMyTurn && !isShooting && match.rulesState.isBallInHand && (
        <div
          className="absolute inset-x-0 pointer-events-none flex justify-center px-2 sm:px-6 z-30"
          style={{
            bottom: 'max(1rem, calc(env(safe-area-inset-bottom, 0px) + 0.75rem))',
          }}
        >
          <div className="pointer-events-auto bg-neutral-900/95 backdrop-blur-md border border-neutral-700/80 p-2 sm:p-3 rounded-2xl sm:rounded-3xl shadow-2xl flex items-center justify-between max-w-md w-full gap-2">
            <div className="flex items-center space-x-2 text-left min-w-0">
              <div
                className={`p-1.5 sm:p-2 rounded-xl shrink-0 ${
                  isPlacementValid
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                }`}
              >
                <Move className="w-4 h-4" />
              </div>
              <div className="truncate">
                <h4 className="text-xs sm:text-sm font-bold text-white flex items-center space-x-1.5 truncate">
                  <span>Ball in Hand</span>
                  {match.rulesState.isBreakShot && (
                    <span className="text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Kitchen
                    </span>
                  )}
                </h4>
                <p className={`text-[10px] sm:text-xs truncate ${isPlacementValid ? 'text-neutral-400' : 'text-rose-400 font-medium'}`}>
                  {isPlacementValid
                    ? 'Drag or tap table to place cue ball'
                    : 'Overlapping ball or cushion! Reposition.'}
                </p>
              </div>
            </div>

            <button
              onClick={handleConfirmPlacement}
              disabled={!isPlacementValid}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs tracking-wider transition shadow-lg flex items-center space-x-1.5 shrink-0 ${
                isPlacementValid
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 active:scale-95 cursor-pointer shadow-emerald-500/20'
                  : 'bg-neutral-800 text-neutral-500 border border-neutral-700 cursor-not-allowed opacity-60'
              }`}
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Confirm</span>
            </button>
          </div>
        </div>
      )}

      {/* Standard Cue Aiming & Power Controls (When it is local player's turn) */}
      {isMyTurn && !isShooting && !match.rulesState.isBallInHand && (
        <div
          className="absolute inset-x-0 pointer-events-none flex justify-between items-end px-3 sm:px-6 z-20"
          style={{
            bottom: 'max(1rem, calc(env(safe-area-inset-bottom, 0px) + 0.75rem))',
          }}
        >
          <div className="pointer-events-auto">
            <SpinControl
              spinX={spinX}
              spinY={spinY}
              onChange={(x, y) => {
                setSpinX(x);
                setSpinY(y);
                broadcastLiveAimState({ immediate: true });
              }}
            />
          </div>

          <div className="pointer-events-auto bg-neutral-900/90 backdrop-blur-md border border-neutral-800 p-2 sm:p-2.5 rounded-2xl shadow-2xl">
            <PowerMeter
              power={power}
              onChange={val => {
                setPower(val);
                broadcastLiveAimState({ customPower: val });
              }}
              onRelease={handleShoot}
              disabled={isShooting}
            />
          </div>
        </div>
      )}

      {/* Waiting for Opponent Turn Indicator */}
      {!isMyTurn && match.status === 'in_progress' && (
        <div
          className="absolute inset-x-0 flex justify-center pointer-events-none z-20"
          style={{
            bottom: 'max(2rem, calc(env(safe-area-inset-bottom, 0px) + 1.5rem))',
          }}
        >
          <div className="px-5 py-2.5 rounded-full bg-neutral-900/90 backdrop-blur-md border border-neutral-700/80 text-neutral-300 font-semibold text-xs tracking-wider shadow-2xl flex items-center space-x-2.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            <span>
              {match.rulesState.isBallInHand
                ? `${opponentName} is positioning cue ball...`
                : match.liveState && match.liveState.power > 0.05
                ? `${opponentName} is aiming... (Power: ${Math.round(match.liveState.power * 100)}%)`
                : `${opponentName} is lining up shot...`}
            </span>
          </div>
        </div>
      )}

      {/* Match Result Modal */}
      {match.status === 'completed' && (
        <MatchResultModal
          winnerName={
            match.winnerUid === user?.uid
              ? profile?.username || 'You'
              : opponentName
          }
          isWinner={match.winnerUid === user?.uid}
          reason="8-Ball Pocketed"
          ratingDelta={match.ratingDelta}
          newRating={profile?.rating}
          onRematch={handleCreateRoom}
        />
      )}
    </div>
  );
}

export default function OnlineMultiplayerPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        </div>
      }
    >
      <OnlineMultiplayerContent />
    </Suspense>
  );
}
