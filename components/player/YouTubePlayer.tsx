'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import YouTubePlayerPlus from 'youtube-player-plus';
import { VideoPlayerProvider } from './VideoPlayerProvider';

type Props = {
  videoId: string;
  className?: string;
};

export default function YouTubePlayer({ videoId, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayerPlus | null>(null);
  const [status, setStatus] = useState<
    'unstarted' | 'playing' | 'paused' | 'buffering' | 'ended' | 'cued'
  >('unstarted');
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    if (!containerRef.current) return;
    const player = new YouTubePlayerPlus(containerRef.current, {
      width: 1280,
      height: 720,
      playsInline: true,
      host: 'https://www.youtube-nocookie.com',
      timeUpdateFrequency: 300,
    });
    playerRef.current = player;

    player.on('ready', () => {
      const d = player.duration ?? player.getDuration?.();
      if (typeof d === 'number' && Number.isFinite(d)) setDurationMs(d * 1000);
    });
    player.on('cued', () => setStatus('cued'));
    player.on('playing', () => setStatus('playing'));
    player.on('paused', () => setStatus('paused'));
    player.on('buffering', () => setStatus('buffering'));
    player.on('ended', () => setStatus('ended'));
    player.on('timeupdate', (sec: number) =>
      setCurrentTimeMs(Math.max(0, Math.round(sec * 1000))),
    );
    player.on('playbackRateChange', (rate: number) => setPlaybackRate(rate));

    player.load(videoId);

    // Responsive sizing to keep 16:9 while filling container width
    const resize = () => {
      const el = containerRef.current;
      if (!el) return;
      const width = el.clientWidth;
      const height = Math.round((width * 9) / 16);
      try {
        player.setSize(width, height);
      } catch {}
      // Set container height to match for smooth aspect scaling
      el.style.height = `${height}px`;
    };
    resize();
    let ro: ResizeObserver | null = null;
    if (typeof window !== 'undefined' && 'ResizeObserver' in window) {
      ro = new ResizeObserver(() => resize());
      if (containerRef.current) ro.observe(containerRef.current);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', resize);
    }

    return () => {
      try {
        player.destroy();
      } catch {}
      playerRef.current = null;
      if (ro) ro.disconnect();
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', resize);
      }
    };
  }, [videoId]);

  const value = useMemo(
    () => ({
      videoId,
      status,
      currentTimeMs,
      durationMs,
      playbackRate,
      play: () => playerRef.current?.play(),
      pause: () => playerRef.current?.pause(),
      seekToMs: (ms: number) => playerRef.current?.seek(ms / 1000),
      setPlaybackRate: (rate: number) =>
        playerRef.current?.setPlaybackRate(rate),
    }),
    [videoId, status, currentTimeMs, durationMs, playbackRate],
  );

  return (
    <VideoPlayerProvider value={value}>
      <div ref={containerRef} className={className} />
    </VideoPlayerProvider>
  );
}
