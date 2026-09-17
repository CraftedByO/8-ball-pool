'use client';

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, RotateCcw, Home, TrendingUp, TrendingDown } from 'lucide-react';
import Link from 'next/link';

interface MatchResultModalProps {
  winnerName: string;
  isWinner: boolean;
  reason?: string;
  ratingDelta?: number;
  newRating?: number;
  onRematch: () => void;
}

export const MatchResultModal: React.FC<MatchResultModalProps> = ({
  winnerName,
  isWinner,
  reason,
  ratingDelta,
  newRating,
  onRematch,
}) => {
  useEffect(() => {
    if (isWinner) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [isWinner]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md rounded-3xl bg-neutral-900 border border-neutral-700/80 p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center">
        {/* Trophy / Icon Badge */}
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 shadow-xl ${
            isWinner
              ? 'bg-amber-500/20 border-2 border-amber-400 text-amber-400 shadow-amber-500/20'
              : 'bg-neutral-800 border-2 border-neutral-600 text-neutral-400'
          }`}
        >
          <Trophy className="w-10 h-10 animate-pulse" />
        </div>

        <h2 className="text-3xl font-extrabold text-white tracking-tight">
          {isWinner ? 'Victory!' : 'Defeat'}
        </h2>

        <p className="text-emerald-400 font-semibold text-lg mt-1">
          {winnerName} wins the match!
        </p>

        {reason && (
          <p className="text-xs text-neutral-400 mt-2 px-4 py-1.5 rounded-lg bg-neutral-800/60 border border-neutral-700">
            {reason}
          </p>
        )}

        {/* Rating Points Change Box (Shown only if competitive rating is active) */}
        {ratingDelta !== undefined && newRating !== undefined && (
          <div className="w-full my-6 p-4 rounded-2xl bg-neutral-800/50 border border-neutral-700 flex items-center justify-around">
            <div>
              <div className="text-xs text-neutral-400 font-medium">Rating Change</div>
              <div
                className={`text-xl font-bold flex items-center justify-center space-x-1 ${
                  isWinner ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isWinner ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span>{isWinner ? `+${ratingDelta}` : `-${ratingDelta}`}</span>
              </div>
            </div>
            <div className="h-8 w-[1px] bg-neutral-700" />
            <div>
              <div className="text-xs text-neutral-400 font-medium">New Rating</div>
              <div className="text-xl font-bold text-white font-mono">{newRating}</div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="w-full grid grid-cols-2 gap-3">
          <button
            onClick={onRematch}
            className="flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition shadow-lg shadow-emerald-600/30"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Rematch</span>
          </button>
          <Link
            href="/"
            className="flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-semibold border border-neutral-600 transition"
          >
            <Home className="w-4 h-4" />
            <span>Main Menu</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
