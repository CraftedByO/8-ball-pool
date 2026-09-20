'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';

interface PowerMeterProps {
  power: number; // 0 to 1
  onChange: (power: number) => void;
  onRelease: () => void;
  disabled?: boolean;
}

export const PowerMeter: React.FC<PowerMeterProps> = ({
  power,
  onChange,
  onRelease,
  disabled = false,
}) => {
  const barRef = useRef<HTMLDivElement>(null);
  const [isPulling, setIsPulling] = useState(false);

  const calculatePower = useCallback(
    (clientY: number) => {
      if (!barRef.current) return;
      const rect = barRef.current.getBoundingClientRect();
      // Moving upwards increases power (towards the red 100% top)
      const relativeFromBottom = rect.bottom - clientY;
      const ratio = Math.max(0.05, Math.min(1.0, relativeFromBottom / rect.height));
      onChange(parseFloat(ratio.toFixed(2)));
    },
    [onChange]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    setIsPulling(true);
    calculatePower(e.clientY);
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (isPulling) {
        calculatePower(e.clientY);
      }
    };
    const handlePointerUp = () => {
      if (isPulling) {
        setIsPulling(false);
      }
    };

    if (isPulling) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isPulling, calculatePower]);

  const heightPercent = Math.round(power * 100);

  // Power presets
  const presets = [
    { label: 'Soft', value: 0.25 },
    { label: 'Med', value: 0.5 },
    { label: 'Firm', value: 0.75 },
    { label: 'Break', value: 1.0 },
  ];

  return (
    <div className="flex flex-col items-center select-none gap-2">
      <div className="flex items-center justify-between w-full px-1">
        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
          Power
        </span>
        <span
          className={`text-xs font-mono font-black ${
            heightPercent > 80
              ? 'text-rose-400'
              : heightPercent > 50
              ? 'text-amber-400'
              : 'text-emerald-400'
          }`}
        >
          {heightPercent}%
        </span>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Quick Power Preset Buttons (Shown on tablet/desktop) */}
        <div className="hidden sm:flex flex-col justify-between h-44 py-1">
          {presets.slice().reverse().map(p => (
            <button
              key={p.label}
              type="button"
              disabled={disabled}
              onClick={() => onChange(p.value)}
              className={`px-1.5 py-1 rounded text-[10px] font-bold transition ${
                Math.abs(power - p.value) < 0.08
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                  : 'bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Vertical Power Bar */}
        <div
          ref={barRef}
          onPointerDown={handlePointerDown}
          className={`relative w-7 sm:w-8 h-32 sm:h-44 rounded-xl bg-neutral-950 border border-neutral-700 p-1 flex flex-col justify-end shadow-2xl overflow-hidden touch-none ${
            disabled
              ? 'opacity-40 cursor-not-allowed'
              : 'cursor-ns-resize hover:border-emerald-400 transition-colors'
          }`}
        >
          {/* Dynamic power fill gradient */}
          <div
            className={`w-full rounded-lg bg-gradient-to-t from-emerald-500 via-yellow-400 to-rose-600 transition-all duration-75 shadow-lg ${
              heightPercent > 85 ? 'animate-pulse' : ''
            }`}
            style={{ height: `${heightPercent}%` }}
          />

          {/* Interactive thumb handle */}
          <div
            className="absolute left-0 right-0 h-2 -ml-0.5 -mr-0.5 bg-white rounded-full shadow-md border border-neutral-900 pointer-events-none transition-all duration-75"
            style={{
              bottom: `calc(${heightPercent}% - 4px)`,
            }}
          />

          {/* Preset Notches */}
          <div className="absolute inset-0 flex flex-col justify-between py-2 pointer-events-none opacity-25">
            <div className="w-full h-[1px] bg-white" />
            <div className="w-full h-[1px] bg-white" />
            <div className="w-full h-[1px] bg-white" />
            <div className="w-full h-[1px] bg-white" />
          </div>
        </div>
      </div>

      {/* Primary Strike Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={onRelease}
        className={`w-full py-1.5 sm:py-2 px-2 sm:px-3 rounded-xl font-black text-[11px] sm:text-xs uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-1 shadow-lg ${
          disabled
            ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
            : heightPercent > 80
            ? 'bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white shadow-rose-600/30 active:scale-95'
            : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/30 active:scale-95'
        }`}
      >
        <span>Strike</span>
        <span className="text-[10px] opacity-75 font-normal hidden sm:inline">␣</span>
      </button>
    </div>
  );
};
