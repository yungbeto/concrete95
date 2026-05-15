'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';

const WIN95_MESSAGES = [
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

const DOS_COMMAND = 'C:\\CONCRETE> concrete95.exe';

const DOS_LINES = [
  '',
  'CONCRETE 95  [Version 1.0.0]',
  'Copyright (C) 1995 Concrete Industries. All rights reserved.',
  '',
  'Loading CONCRETE95.SYS...',
  'Initializing audio subsystem...',
  'Detecting Creative Sound Blaster 16...',
  'Mounting session data...',
];

const DURATION = 6000;
const BLOCKS = 24;
const SLIDE_DURATION = 550;
const CHAR_DELAY = 48;
const LINE_DELAY = 210;

export default function BootScreen({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<'dos' | 'win95'>('dos');
  const [dosOpacity, setDosOpacity] = useState(1);
  const [cursorVisible, setCursorVisible] = useState(true);

  // DOS state
  const [typedChars, setTypedChars] = useState(0);
  const [visibleLineCount, setVisibleLineCount] = useState(0);
  const [showFinalCursor, setShowFinalCursor] = useState(false);

  // Win95 state
  const [win95Opacity, setWin95Opacity] = useState(0);
  const [splashIn, setSplashIn] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);

  const rafRef = useRef<number>(0);
  const animDoneRef = useRef(false);
  const imageLoadedRef = useRef(false);
  const transitioningRef = useRef(false);

  // Blinking cursor — shared between typing cursor and final idle cursor
  useEffect(() => {
    const interval = setInterval(() => setCursorVisible(v => !v), 530);
    return () => clearInterval(interval);
  }, []);

  const startWin95 = useCallback(() => {
    if (transitioningRef.current) return;
    transitioningRef.current = true;

    setDosOpacity(0);

    setTimeout(() => {
      setPhase('win95');

      requestAnimationFrame(() => {
        setWin95Opacity(1);
        setSplashIn(true);
      });

      setTimeout(() => {
        setDialogVisible(true);
        const startTime = performance.now();

        const tick = () => {
          const elapsed = performance.now() - startTime;
          const pct = Math.min(100, (elapsed / DURATION) * 100);
          setProgress(pct);
          setMsgIdx(Math.min(WIN95_MESSAGES.length - 1, Math.floor((elapsed / DURATION) * WIN95_MESSAGES.length)));

          if (pct < 100) {
            rafRef.current = requestAnimationFrame(tick);
          } else {
            setWin95Opacity(0);
            setTimeout(onComplete, 700);
          }
        };

        rafRef.current = requestAnimationFrame(tick);
      }, SLIDE_DURATION);
    }, 600);
  }, [onComplete]);

  // Preload splash — gate on this before showing Win95
  useEffect(() => {
    const img = new window.Image();
    img.src = '/splash.jpg';
    img.onload = () => {
      imageLoadedRef.current = true;
      if (animDoneRef.current) startWin95();
    };
    img.onerror = () => {
      // Proceed even on error so we never get stuck
      imageLoadedRef.current = true;
      if (animDoneRef.current) startWin95();
    };
  }, [startWin95]);

  // DOS typewriter + line reveal
  useEffect(() => {
    let charIdx = 0;

    const typeInterval = setInterval(() => {
      charIdx++;
      setTypedChars(charIdx);

      if (charIdx >= DOS_COMMAND.length) {
        clearInterval(typeInterval);

        DOS_LINES.forEach((_, i) => {
          setTimeout(() => {
            setVisibleLineCount(i + 1);

            if (i === DOS_LINES.length - 1) {
              setTimeout(() => {
                setShowFinalCursor(true);
                animDoneRef.current = true;
                if (imageLoadedRef.current) startWin95();
                // If image isn't ready yet, the cursor keeps blinking until it loads
              }, 400);
            }
          }, LINE_DELAY * (i + 1));
        });
      }
    }, CHAR_DELAY);

    return () => {
      clearInterval(typeInterval);
      cancelAnimationFrame(rafRef.current);
    };
  }, [startWin95]);

  const isTypingDone = typedChars >= DOS_COMMAND.length;
  const filledBlocks = Math.floor((progress / 100) * BLOCKS);

  const cursorBlock = (
    <span
      style={{
        display: 'inline-block',
        width: '8px',
        height: '15px',
        backgroundColor: '#33ff33',
        opacity: cursorVisible ? 1 : 0,
        verticalAlign: 'text-bottom',
        marginLeft: '1px',
        transition: 'opacity 0.05s step-end',
      }}
    />
  );

  return (
    <>
      {/* ── DOS Phase ── */}
      {phase === 'dos' && (
        <div
          className="fixed inset-0 z-[99999] flex flex-col justify-start px-8 pt-10"
          style={{
            backgroundColor: '#000',
            opacity: dosOpacity,
            transition: 'opacity 0.6s ease',
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '14px',
            lineHeight: '1.65',
            color: '#33ff33',
          }}
        >
          {/* Typewriter line */}
          <div>
            {DOS_COMMAND.slice(0, typedChars)}
            {!isTypingDone && cursorBlock}
          </div>

          {/* Revealed lines */}
          {DOS_LINES.slice(0, visibleLineCount).map((line, i) => (
            <div key={i} style={{ minHeight: '1.65em' }}>
              {line}
            </div>
          ))}

          {/* Idle cursor — blinks while waiting for image if animation finishes first */}
          {showFinalCursor && (
            <div style={{ marginTop: '6px' }}>
              {'C:\\CONCRETE> '}
              {cursorBlock}
            </div>
          )}
        </div>
      )}

      {/* ── Win95 Phase ── */}
      {phase === 'win95' && (
        <div
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center pointer-events-none"
          style={{ opacity: win95Opacity, transition: 'opacity 0.6s ease' }}
        >
          {/* Splash image — slides up on mount */}
          <div
            className="w-full max-w-xl px-4"
            style={{
              transform: splashIn ? 'translateY(0)' : 'translateY(36px)',
              transition: `transform ${SLIDE_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
            }}
          >
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
          <div
            className="w-full max-w-sm px-4 -mt-6 relative z-10"
            style={{
              opacity: dialogVisible ? 1 : 0,
              transition: 'opacity 0.25s ease',
            }}
          >
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
                <span
                  className="text-white text-[11px] font-bold tracking-wide"
                  style={{ fontFamily: 'sans-serif' }}
                >
                  Concrete 95
                </span>
              </div>

              <div className="px-2 pb-2">
                <p
                  className="text-black text-[11px] mb-2 h-4"
                  style={{ fontFamily: 'sans-serif' }}
                >
                  {WIN95_MESSAGES[msgIdx]}
                </p>

                {/* Chunky block progress bar */}
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
      )}
    </>
  );
}
