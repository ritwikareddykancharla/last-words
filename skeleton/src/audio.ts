/** Playback for any AudioRef, microphone recording, and waveform peaks. */

import type { AudioRef } from './pack';
import { getAudio } from './store';

/** Downsample to `n` bars of peak loudness, scaled so the loudest bar is 1. Silence stays 0. */
export function peaks(samples: ArrayLike<number>, n: number): number[] {
  if (n <= 0) return [];
  const out = new Array<number>(n).fill(0);
  const per = samples.length / n;
  for (let i = 0; i < n; i++) {
    const start = Math.floor(i * per);
    const end = Math.max(start + 1, Math.floor((i + 1) * per));
    let m = 0;
    for (let j = start; j < end && j < samples.length; j++) m = Math.max(m, Math.abs(samples[j] as number));
    out[i] = m;
  }
  const top = Math.max(...out);
  return top > 0 ? out.map((v) => v / top) : out;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

let ctx: AudioContext | null = null;
const audioCtx = () => (ctx ??= new AudioContext());

export async function blobPeaks(blob: Blob, n: number): Promise<number[] | null> {
  try {
    const buf = await audioCtx().decodeAudioData(await blob.arrayBuffer());
    return peaks(buf.getChannelData(0), n);
  } catch {
    return null;
  }
}

/** Safari can't play Ogg; Commons keeps an MP3 transcode we can fall back to. */
async function commonsMp3(url: string): Promise<string | null> {
  const m = /\/Special:FilePath\/(.+)$/.exec(url);
  if (!m) return null;
  const title = `File:${decodeURIComponent(m[1] as string)}`;
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=videoinfo&viprop=derivatives&titles=${encodeURIComponent(title)}`;
  const res = await fetch(api);
  if (!res.ok) return null;
  const data = (await res.json()) as { query?: { pages?: Record<string, { videoinfo?: { derivatives?: { src: string; type: string }[] }[] }> } };
  const pages = Object.values(data.query?.pages ?? {});
  const d = pages[0]?.videoinfo?.[0]?.derivatives?.find((x) => x.type.startsWith('audio/mpeg'));
  return d?.src ?? null;
}

let current: HTMLAudioElement | null = null;

function playSrc(src: string): Promise<void> {
  current?.pause();
  const el = new Audio(src);
  current = el;
  return new Promise((resolve, reject) => {
    el.onended = () => resolve();
    el.onerror = () => reject(new Error('This browser could not play the recording'));
    el.play().catch(reject);
  });
}

/** Play a recording; resolves when it ends. */
export async function playRef(ref: AudioRef): Promise<void> {
  if (ref.kind === 'url') {
    try {
      await playSrc(ref.url);
    } catch (err) {
      const mp3 = await commonsMp3(ref.url).catch(() => null);
      if (!mp3) throw err;
      await playSrc(mp3);
    }
    return;
  }
  if (ref.kind === 'data') return playSrc(ref.dataUrl);
  const blob = await getAudio(ref.key);
  if (!blob) throw new Error('This recording is missing from this browser');
  const url = URL.createObjectURL(blob);
  try {
    await playSrc(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function stopPlayback(): void {
  current?.pause();
}

export interface Recording {
  /** Live input level 0–1, for a meter. */
  level: () => number;
  stop: () => Promise<Blob>;
  cancel: () => void;
}

const MIME_PREFERENCE = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'];

export async function startRecording(maxMs = 10_000, onAutoStop?: () => void): Promise<Recording> {
  if (!window.isSecureContext) throw new Error('Recording needs a secure page (https:// or localhost).');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const mimeType = MIME_PREFERENCE.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t));
  const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  const ac = audioCtx();
  await ac.resume();
  const src = ac.createMediaStreamSource(stream);
  const analyser = ac.createAnalyser();
  analyser.fftSize = 1024;
  src.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);

  const finished = new Promise<Blob>((resolve) => {
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      src.disconnect();
      resolve(new Blob(chunks, { type: rec.mimeType || mimeType || 'audio/webm' }));
    };
  });
  rec.start(250);
  const timer = window.setTimeout(() => {
    if (rec.state === 'recording') {
      rec.stop();
      onAutoStop?.();
    }
  }, maxMs);

  return {
    level() {
      analyser.getFloatTimeDomainData(buf);
      let m = 0;
      for (const v of buf) m = Math.max(m, Math.abs(v));
      return Math.min(1, m * 1.6);
    },
    stop() {
      window.clearTimeout(timer);
      if (rec.state === 'recording') rec.stop();
      return finished;
    },
    cancel() {
      window.clearTimeout(timer);
      if (rec.state === 'recording') rec.stop();
    },
  };
}
