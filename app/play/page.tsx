'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PoolGameRenderer } from '../../game/scene';
import { BilliardsPhysicsEngine } from '../../physics/engine';
import {
  createStandard8BallRack,
  isBallInHandPlacementValid,
  clampBallInHandPosition,
  findClearCueBallSpot,
} from '../../physics/setup';
import { calculateAimTrajectory } from '../../physics/trajectory';
import { EightBallRulesEngine } from '../../rules/engine';
import { BilliardsAIEngine } from '../../ai/engine';
import { AIDifficulty } from '../../ai/types';
import { SpinControl } from '../../components/SpinControl';
import { PowerMeter } from '../../components/PowerMeter';
import { GameHUD } from '../../components/GameHUD';
import { MatchResultModal } from '../../components/MatchResultModal';
import { soundFX } from '../../game/sound';
import { NavigationHeader } from '../../components/NavigationHeader';
import { initAnonymousAuth, getPlayerProfile } from '../../firebase/auth';
import { PlayerProfile } from '../../leaderboard/types';
import { TABLE_CONSTANTS } from '../../physics/constants';
import { CollisionEvent } from '../../physics/types';
import { RulesState } from '../../rules/types';
import { Check, Move } from 'lucide-react';

export default function SinglePlayerGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<PoolGameRenderer | null>(null);
  const physicsRef = useRef<BilliardsPhysicsEngine | null>(null);
  const rulesRef = useRef<EightBallRulesEngine>(new EightBallRulesEngine('player1'));
  const aiRef = useRef<BilliardsAIEngine>(new BilliardsAIEngine('medium'));
  const shotEventsRef = useRef<CollisionEvent[]>([]);

  // Game UI State
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [difficulty, setDifficulty] = useState<AIDifficulty>('medium');
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [rulesState, setRulesState] = useState<RulesState>(() => rulesRef.current.getState());
  const [aimAngle, setAimAngle] = useState<number>(0);
  const [power, setPower] = useState<number>(0.5);
  const aimAngleRef = useRef<number>(0);
  const powerRef = useRef<number>(0.5);

  const updateAimAngle = useCallback((valOrFn: number | ((prev: number) => number)) => {
    setAimAngle(prev => {
      const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
      aimAngleRef.current = next;
      return next;
    });
  }, []);

  const updatePower = useCallback((valOrFn: number | ((prev: number) => number)) => {
    setPower(prev => {
      const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
      powerRef.current = next;
      return next;
    });
  }, []);
  const [spinX, setSpinX] = useState<number>(0);
  const [spinY, setSpinY] = useState<number>(0);
  const [isShooting, setIsShooting] = useState<boolean>(false);
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const [cameraMode, setCameraMode] = useState<'player' | 'overhead'>('player');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isPlacementValid, setIsPlacementValid] = useState<boolean>(true);
  const isDraggingCueBallRef = useRef<boolean>(false);

  // Match Result State
  const [matchResult, setMatchResult] = useState<{
    winner: string;
    isWinner: boolean;
    reason?: string;
    ratingDelta?: number;
    newRating?: number;
  } | null>(null);

  // Initialize Auth & Profile
  useEffect(() => {
    initAnonymousAuth().then(user => {
      if (user) {
        getPlayerProfile(user.uid).then(p => {
          if (p) setProfile(p);
        });
      }
    });
  }, []);

  // Initialize Game & 3D Scene
  useEffect(() => {
    if (!containerRef.current) return;

    const renderer = new PoolGameRenderer(containerRef.current);
    rendererRef.current = renderer;

    const initialBalls = createStandard8BallRack();
    const physics = new BilliardsPhysicsEngine(initialBalls);
    physicsRef.current = physics;

    renderer.updateBalls(physics.getBalls());

    // Main animation & physics loop
    let animId: number;
    let lastTime = performance.now();
    let accumulator = 0;

    const loop = () => {
      if (physicsRef.current && rendererRef.current) {
        const physics = physicsRef.current;
        const renderer = rendererRef.current;
        const rules = rulesRef.current;
        const currentAimAngle = aimAngleRef.current;
        const currentPower = powerRef.current;

        const now = performance.now();
        const dt = Math.min((now - lastTime) / 1000, 0.05); // cap at 50ms to prevent spiral of death
        lastTime = now;
        accumulator += dt;

        let movedInThisFrame = false;
        while (accumulator >= TABLE_CONSTANTS.FIXED_TIMESTEP) {
          if (physics.isMoving()) {
            movedInThisFrame = true;
            const snapshot = physics.step(TABLE_CONSTANTS.FIXED_TIMESTEP);

            // Audio triggers
            for (const ev of snapshot.events) {
              if (ev.type === 'ball_ball') soundFX.playBallHit(ev.impulse);
              else if (ev.type === 'ball_cushion') soundFX.playCushionHit(ev.impulse);
              else if (ev.type === 'ball_pocket') soundFX.playPocketDrop();
            }

            shotEventsRef.current.push(...snapshot.events);
          }
          accumulator -= TABLE_CONSTANTS.FIXED_TIMESTEP;
        }

        if (movedInThisFrame || physics.isMoving()) {
          renderer.updateBalls(physics.getBalls());
          renderer.updateCueStick(physics.getCueBall(), currentAimAngle, 0, false);
          renderer.updateTrajectory(null, false);
          renderer.updateBallInHandGuide(false);
        } else {
          // Stationary state: Update cue stick & trajectory line
          const cueBall = physics.getCueBall();
          const rulesState = rules.getState();
          const isGameOver = rulesState.status === 'game_over';
          const isHumanTurn = rulesState.currentTurn === 'player1';

          renderer.updateBalls(physics.getBalls());

          if (cueBall && !isGameOver && isHumanTurn && !rulesState.isBallInHand) {
            const traj = calculateAimTrajectory(cueBall, currentAimAngle, physics.getBalls());
            renderer.updateTrajectory(traj, true);
            renderer.updateCueStick(cueBall, currentAimAngle, currentPower, true);
            renderer.updateBallInHandGuide(false);
          } else if (rulesState.isBallInHand && isHumanTurn) {
            renderer.updateTrajectory(null, false);
            renderer.updateCueStick(cueBall, currentAimAngle, 0, false);
            if (cueBall) {
              const valid = isBallInHandPlacementValid(
                cueBall.position,
                physics.getBalls(),
                rulesState.isBreakShot
              );
              renderer.updateBallInHandGuide(true, cueBall.position, valid);
            }
          } else {
            renderer.updateTrajectory(null, false);
            renderer.updateCueStick(cueBall, currentAimAngle, 0, false);
            renderer.updateBallInHandGuide(false);
          }

          renderer.updateCamera(cueBall, currentAimAngle, rulesState.isBallInHand && isHumanTurn);
        }
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Execute AI Turn
  const triggerAiTurn = useCallback(() => {
    if (!physicsRef.current || !rulesRef.current) return;
    setIsAiThinking(true);

    setTimeout(() => {
      const physics = physicsRef.current!;
      const rules = rulesRef.current;
      const ai = aiRef.current;

      if (rules.getState().isBallInHand) {
        const placement = ai.chooseBallInHandPlacement(
          physics.getBalls(),
          rules,
          'player2'
        );
        const cue = physics.getCueBall();
        if (cue) {
          cue.state = 'active';
          cue.position.x = placement.x;
          cue.position.z = placement.z;
          cue.height = 0;
          cue.velocity = { x: 0, z: 0 };
          cue.angularVelocity = { x: 0, y: 0, z: 0 };
        }
        rules.clearBallInHand();
        setRulesState({ ...rules.getState() });
        rendererRef.current?.updateBalls(physics.getBalls());
      }

      const decision = ai.planShot(physics.getBalls(), rules, 'player2');
      if (!decision) {
        setIsAiThinking(false);
        return;
      }

      updateAimAngle(decision.shotParams.angle);

      setTimeout(() => {
        const previouslyPocketed = new Set(
          physics.getBalls().filter(b => b.state === 'pocketed').map(b => b.id)
        );

        shotEventsRef.current = [];
        soundFX.playCueStrike(decision.shotParams.power);
        physics.strikeCueBall(decision.shotParams);

        const checkAiRest = setInterval(() => {
          if (!physics.isMoving()) {
            clearInterval(checkAiRest);
            setIsAiThinking(false);

            const newlyPocketed: number[] = [];
            for (const b of physics.getBalls()) {
              if (b.state === 'pocketed' && !previouslyPocketed.has(b.id)) {
                newlyPocketed.push(b.id);
              }
            }

            const remainingOnTable = physics
              .getBalls()
              .filter(b => b.state !== 'pocketed')
              .map(b => b.id);

            const recordedEvents = [...shotEventsRef.current];
            const validation = rules.evaluateShot(recordedEvents, newlyPocketed, remainingOnTable);
            setRulesState({ ...rules.getState() });

            if (validation.fouls.isScratch) {
              const cue = physics.getCueBall();
              if (cue) {
                cue.state = 'active';
                const clearSpot = findClearCueBallSpot(
                  { x: -TABLE_CONSTANTS.TABLE_LENGTH * 0.25, z: 0 },
                  physics.getBalls(),
                  rules.getState().isBreakShot
                );
                cue.position.x = clearSpot.x;
                cue.position.z = clearSpot.z;
                cue.height = 0;
                cue.velocity = { x: 0, z: 0 };
                cue.angularVelocity = { x: 0, y: 0, z: 0 };
              }
            }

            if (validation.ballInHand && validation.nextTurn === 'player1') {
              setIsPlacementValid(true);
            }

            if (validation.winner) {
              const isWin = validation.winner === 'player1';
              setMatchResult({
                winner: isWin ? 'You' : `AI (${difficulty.toUpperCase()})`,
                isWinner: isWin,
                reason: validation.gameOverReason,
              });
              return;
            }

            if (validation.nextTurn === 'player2') {
              triggerAiTurn();
            }
          }
        }, 100);
      }, 700);
    }, 1000);
  }, [difficulty, profile]);

  // Execute human shot
  const handleShoot = useCallback(() => {
    if (!physicsRef.current || !rulesRef.current || isShooting) return;

    const physics = physicsRef.current;
    const rules = rulesRef.current;
    const rulesState = rules.getState();

    if (rulesState.currentTurn !== 'player1' || rulesState.status === 'game_over') return;

    const previouslyPocketed = new Set(
      physics.getBalls().filter(b => b.state === 'pocketed').map(b => b.id)
    );

    setIsShooting(true);
    shotEventsRef.current = [];
    soundFX.playCueStrike(power);
    physics.strikeCueBall({ power, angle: aimAngle, spinX, spinY });

    const checkRestInterval = setInterval(() => {
      if (!physics.isMoving()) {
        clearInterval(checkRestInterval);
        setIsShooting(false);

        const newlyPocketed: number[] = [];
        for (const b of physics.getBalls()) {
          if (b.state === 'pocketed' && !previouslyPocketed.has(b.id)) {
            newlyPocketed.push(b.id);
          }
        }

        const remainingOnTable = physics
          .getBalls()
          .filter(b => b.state !== 'pocketed')
          .map(b => b.id);

        const recordedEvents = [...shotEventsRef.current];
        const validation = rules.evaluateShot(recordedEvents, newlyPocketed, remainingOnTable);
        setRulesState({ ...rules.getState() });

        if (validation.fouls.isScratch) {
          const cue = physics.getCueBall();
          if (cue) {
            cue.state = 'active';
            const clearSpot = findClearCueBallSpot(
              { x: -TABLE_CONSTANTS.TABLE_LENGTH * 0.25, z: 0 },
              physics.getBalls(),
              rules.getState().isBreakShot
            );
            cue.position.x = clearSpot.x;
            cue.position.z = clearSpot.z;
            cue.height = 0;
            cue.velocity = { x: 0, z: 0 };
            cue.angularVelocity = { x: 0, y: 0, z: 0 };
          }
        }

        if (validation.ballInHand && validation.nextTurn === 'player1') {
          setIsPlacementValid(true);
        }

        if (validation.winner) {
          const isWin = validation.winner === 'player1';
          setMatchResult({
            winner: isWin ? 'You' : `AI (${difficulty.toUpperCase()})`,
            isWinner: isWin,
            reason: validation.gameOverReason,
          });
          return;
        }

        if (validation.nextTurn === 'player2') {
          triggerAiTurn();
        }
      }
    }, 100);
  }, [aimAngle, power, spinX, spinY, isShooting, profile, difficulty, triggerAiTurn]);

  // Ball-in-Hand Interactive Placement Logic
  const moveCueBallTo = useCallback((clientX: number, clientY: number) => {
    if (!physicsRef.current || !rendererRef.current) return;
    const pt = rendererRef.current.getTableIntersection(clientX, clientY);
    if (!pt) return;

    const isBreak = rulesRef.current.getState().isBreakShot;
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
  }, []);

  const handleConfirmPlacement = useCallback(() => {
    const rules = rulesRef.current;
    const physics = physicsRef.current;
    if (!rules || !physics || !rules.getState().isBallInHand) return;

    const cue = physics.getCueBall();
    if (!cue) return;

    const isBreak = rules.getState().isBreakShot;
    const valid = isBallInHandPlacementValid(cue.position, physics.getBalls(), isBreak);
    if (!valid) return;

    cue.state = 'active';
    cue.velocity = { x: 0, z: 0 };
    cue.angularVelocity = { x: 0, y: 0, z: 0 };
    rules.clearBallInHand();
    setRulesState({ ...rules.getState() });

    if (rendererRef.current) {
      rendererRef.current.updateBallInHandGuide(false);
    }
    soundFX.playCushionHit(0.25);
  }, []);

  // Mouse & Touch Drag Aiming / Ball-in-Hand Controls
  const isPointerAiming = useRef(false);
  const lastPointerX = useRef(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    const isBallInHandActive = rulesState.isBallInHand && rulesState.currentTurn === 'player1';
    if (isBallInHandActive) {
      isDraggingCueBallRef.current = true;
      moveCueBallTo(e.clientX, e.clientY);
      return;
    }

    if ((e.target as HTMLElement).tagName === 'CANVAS') {
      isPointerAiming.current = true;
      lastPointerX.current = e.clientX;
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const isBallInHandActive = rulesState.isBallInHand && rulesState.currentTurn === 'player1';
    if (isBallInHandActive) {
      if (isDraggingCueBallRef.current) {
        moveCueBallTo(e.clientX, e.clientY);
      }
      return;
    }

    if (!isPointerAiming.current) return;
    const deltaX = e.clientX - lastPointerX.current;
    lastPointerX.current = e.clientX;
    const sensitivity = 0.005;
    updateAimAngle(prev => prev + deltaX * sensitivity);
  };

  const handlePointerUp = () => {
    isDraggingCueBallRef.current = false;
    isPointerAiming.current = false;
  };

  // Keyboard controls & Mouse wheel power
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

      const currentRulesState = rulesRef.current.getState();
      if (currentRulesState.isBallInHand && currentRulesState.currentTurn === 'player1') {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          handleConfirmPlacement();
          return;
        }
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleShoot();
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        updatePower(p => Math.min(1.0, +(p + 0.05).toFixed(2)));
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        updatePower(p => Math.max(0.05, +(p - 0.05).toFixed(2)));
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        updateAimAngle(a => a - 0.02);
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        updateAimAngle(a => a + 0.02);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleShoot, updatePower, updateAimAngle, handleConfirmPlacement]);

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY < 0 ? 0.04 : -0.04;
    updatePower(p => Math.max(0.05, Math.min(1.0, +(p + delta).toFixed(2))));
  };

  const startNewMatch = (diff: AIDifficulty) => {
    setDifficulty(diff);
    aiRef.current.setDifficulty(diff);
    rulesRef.current = new EightBallRulesEngine('player1');
    setRulesState(rulesRef.current.getState());

    if (physicsRef.current && rendererRef.current) {
      const balls = createStandard8BallRack();
      physicsRef.current.setBalls(balls);
      rendererRef.current.updateBalls(balls);
      rendererRef.current.updateBallInHandGuide(false);
    }
    setMatchResult(null);
    setGameStarted(true);
    updateAimAngle(0);
  };

  const toggleCamera = () => {
    const nextMode = cameraMode === 'player' ? 'overhead' : 'player';
    setCameraMode(nextMode);
    if (rendererRef.current) {
      rendererRef.current.cameraMode = nextMode;
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    soundFX.setMuted(!isMuted);
  };

  const remainingBallIds = physicsRef.current
    ? physicsRef.current.getBalls().filter(b => b.state !== 'pocketed').map(b => b.id)
    : [];

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-neutral-950 flex flex-col">
      <NavigationHeader />

      {!gameStarted && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center">
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Single Player</h1>
            <p className="text-neutral-400 text-sm mt-1">Select AI Bot difficulty level</p>

            <div className="grid grid-cols-2 gap-3 my-6">
              {(['easy', 'medium', 'hard', 'expert'] as AIDifficulty[]).map(d => (
                <button
                  key={d}
                  onClick={() => startNewMatch(d)}
                  className="py-4 px-3 rounded-2xl bg-neutral-800/80 hover:bg-emerald-600 border border-neutral-700 hover:border-emerald-400 transition flex flex-col items-center group shadow-md"
                >
                  <span className="text-sm font-bold text-white uppercase tracking-wider group-hover:scale-105 transition-transform">
                    {d}
                  </span>
                  <span className="text-[11px] text-neutral-400 group-hover:text-emerald-100 mt-1 capitalize">
                    {d === 'easy' && 'Casual Aim'}
                    {d === 'medium' && 'Balanced Shot'}
                    {d === 'hard' && 'Positional Play'}
                    {d === 'expert' && 'Tournament Master'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        className={`relative flex-1 w-full h-full touch-none select-none ${
          rulesState.isBallInHand && rulesState.currentTurn === 'player1'
            ? 'cursor-move'
            : 'cursor-grab active:cursor-grabbing'
        }`}
      />

      {gameStarted && (
        <GameHUD
          player1Name={profile?.username || 'You'}
          player2Name={`AI (${difficulty.toUpperCase()})`}
          currentTurn={rulesState.currentTurn}
          groups={rulesState.groups}
          tableOpen={rulesState.tableOpen}
          remainingBalls={remainingBallIds}
          isBallInHand={rulesState.isBallInHand}
          lastFoul={rulesState.lastFoul}
          onToggleCamera={toggleCamera}
          cameraMode={cameraMode}
          isMuted={isMuted}
          onToggleMute={toggleMute}
        />
      )}

      {/* Ball-in-Hand Placement Action Controls */}
      {gameStarted && rulesState.currentTurn === 'player1' && !isShooting && rulesState.isBallInHand && (
        <div className="absolute bottom-6 inset-x-0 pointer-events-none flex justify-center px-4 sm:px-8 z-30">
          <div className="pointer-events-auto bg-neutral-900/95 backdrop-blur-md border border-neutral-700/80 p-4 rounded-3xl shadow-2xl flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-6 max-w-lg w-full justify-between">
            <div className="flex items-center space-x-3 text-left">
              <div
                className={`p-2.5 rounded-2xl ${
                  isPlacementValid
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                }`}
              >
                <Move className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white flex items-center space-x-1.5">
                  <span>Ball in Hand</span>
                  {rulesState.isBreakShot && (
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Behind Head String
                    </span>
                  )}
                </h4>
                <p className={`text-xs mt-0.5 ${isPlacementValid ? 'text-neutral-400' : 'text-rose-400 font-medium'}`}>
                  {isPlacementValid
                    ? 'Click or drag anywhere on table to position cue ball'
                    : 'Overlapping another ball or cushion! Reposition cue ball.'}
                </p>
              </div>
            </div>

            <button
              onClick={handleConfirmPlacement}
              disabled={!isPlacementValid}
              className={`px-5 py-2.5 rounded-2xl font-bold text-xs tracking-wider transition shadow-lg flex items-center space-x-2 shrink-0 ${
                isPlacementValid
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 hover:scale-105 active:scale-95 cursor-pointer shadow-emerald-500/20'
                  : 'bg-neutral-800 text-neutral-500 border border-neutral-700 cursor-not-allowed opacity-60'
              }`}
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Confirm Spot</span>
            </button>
          </div>
        </div>
      )}

      {/* Standard Cue Aiming & Power Controls */}
      {gameStarted && rulesState.currentTurn === 'player1' && !isShooting && !rulesState.isBallInHand && (
        <div className="absolute bottom-4 inset-x-0 pointer-events-none flex justify-between items-end px-4 sm:px-8 z-20">
          <div className="pointer-events-auto bg-neutral-900/85 backdrop-blur-md border border-neutral-800 p-3 rounded-2xl shadow-2xl">
            <SpinControl
              spinX={spinX}
              spinY={spinY}
              onChange={(x, y) => {
                setSpinX(x);
                setSpinY(y);
              }}
            />
          </div>

          <div className="pointer-events-auto flex items-center space-x-2 bg-neutral-900/85 backdrop-blur-md border border-neutral-800 px-4 py-2 rounded-2xl shadow-2xl">
            <button
              onClick={() => updateAimAngle(a => a - 0.02)}
              className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs"
            >
              ◀ Fine
            </button>
            <span className="text-xs text-neutral-300 font-mono">
              {Math.round(((aimAngle * 180) / Math.PI) % 360)}°
            </span>
            <button
              onClick={() => updateAimAngle(a => a + 0.02)}
              className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs"
            >
              Fine ▶
            </button>
          </div>

          <div className="pointer-events-auto bg-neutral-900/85 backdrop-blur-md border border-neutral-800 p-3 rounded-2xl shadow-2xl">
            <PowerMeter
              power={power}
              onChange={updatePower}
              onRelease={handleShoot}
              disabled={isShooting || isAiThinking}
            />
          </div>
        </div>
      )}

      {isAiThinking && (
        <div className="absolute bottom-12 inset-x-0 flex justify-center pointer-events-none z-20">
          <div className="px-5 py-2 rounded-full bg-neutral-900/90 border border-neutral-700 text-emerald-400 font-semibold text-xs tracking-wider shadow-2xl flex items-center space-x-2 animate-pulse">
            <span>AI Bot is planning shot...</span>
          </div>
        </div>
      )}

      {matchResult && (
        <MatchResultModal
          winnerName={matchResult.winner}
          isWinner={matchResult.isWinner}
          reason={matchResult.reason}
          ratingDelta={matchResult.ratingDelta}
          newRating={matchResult.newRating}
          onRematch={() => startNewMatch(difficulty)}
        />
      )}
    </div>
  );
}
