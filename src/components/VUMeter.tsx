
'use client';

import { useRef, useState, useEffect } from 'react';
import type { AudioEngineHandle } from './AudioEngine';

const SEGMENTS = 10;

// Win95-style segment colours: green → yellow → red
const litColor = (i: number) => {
  if (i < 6) return '#39FF14'; // green
  if (i < 8) return '#FFD700'; // yellow
  return '#FF4444';            // red
};

export default function VUMeter({
  audioEngineRef,
}: {
  audioEngineRef: React.RefObject<AudioEngineHandle>;
}) {
  const [litCount, setLitCount] = useState(0);
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    const tick = (time: number) => {
      // Poll at ~25fps — enough for responsive metering without thrashing React
      if (time - lastTimeRef.current > 40) {
        const db = audioEngineRef.current?.getMasterLevel() ?? -Infinity;
        // Map -60..0 dB → 0..SEGMENTS, clamped
        const count = isFinite(db)
          ? Math.min(SEGMENTS, Math.round(Math.max(0, (db + 60) / 60) * SEGMENTS))
          : 0;
        setLitCount(count);
        lastTimeRef.current = time;
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [audioEngineRef]);

  return (
    <div className="flex gap-px items-center" aria-label="VU meter">
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <div
          key={i}
          style={{
            width: 5,
            height: 14,
            backgroundColor: i < litCount ? litColor(i) : '#3a3a3a',
            border: '1px solid #222',
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
}
