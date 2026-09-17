'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { NavigationHeader } from '../components/NavigationHeader';
import { initAnonymousAuth, getPlayerProfile } from '../firebase/auth';
import { PlayerProfile } from '../leaderboard/types';
import { Bot, Users, Trophy, Sparkles, Shield, ArrowRight } from 'lucide-react';

export default function HomePage() {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);

  useEffect(() => {
    initAnonymousAuth().then(user => {
      if (user) {
        getPlayerProfile(user.uid).then(p => {
          if (p) setProfile(p);
        });
      }
    });
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col text-white selection:bg-emerald-500 selection:text-black">
      <NavigationHeader />

      {/* Hero Section */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-12 sm:py-20 flex flex-col items-center text-center">
        {/* Subtle pill tag */}
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-6 shadow-inner">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Realistic 3D Billiards Simulation & AI Single Player</span>
        </div>

        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight max-w-4xl leading-tight">
          Master the Table in <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            3D Pool Arena
          </span>
        </h1>

        <p className="mt-4 sm:mt-6 text-neutral-400 text-sm sm:text-lg max-w-2xl leading-relaxed">
          True-to-life billiards physics with authentic sliding, rolling, topspin, backspin, English, and cushion restitution. Hone your skills and shot-making against strategic AI opponents.
        </p>

        {/* Primary Single Player Play Button */}
        <div className="mt-10 sm:mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md">
          <Link
            href="/play"
            className="group relative w-full sm:w-auto flex-1 p-5 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold text-base shadow-2xl shadow-emerald-600/30 transition-all duration-300 flex items-center justify-center space-x-3 border border-emerald-400/40 hover:scale-[1.02]"
          >
            <Bot className="w-5 h-5" />
            <span>Play Single Player</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            href="/help"
            className="w-full sm:w-auto px-6 py-5 rounded-2xl bg-neutral-900/90 hover:bg-neutral-850 text-neutral-300 hover:text-white font-bold text-sm border border-neutral-800 transition shadow-lg flex items-center justify-center space-x-2"
          >
            <span>Rules & Controls</span>
          </Link>
        </div>

        {/* Feature Highlights Grid */}
        <div className="mt-16 sm:mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
          <div className="p-6 rounded-3xl bg-neutral-900/50 border border-neutral-800 backdrop-blur-md">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
              <Bot className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">4 AI Difficulty Tiers</h3>
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
              From casual line-of-sight bots to tournament expert AI calculating cut angles, bank shots, and position control.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-neutral-900/50 border border-neutral-800 backdrop-blur-md">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center mb-3">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Full WPA 8-Ball Rules</h3>
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
              Standard break, open table, solids & stripes assignment, legal contact, and ball-in-hand fouls.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-neutral-900/50 border border-neutral-800 backdrop-blur-md">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-3">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Photorealistic 3D Visuals</h3>
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
              Regulation 9ft table geometry, Simonis worsted wool cloth, mother-of-pearl diamond sights, and dynamic lighting.
            </p>
          </div>
        </div>

        {/* Player status preview */}
        {profile && (
          <div className="mt-12 p-3.5 px-5 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex items-center space-x-2 text-xs text-neutral-400">
            <span>Player: <strong className="text-white">{profile.username}</strong></span>
          </div>
        )}
      </main>
    </div>
  );
}
