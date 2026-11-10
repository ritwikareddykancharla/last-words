/** Small UI pieces every Last Words app can reuse. Styling comes from each app's own CSS. */

import { useEffect, useState } from 'react';
import { playRef, stopPlayback } from './audio';
import type { AudioRef } from './pack';

export function PlayButton({ audio, label = 'Play', className = '', autoPlayKey }: { audio?: AudioRef; label?: string; className?: string; autoPlayKey?: string }) {
  const [state, setState] = useState<'idle' | 'playing' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function play(auto = false) {
    if (!audio) return;
    setState('playing');
    try {
      await playRef(audio);
      setState('idle');
    } catch (err) {
      // A blocked autoplay isn't an error; the user can still press play.
      if (auto) return setState('idle');
      setState('error');
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  // Replay automatically whenever the key changes (a new word), once the user has interacted.
  useEffect(() => {
    if (autoPlayKey && audio && navigator.userActivation?.hasBeenActive !== false) void play(true);
    return () => stopPlayback();
  }, [autoPlayKey]);

  if (!audio) return null;
  return (
    <span className="play-wrap">
      <button type="button" className={`play ${state} ${className}`} onClick={() => void play()} aria-label={label} title={state === 'error' ? message : label}>
        <span aria-hidden="true">{state === 'playing' ? '◼' : '▶'}</span>
        <span className="play-label">{label}</span>
      </button>
      {state === 'error' && (
        <span className="play-error" role="alert">
          {message}
        </span>
      )}
    </span>
  );
}

export function Waveform({ peaks, className = '' }: { peaks: number[] | null; className?: string }) {
  if (!peaks) return null;
  return (
    <svg className={`waveform ${className}`} viewBox={`0 0 ${peaks.length * 3} 24`} preserveAspectRatio="none" aria-hidden="true">
      {peaks.map((p, i) => {
        const h = Math.max(1, p * 22);
        return <rect key={i} x={i * 3} y={12 - h / 2} width={2} height={h} rx={1} />;
      })}
    </svg>
  );
}
