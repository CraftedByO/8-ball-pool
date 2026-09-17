'use client';

import React, { useState, useEffect } from 'react';
import { NavigationHeader } from '../../components/NavigationHeader';
import { initAnonymousAuth, getPlayerProfile, claimUsername } from '../../firebase/auth';
import { PlayerProfile, MatchHistoryEntry } from '../../leaderboard/types';
import { User, Trophy, Shield, Swords, Calendar, Edit3, Check, Loader2 } from 'lucide-react';

export default function ProfilePage() {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [history, setHistory] = useState<MatchHistoryEntry[]>([]);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    initAnonymousAuth().then(user => {
      if (user) {
        getPlayerProfile(user.uid).then(p => {
          if (p) {
            setProfile(p);
            setNewUsername(p.username);
          }
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    try {
      const stored = localStorage.getItem('pool_arena_match_history');
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setErrorMsg('');

    const res = await claimUsername({ uid: profile.uid }, newUsername);
    if (res.success && res.profile) {
      setProfile(res.profile);
      setIsEditingUsername(false);
    } else {
      setErrorMsg(res.error || 'Failed to update username');
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col text-white">
      <NavigationHeader />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 sm:py-12">
        {loading ? (
          <div className="py-24 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          </div>
        ) : profile ? (
          <div className="space-y-8">
            <div className="p-6 sm:p-8 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-2xl flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6 text-center sm:text-left">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-3xl font-black text-white shadow-xl shadow-emerald-500/20 border-2 border-emerald-400/40">
                {profile.username.substring(0, 2).toUpperCase()}
              </div>

              <div className="flex-1">
                {isEditingUsername ? (
                  <form onSubmit={handleUpdateUsername} className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={newUsername}
                      onChange={e => setNewUsername(e.target.value)}
                      maxLength={15}
                      className="px-3 py-1.5 rounded-xl bg-neutral-800 border border-neutral-700 text-white text-lg font-bold focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="submit"
                      disabled={saving}
                      className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingUsername(false)}
                      className="p-2 rounded-xl bg-neutral-800 text-neutral-400 hover:text-white transition"
                    >
                      ✕
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center justify-center sm:justify-start space-x-2">
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                      {profile.username}
                    </h1>
                    <button
                      onClick={() => setIsEditingUsername(true)}
                      className="p-1.5 text-neutral-400 hover:text-emerald-400 transition"
                      title="Edit Username"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {errorMsg && <p className="text-rose-400 text-xs mt-1">{errorMsg}</p>}

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {profile.rankTier} Tier
                  </span>
                  <span className="text-xs text-neutral-400 font-mono">UID: {profile.uid.substring(0, 8)}...</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 text-center">
                <Trophy className="w-5 h-5 text-amber-400 mx-auto mb-2" />
                <div className="text-2xl font-black font-mono text-white">{profile.rating}</div>
                <div className="text-xs text-neutral-400 mt-0.5">Elo Rating</div>
              </div>
              <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 text-center">
                <Shield className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
                <div className="text-2xl font-black font-mono text-emerald-400">{profile.wins}</div>
                <div className="text-xs text-neutral-400 mt-0.5">Victories</div>
              </div>
              <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 text-center">
                <Swords className="w-5 h-5 text-rose-400 mx-auto mb-2" />
                <div className="text-2xl font-black font-mono text-rose-400">{profile.losses}</div>
                <div className="text-xs text-neutral-400 mt-0.5">Defeats</div>
              </div>
              <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 text-center">
                <Calendar className="w-5 h-5 text-sky-400 mx-auto mb-2" />
                <div className="text-2xl font-black font-mono text-white">
                  {profile.gamesPlayed > 0 ? ((profile.wins / profile.gamesPlayed) * 100).toFixed(0) : 0}%
                </div>
                <div className="text-xs text-neutral-400 mt-0.5">Win Rate</div>
              </div>
            </div>

            <div className="rounded-3xl bg-neutral-900 border border-neutral-800 p-6 shadow-2xl">
              <h2 className="text-lg font-bold text-white mb-4">Recent Match History</h2>
              {history.length === 0 ? (
                <div className="text-center py-8 text-neutral-500 text-sm">
                  No completed matches on record yet. Play a game to record your stats!
                </div>
              ) : (
                <div className="divide-y divide-neutral-800">
                  {history.map(item => {
                    const isWin = item.winnerUid === profile.uid;
                    return (
                      <div key={item.matchId} className="py-3 flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-3">
                          <span
                            className={`w-2 h-2 rounded-full ${isWin ? 'bg-emerald-400' : 'bg-rose-500'}`}
                          />
                          <div>
                            <span className="font-semibold text-white">
                              vs {item.player1Uid === profile.uid ? item.player2Username : item.player1Username}
                            </span>
                            <span className="text-xs text-neutral-500 block">
                              {new Date(item.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 font-mono">
                          <span className={`font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isWin ? `+${item.ratingDelta}` : `-${item.ratingDelta}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 rounded-3xl bg-neutral-900 border border-neutral-800 text-center">
            <User className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-white">No Profile Found</h2>
            <p className="text-neutral-400 text-xs mt-1">Claim a handle by starting an online match.</p>
          </div>
        )}
      </main>
    </div>
  );
}
