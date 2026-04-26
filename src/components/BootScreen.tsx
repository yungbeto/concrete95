'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

const MESSAGES = [
  'Initializing sound card...',
  'Tuning the synths...',
  'Blowing off the dust...',
  'Warming up the tapedeck...',
  'Mixing the concrete...',
  'Pouring the cement...',
  'Negotiating with the contractor...',
  'Loading ambience drivers...',
  'Calibrating reverb chambers...',
  'Starting Concrete 95...',
];

const DURATION = 6000;
const BLOCKS = 24;

export default function BootScreen({ onComplete }: { onComplete: () => void }) {
  const [opacity, setOpacity] = useState(0);
  const [progress, setProgress] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    // Trigger fade-in on next paint
    const fadeIn = requestAnimationFrame(() => setOpacity(1));

    const startTime = performance.now();
    let raf: number;

    const tick = () => {
      const elapsed = performance.now() - startTime;
      const pct = Math.min(100, (elapsed / DURATION) * 100);
      setProgress(pct);
      setMsgIdx(Math.min(MESSAGES.length - 1, Math.floor((elapsed / DURATION) * MESSAGES.length)));

      if (pct < 100) {
        raf = requestAnimationFrame(tick);
      } else {
        // Fade out then notify parent
        setOpacity(0);
        setTimeout(onComplete, 700);
      }
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(fadeIn);
      cancelAnimationFrame(raf);
    };
  }, [onComplete]);

  const filledBlocks = Math.floor((progress / 100) * BLOCKS);

  return (
    <div
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center pointer-events-none"
      style={{ opacity, transition: 'opacity 0.6s ease' }}
    >
      {/* Splash image — Win95 raised window border */}
      <div className="w-full max-w-xl px-4">
        <div className="border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500">
          <div className="border-2 border-t-neutral-300 border-l-neutral-300 border-r-neutral-600 border-b-neutral-600">
            <Image
              src="/splash.jpg"
              alt="Concrete 95"
              width={1200}
              height={900}
              className="w-full h-auto object-contain block"
              priority
              draggable={false}
            />
          </div>
        </div>
      </div>

      {/* Win95-style progress dialog — overlaps bottom of splash */}
      <div className="w-full max-w-sm px-4 -mt-6 relative z-10">
        <div
          className="border-2 p-0"
          style={{
            borderColor: '#ffffff #808080 #808080 #ffffff',
            backgroundColor: '#c0c0c0',
          }}
        >
          {/* Title bar */}
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 mb-2"
            style={{ backgroundColor: '#000080' }}
          >
            <span className="text-white text-[10px]">■</span>
            <span className="text-white text-[11px] font-bold tracking-wide" style={{ fontFamily: 'sans-serif' }}>
              Concrete 95
            </span>
          </div>

          <div className="px-2 pb-2">
            {/* Status message */}
            <p
              className="text-black text-[11px] mb-2 h-4"
              style={{ fontFamily: 'sans-serif' }}
            >
              {MESSAGES[msgIdx]}
            </p>

            {/* Chunky block progress bar — Win95 style */}
            <div
              className="flex gap-px p-px"
              style={{
                border: '2px solid',
                borderColor: '#808080 #ffffff #ffffff #808080',
                backgroundColor: '#c0c0c0',
              }}
            >
              {Array.from({ length: BLOCKS }, (_, i) => (
                <div
                  key={i}
                  className="h-4 flex-1"
                  style={{ backgroundColor: i < filledBlocks ? '#000080' : '#c0c0c0' }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
