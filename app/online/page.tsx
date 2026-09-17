'use client';

import React from 'react';
import Link from 'next/link';
import { NavigationHeader } from '../../components/NavigationHeader';
import { Users, Bot, ArrowRight, ShieldCheck, Home } from 'lucide-react';

export default function OnlineMultiplayerPage() {
  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col text-white selection:bg-emerald-500 selection:text-black">
      <NavigationHeader />

      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-16 sm:py-24 flex flex-col items-center justify-center text-center">
        {/* Disabled Badge */}
        <div className="w-20 h-20 rounded-3xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400 mb-6 shadow-2xl">
          <Users className="w-10 h-10 text-neutral-500" />
        </div>

        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-4">
          <span>Multiplayer Temporarily Disabled</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-3">
          Single Player Mode Active
        </h1>

        <p className="text-sm sm:text-base text-neutral-400 leading-relaxed max-w-md mb-8">
          Online multiplayer and room matchmaking are currently disabled while we focus on perfecting realistic physics and single-player AI gameplay.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
          <Link
            href="/play"
            className="w-full sm:flex-1 py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm shadow-xl shadow-emerald-600/25 transition-all duration-200 flex items-center justify-center space-x-2"
          >
            <Bot className="w-4 h-4" />
            <span>Play Single Player vs AI</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href="/"
            className="w-full sm:w-auto py-4 px-6 rounded-2xl bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white font-bold text-sm border border-neutral-800 transition flex items-center justify-center space-x-2"
          >
            <Home className="w-4 h-4" />
            <span>Home</span>
          </Link>
        </div>

        {/* Feature guarantee */}
        <div className="mt-12 p-4 rounded-2xl bg-neutral-900/50 border border-neutral-800/80 flex items-center space-x-3 text-left w-full text-xs text-neutral-400">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>Full single-player practice with 4 AI tiers, custom spin, break mechanics, and authentic ball physics is fully available.</span>
        </div>
      </main>
    </div>
  );
}
