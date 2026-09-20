'use client';

import React from 'react';
import Link from 'next/link';
import { PlayerId, BallGroup } from '../rules/types';
import { BALL_COLORS } from '../game/textures';
import { Camera, Volume2, VolumeX, ShieldAlert, Flag, Home } from 'lucide-react';

interface GameHUDProps {
  player1Name: string;
  player2Name: string;
  player1Rating?: number;
  player2Rating?: number;
  currentTurn: PlayerId;
  groups: {
    player1: BallGroup | null;
    player2: BallGroup | null;
  };
  tableOpen: boolean;
  remainingBalls: number[];
  isBallInHand: boolean;
  lastFoul?: string;
  onToggleCamera: () => void;
  cameraMode: string;
  isMuted: boolean;
  onToggleMute: () => void;
  onSurrender?: () => void;
  onExit?: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  player1Name,
  player2Name,
  player1Rating,
  player2Rating,
  currentTurn,
  groups,
  tableOpen,
  remainingBalls,
  isBallInHand,
  lastFoul,
  onToggleCamera,
  cameraMode,
  isMuted,
  onToggleMute,
  onSurrender,
  onExit,
}) => {
  const isP1Turn = currentTurn === 'player1';

  // Ball rack helpers
  const p1Group = groups.player1;
  const p2Group = groups.player2;

  const getGroupStats = (group: BallGroup | null) => {
    if (!group) return { isSolids: false, remainingCount: 7, onEightBall: false, label: 'Open Table' };
    const isSolids = group === 'solids';
    const minId = isSolids ? 1 : 9;
    const groupBallIds = Array.from({ length: 7 }, (_, i) => minId + i);
    const remainingCount = groupBallIds.filter((id) => remainingBalls.includes(id)).length;
    return {
      isSolids,
      remainingCount,
      onEightBall: remainingCount === 0,
      label: isSolids ? 'Solids' : 'Stripes',
      ballIds: groupBallIds,
    };
  };

  const p1Stats = getGroupStats(p1Group);
  const p2Stats = getGroupStats(p2Group);

  const renderBallIcons = (stats: ReturnType<typeof getGroupStats>) => {
    if (!stats.ballIds) return null;
    return (
      <div className="hidden sm:flex items-center space-x-1 mt-1">
        {stats.ballIds.map((id) => {
          const isRemaining = remainingBalls.includes(id);
          const color = BALL_COLORS[id];
          const isStripe = id >= 9;
          return (
            <div
              key={id}
              title={`Ball ${id} (${isStripe ? 'Stripes' : 'Solids'})`}
              className={`relative w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center text-[8px] font-bold transition-all duration-300 ${
                isRemaining
                  ? 'scale-100 opacity-100 shadow-sm ring-1 ring-white/60'
                  : 'scale-75 opacity-20 grayscale'
              }`}
              style={{ backgroundColor: color }}
            >
              {isStripe && (
                <div className="absolute inset-x-0 h-1 bg-white/90 rounded-none pointer-events-none" />
              )}
              <span className="relative z-10 text-[6px] sm:text-[7px] font-black text-black">
                {id}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const isP2AI = player2Name.toUpperCase().includes('AI') || player2Name.toUpperCase().includes('BOT');

  return (
    <div className="absolute inset-x-0 top-2 sm:top-3 px-2 sm:px-4 pointer-events-none select-none z-30 flex flex-col items-center">
      {/* Top HUD Card */}
      <div className="w-full max-w-4xl bg-neutral-900/95 backdrop-blur-md border border-neutral-800 rounded-2xl p-2 sm:p-2.5 shadow-2xl flex flex-col gap-1.5 sm:gap-2">
        {/* Top Control Bar: Utilities & Turn Status */}
        <div className="flex items-center justify-between w-full">
          {/* Left Actions: Exit / Concede */}
          <div className="flex items-center space-x-1 sm:space-x-1.5 pointer-events-auto">
            {onExit ? (
              <button
                onClick={onExit}
                className="p-1.5 sm:p-2 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 hover:text-white transition shadow-sm"
                title="Exit Game"
              >
                <Home className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            ) : (
              <Link
                href="/"
                className="p-1.5 sm:p-2 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 hover:text-white transition shadow-sm"
                title="Return to Home"
              >
                <Home className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </Link>
            )}

            {onSurrender && (
              <button
                onClick={onSurrender}
                className="p-1.5 sm:p-2 rounded-xl bg-neutral-800/80 hover:bg-rose-950/60 border border-neutral-700 hover:border-rose-500/50 text-neutral-400 hover:text-rose-400 transition shadow-sm"
                title="Concede Game"
              >
                <Flag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            )}
          </div>

          {/* Center Turn Badge */}
          <div
            className={`text-[10px] sm:text-xs uppercase font-black tracking-widest px-3 py-1 rounded-full border transition-all pointer-events-auto ${
              isP1Turn
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-500/20'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-500/20'
            }`}
          >
            {isP1Turn ? `${player1Name}'s Shot` : `${player2Name}'s Shot`}
          </div>

          {/* Right Actions: Camera & Mute */}
          <div className="flex items-center space-x-1 sm:space-x-1.5 pointer-events-auto">
            <button
              onClick={onToggleCamera}
              className="p-1.5 sm:p-2 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 border border-neutral-700 hover:border-emerald-500/50 text-white hover:text-emerald-300 transition shadow-sm"
              title={`Switch Camera (${cameraMode})`}
            >
              <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              onClick={onToggleMute}
              className="p-1.5 sm:p-2 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 border border-neutral-700 hover:border-emerald-500/50 text-white hover:text-emerald-300 transition shadow-sm"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Players Status Row */}
        <div className="flex items-center justify-between w-full pt-1 border-t border-neutral-800/70">
          {/* Player 1 Card */}
          <div
            className={`flex items-center space-x-2 px-2 py-1 rounded-xl transition-all duration-200 pointer-events-auto ${
              isP1Turn
                ? 'bg-emerald-500/15 border border-emerald-400/50'
                : 'opacity-75'
            }`}
          >
            <div className="relative">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-700 border border-emerald-400 flex items-center justify-center text-[11px] sm:text-xs font-black text-white shadow-md">
                P1
              </div>
              {isP1Turn && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-neutral-900 animate-pulse" />
              )}
            </div>
            <div className="flex flex-col text-left">
              <div className="flex items-center space-x-1">
                <span className="text-xs sm:text-sm font-extrabold text-white tracking-wide truncate max-w-[90px] sm:max-w-none">
                  {player1Name}
                </span>
                {player1Rating !== undefined && (
                  <span className="text-[9px] text-emerald-400 font-mono font-bold hidden sm:inline">
                    ({player1Rating})
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-1 text-[10px]">
                {!p1Group ? (
                  <span className="text-amber-300 font-bold uppercase tracking-wider text-[9px]">
                    Open Table
                  </span>
                ) : p1Stats.onEightBall ? (
                  <span className="text-emerald-400 font-black uppercase text-[9px] bg-emerald-500/20 px-1 rounded animate-pulse">
                    On 8-Ball
                  </span>
                ) : (
                  <span
                    className={`font-bold text-[9px] ${
                      p1Stats.isSolids ? 'text-amber-300' : 'text-cyan-300'
                    }`}
                  >
                    {p1Stats.label}: {p1Stats.remainingCount} left
                  </span>
                )}
              </div>
              {renderBallIcons(p1Stats)}
            </div>
          </div>

          <span className="text-[10px] text-neutral-500 font-black uppercase tracking-wider px-1">
            vs
          </span>

          {/* Player 2 Card */}
          <div
            className={`flex items-center space-x-2 px-2 py-1 rounded-xl transition-all duration-200 pointer-events-auto ${
              !isP1Turn
                ? 'bg-amber-500/15 border border-amber-400/50'
                : 'opacity-75'
            }`}
          >
            <div className="flex flex-col text-right">
              <div className="flex items-center justify-end space-x-1">
                {player2Rating !== undefined && (
                  <span className="text-[9px] text-amber-400 font-mono font-bold hidden sm:inline">
                    ({player2Rating})
                  </span>
                )}
                <span className="text-xs sm:text-sm font-extrabold text-white tracking-wide truncate max-w-[90px] sm:max-w-none">
                  {player2Name}
                </span>
              </div>
              <div className="flex items-center justify-end space-x-1 text-[10px]">
                {!p2Group ? (
                  <span className="text-amber-300 font-bold uppercase tracking-wider text-[9px]">
                    Open Table
                  </span>
                ) : p2Stats.onEightBall ? (
                  <span className="text-amber-400 font-black uppercase text-[9px] bg-amber-500/20 px-1 rounded animate-pulse">
                    On 8-Ball
                  </span>
                ) : (
                  <span
                    className={`font-bold text-[9px] ${
                      p2Stats.isSolids ? 'text-amber-300' : 'text-cyan-300'
                    }`}
                  >
                    {p2Stats.label}: {p2Stats.remainingCount} left
                  </span>
                )}
              </div>
              {renderBallIcons(p2Stats)}
            </div>
            <div className="relative">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-700 border border-amber-400 flex items-center justify-center text-[11px] sm:text-xs font-black text-white shadow-md">
                {isP2AI ? 'AI' : 'P2'}
              </div>
              {!isP1Turn && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-400 rounded-full border-2 border-neutral-900 animate-pulse" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Ball in Hand or Foul Alert Pill */}
      {isBallInHand && (
        <div className="pointer-events-auto mt-1.5 px-3 py-1 rounded-full bg-rose-600/90 text-white font-bold text-[11px] tracking-wider flex items-center space-x-1.5 shadow-xl animate-pulse">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>BALL IN HAND — Drag cue ball to position</span>
        </div>
      )}

      {lastFoul && !isBallInHand && (
        <div className="mt-1 px-3 py-0.5 rounded-full bg-neutral-900/90 text-rose-300 text-[10px] font-semibold border border-rose-500/40 shadow-lg">
          Foul: {lastFoul}
        </div>
      )}
    </div>
  );
};
