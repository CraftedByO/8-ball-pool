'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { X, RotateCcw } from 'lucide-react';

interface SpinControlProps {
  spinX: number; // -1 to 1
  spinY: number; // -1 to 1
  onChange: (spinX: number, spinY: number) => void;
  defaultOpen?: boolean;
}

export const SpinControl: React.FC<SpinControlProps> = ({
  spinX,
  spinY,
  onChange,
  defaultOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const updateSpinFromEvent = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const radius = rect.width / 2;
      const centerX = rect.left + radius;
      const centerY = rect.top + radius;

      let dx = (clientX - centerX) / radius;
      let dy = (clientY - centerY) / radius;

      // Clamp to unit circle with 0.8 safe chalk boundary
      const dist = Math.hypot(dx, dy);
      const maxRadius = 0.8;
      if (dist > maxRadius) {
        dx = (dx / dist) * maxRadius;
        dy = (dy / dist) * maxRadius;
      }

      // dy is positive upwards for topspin
      onChange(parseFloat(dx.toFixed(2)), parseFloat((-dy).toFixed(2)));
    },
    [onChange]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    updateSpinFromEvent(e.clientX, e.clientY);
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (isDragging) {
        updateSpinFromEvent(e.clientX, e.clientY);
      }
    };
    const handlePointerUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, updateSpinFromEvent]);

  // Close when clicking outside popover
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [isOpen]);

  // Convert spin coordinates (-1 to 1) to percentage inside circle
  const tipLeft = 50 + spinX * 50;
  const tipTop = 50 - spinY * 50; // invert Y for screen space

  const hasSpin = Math.abs(spinX) > 0.05 || Math.abs(spinY) > 0.05;

  return (
    <div className="relative select-none" ref={popoverRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-2 px-2.5 py-1.5 rounded-xl border transition-all duration-200 shadow-xl ${
          isOpen || hasSpin
            ? 'bg-neutral-800 border-emerald-500/60 text-emerald-400'
            : 'bg-neutral-900/90 hover:bg-neutral-800 border-neutral-700/80 text-neutral-300'
        }`}
        title="Cue Ball English & Spin"
      >
        {/* Mini Ball Thumbnail */}
        <div className="relative w-6 h-6 rounded-full bg-gradient-to-br from-white via-neutral-100 to-neutral-300 border border-neutral-400 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
          <div className="absolute top-1/2 left-0 right-0 h-[0.5px] bg-neutral-300 pointer-events-none" />
          <div className="absolute left-1/2 top-0 bottom-0 w-[0.5px] bg-neutral-300 pointer-events-none" />
          <div
            className="absolute w-2 h-2 -ml-1 -mt-1 rounded-full bg-red-600 border border-white shadow-sm"
            style={{ left: `${tipLeft}%`, top: `${tipTop}%` }}
          />
        </div>
        <div className="flex flex-col text-left">
          <span className="text-[10px] font-bold tracking-wider uppercase leading-none">
            Spin
          </span>
          <span className="text-[9px] text-neutral-400 font-mono leading-none mt-0.5">
            {hasSpin ? `${spinX > 0 ? `+${spinX}` : spinX}, ${spinY > 0 ? `+${spinY}` : spinY}` : 'Center'}
          </span>
        </div>
      </button>

      {/* Expanded Spin Popover Pad */}
      {isOpen && (
        <div className="absolute bottom-12 left-0 z-50 bg-neutral-900/95 backdrop-blur-md border border-neutral-700 rounded-2xl p-3 shadow-2xl flex flex-col items-center w-40 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between w-full mb-2">
            <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider">
              Cue Ball English
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div
            ref={containerRef}
            onPointerDown={handlePointerDown}
            className="relative w-24 h-24 rounded-full bg-gradient-to-br from-white via-neutral-100 to-neutral-300 border-2 border-neutral-400 shadow-xl cursor-crosshair touch-none overflow-hidden my-1"
          >
            {/* Crosshairs */}
            <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-neutral-300" />
            <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-neutral-300" />

            {/* Chalk Contact Dot Indicator */}
            <div
              className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full bg-red-600 border-2 border-white shadow-md transition-transform duration-75 pointer-events-none"
              style={{
                left: `${tipLeft}%`,
                top: `${tipTop}%`,
              }}
            />
          </div>

          <div className="flex items-center justify-between w-full mt-2 pt-1 border-t border-neutral-800 text-[10px]">
            <span className="text-neutral-400 font-mono">
              {spinX > 0 ? `+${spinX}` : spinX}, {spinY > 0 ? `+${spinY}` : spinY}
            </span>
            <button
              type="button"
              onClick={() => onChange(0, 0)}
              className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[9px] font-semibold transition"
              title="Reset Spin to Center"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Center</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
