'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Trophy, Users, Bot, User, HelpCircle, Gamepad2 } from 'lucide-react';

export const NavigationHeader: React.FC = () => {
  const pathname = usePathname();

  const navLinks = [
    { href: '/', label: 'Home', icon: Gamepad2 },
    { href: '/play', label: 'Single Player', icon: Bot },
    { href: '/help', label: 'Rules & Guide', icon: HelpCircle },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-neutral-950/80 backdrop-blur-lg border-b border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center font-black text-white text-base shadow-lg shadow-emerald-500/20">
            8
          </div>
          <span className="text-lg font-extrabold text-white tracking-tight">
            3D Pool <span className="text-emerald-400">Arena</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center space-x-1">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Mobile menu pill bar */}
        <div className="flex md:hidden items-center space-x-1">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`p-2 rounded-lg text-xs font-medium transition ${
                pathname === href ? 'text-emerald-400 bg-emerald-500/10' : 'text-neutral-400'
              }`}
              title={label}
            >
              <Icon className="w-5 h-5" />
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
};
