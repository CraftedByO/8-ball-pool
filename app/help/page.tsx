'use client';

import React from 'react';
import { NavigationHeader } from '../../components/NavigationHeader';
import { HelpCircle, CheckCircle2, AlertOctagon, Target, Compass } from 'lucide-react';

export default function HelpRulesPage() {
  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col text-white">
      <NavigationHeader />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 sm:py-12">
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Standard 8-Ball Rules</h1>
            <p className="text-neutral-400 text-xs sm:text-sm mt-0.5">
              Official World Pool-Billiard Association (WPA) standard tournament rules
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Section 1: Objective & Groups */}
          <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-xl">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold text-lg mb-3">
              <Target className="w-5 h-5" />
              <span>Game Objective & Ball Groups</span>
            </div>
            <p className="text-sm text-neutral-300 leading-relaxed">
              8-Ball is played with a cue ball and 15 numbered object balls (1 through 15). One player shoots <strong>solids</strong> (balls 1 through 7) and the other shoots <strong>stripes</strong> (balls 9 through 15). The player who legally pockets their assigned group and then legally pockets the <strong>8-ball</strong> wins the game.
            </p>
          </div>

          {/* Section 2: Break & Open Table */}
          <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-xl">
            <div className="flex items-center space-x-2 text-sky-400 font-bold text-lg mb-3">
              <Compass className="w-5 h-5" />
              <span>The Break & Open Table</span>
            </div>
            <ul className="text-sm text-neutral-300 space-y-2 list-disc list-inside">
              <li>
                <strong>Break Shot:</strong> The cue ball is struck from behind the head string. The breaker must either pocket a ball or drive at least 4 numbered balls to the rail cushions.
              </li>
              <li>
                <strong>Open Table:</strong> The table is considered &quot;open&quot; immediately after the break, even if balls were pocketed. Groups are determined only when a player legally pockets an object ball during regular post-break play.
              </li>
            </ul>
          </div>

          {/* Section 3: Legal Shots & Fouls */}
          <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-xl">
            <div className="flex items-center space-x-2 text-amber-400 font-bold text-lg mb-3">
              <AlertOctagon className="w-5 h-5" />
              <span>Legal Shots & Fouls (Ball in Hand)</span>
            </div>
            <p className="text-sm text-neutral-300 mb-3">
              On every shot, the cue ball must make initial contact with a legal ball (from the shooter&apos;s assigned group) and then:
            </p>
            <ul className="text-sm text-neutral-300 space-y-2 list-disc list-inside">
              <li>An object ball must be pocketed, <strong>OR</strong></li>
              <li>Any ball (cue ball or object ball) must contact a cushion rail.</li>
            </ul>
            <div className="mt-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              <strong>Foul Consequences:</strong> If a player scratches, hits the wrong ball first, or fails to drive a ball to a cushion after contact, the opponent receives <strong>Ball in Hand</strong> anywhere on the table.
            </div>
          </div>

          {/* Section 4: 8-Ball Win & Loss */}
          <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-xl">
            <div className="flex items-center space-x-2 text-purple-400 font-bold text-lg mb-3">
              <CheckCircle2 className="w-5 h-5" />
              <span>Winning or Losing on the 8-Ball</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                <span className="font-bold text-emerald-400 block mb-1">Instant Victory:</span>
                Legally pocketing the 8-ball in any called pocket after all balls in your group have been pocketed without committing a foul.
              </div>
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30">
                <span className="font-bold text-rose-400 block mb-1">Instant Loss:</span>
                Pocketing the 8-ball before clearing your group, or scratching the cue ball on the same shot that the 8-ball is pocketed.
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
