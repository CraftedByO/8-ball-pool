'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';

interface SpinControlProps {
  spinX: number; // -1 to 1
  spinY: number; // -1 to 1
  onChange: (spinX: number, spinY: number) => void;
}

export const SpinControl: React.FC<SpinControlProps> = ({ spinX, spinY, onChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
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

  // Convert spin coordinates (-1 to 1) to percentage inside circle
  const tipLeft = 50 + spinX * 50;
  const tipTop = 50 - spinY * 50; // invert Y for screen space

  return (
    <div className="flex flex-col items-center select-none">
      <div className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider mb-1">
        Cue Ball English
      </div>
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        className="relative w-20 h-20 rounded-full bg-gradient-to-br from-white via-neutral-100 to-neutral-300 border-2 border-neutral-400 shadow-xl cursor-crosshair touch-none overflow-hidden"
      >
        {/* Crosshairs */}
        <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-neutral-300" />
        <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-neutral-300" />

        {/* Chalk Contact Dot Indicator */}
        <div
          className="absolute w-3.5 h-3.5 -ml-[7px] -mt-[7px] rounded-full bg-red-600 border border-white shadow-md transition-transform duration-75"
          style={{
            left: `${tipLeft}%`,
            top: `${tipTop}%`,
          }}
        />
      </div>
      <div className="text-[10px] text-neutral-400 mt-1 flex space-x-2">
        <span>X: {spinX > 0 ? `+${spinX}` : spinX}</span>
        <span>Y: {spinY > 0 ? `+${spinY}` : spinY}</span>
      </div>
    </div>
  );
};
