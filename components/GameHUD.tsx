'use client';

import React from 'react';
import { PlayerId, BallGroup } from '../rules/types';
import { BALL_COLORS } from '../game/textures';
import { Camera, Volume2, VolumeX, ShieldAlert, Flag } from 'lucide-react';

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
}) => {
  const isP1Turn = currentTurn === 'player1';

  // Ball rack helpers
  const p1Group = groups.player1;
  const p2Group = groups.player2;

  const renderBallPills = (group: BallGroup | null, isPlayer: boolean) => {
    if (!group) {
      return (
        <div className="flex items-center space-x-1.5 mt-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 shadow-sm">
            Open Table
          </span>
        </div>
      );
    }

    const isSolids = group === 'solids';
    const minId = isSolids ? 1 : 9;
    const maxId = isSolids ? 7 : 15;
    const groupBallIds = Array.from({ length: 7 }, (_, i) => minId + i);
    const remainingCount = groupBallIds.filter((id) => remainingBalls.includes(id)).length;
    const onEightBall = remainingCount === 0;

    return (
      <div className={`flex flex-col ${isPlayer ? 'items-start' : 'items-end'} mt-1`}>
        <div className="flex items-center space-x-1.5 mb-1">
          <span
            className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md shadow-sm ${
              isSolids
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
            }`}
          >
            {isSolids ? 'Solids (1-7)' : 'Stripes (9-15)'}
          </span>
          {onEightBall ? (
            <span className="text-[10px] font-black uppercase text-emerald-400 bg-emerald-500/20 border border-emerald-500/40 px-1.5 py-0.5 rounded animate-pulse">
              On 8-Ball
            </span>
          ) : (
            <span className="text-[10px] text-neutral-400 font-mono font-bold">
              {remainingCount} left
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1">
          {groupBallIds.map((id) => {
            const isRemaining = remainingBalls.includes(id);
            const color = BALL_COLORS[id];
            const isStripe = id >= 9;
            return (
              <div
                key={id}
                title={`Ball ${id} (${isStripe ? 'Stripes' : 'Solids'})`}
                className={`relative w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold transition-all duration-300 ${
                  isRemaining
                    ? 'scale-100 opacity-100 shadow-sm ring-1 ring-white/60'
                    : 'scale-75 opacity-20 grayscale'
                }`}
                style={{ backgroundColor: color }}
              >
                {isStripe && (
                  <div className="absolute inset-x-0 h-1.5 bg-white/90 rounded-none pointer-events-none" />
                )}
                <span className="relative z-10 text-[7px] font-black text-black">
                  {id}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const isP2AI = player2Name.toUpperCase().includes('AI') || player2Name.toUpperCase().includes('BOT');

  return (
    <div className="absolute inset-x-0 top-16 pt-2 sm:pt-3 px-3 sm:px-6 pointer-events-none select-none z-30">
      {/* Top Banner Bar */}
      <div className="max-w-4xl mx-auto flex items-center justify-between bg-neutral-900/90 backdrop-blur-md border border-neutral-800 rounded-2xl p-2.5 sm:p-3 shadow-2xl">
        {/* Player 1 Card */}
        <div
          className={`flex items-center space-x-3 px-3 py-1.5 rounded-xl transition-all duration-200 ${
            isP1Turn
              ? 'bg-emerald-500/20 border border-emerald-400/60 shadow-emerald-500/20 shadow-lg'
              : 'opacity-75'
          }`}
        >
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-emerald-700 border border-emerald-400 flex items-center justify-center text-xs font-black text-white shadow-md">
              P1
            </div>
            {isP1Turn && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-neutral-900 animate-pulse" />
            )}
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-sm font-extrabold text-white tracking-wide">{player1Name}</span>
              {player1Rating !== undefined && (
                <span className="text-[10px] text-emerald-400 font-mono font-bold">({player1Rating})</span>
              )}
            </div>
            {renderBallPills(p1Group, true)}
          </div>
        </div>

        {/* Center VS and Turn Indicator */}
        <div className="flex flex-col items-center px-2">
          <div
            className={`text-[10px] sm:text-[11px] uppercase font-black tracking-widest px-2.5 py-1 rounded-full border transition-all ${
              isP1Turn
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
            }`}
          >
            {isP1Turn ? `${player1Name}'s Shot` : `${player2Name}'s Shot`}
          </div>
        </div>

        {/* Player 2 Card */}
        <div
          className={`flex items-center space-x-3 px-3 py-1.5 rounded-xl transition-all duration-200 ${
            !isP1Turn
              ? 'bg-amber-500/20 border border-amber-400/60 shadow-amber-500/20 shadow-lg'
              : 'opacity-75'
          }`}
        >
          <div className="text-right">
            <div className="flex items-center justify-end space-x-1.5">
              {player2Rating !== undefined && (
                <span className="text-[10px] text-amber-400 font-mono font-bold">({player2Rating})</span>
              )}
              <span className="text-sm font-extrabold text-white tracking-wide">{player2Name}</span>
            </div>
            {renderBallPills(p2Group, false)}
          </div>
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-amber-700 border border-amber-400 flex items-center justify-center text-xs font-black text-white shadow-md">
              {isP2AI ? 'AI' : 'P2'}
            </div>
            {!isP1Turn && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border-2 border-neutral-900 animate-pulse" />
            )}
          </div>
        </div>
      </div>

      {/* Ball in Hand or Foul Alert Banner */}
      {isBallInHand && (
        <div className="pointer-events-auto mt-2 px-4 py-1.5 rounded-full bg-rose-600/90 text-white font-bold text-xs tracking-wider flex items-center space-x-2 shadow-xl animate-bounce">
          <ShieldAlert className="w-4 h-4" />
          <span>BALL IN HAND — Drag cue ball to position</span>
        </div>
      )}

      {lastFoul && !isBallInHand && (
        <div className="mt-1 px-3 py-1 rounded-full bg-neutral-900/90 text-rose-300 text-[11px] font-semibold border border-rose-500/40 shadow-lg">
          Foul: {lastFoul}
        </div>
      )}

      {/* Floating Action Controls on Top-Right */}
      <div className="pointer-events-auto absolute top-2 sm:top-3 right-3 sm:right-6 flex items-center space-x-2">
        <button
          onClick={onToggleCamera}
          className="p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-700 hover:border-emerald-400 text-white hover:text-emerald-300 transition shadow-xl"
          title={`Switch Camera (${cameraMode})`}
        >
          <Camera className="w-4 h-4" />
        </button>
        <button
          onClick={onToggleMute}
          className="p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-700 hover:border-emerald-400 text-white hover:text-emerald-300 transition shadow-xl"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        {onSurrender && (
          <button
            onClick={onSurrender}
            className="p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-700 hover:border-rose-400 text-neutral-400 hover:text-rose-400 transition shadow-xl"
            title="Concede Game"
          >
            <Flag className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
