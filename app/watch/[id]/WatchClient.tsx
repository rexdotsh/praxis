'use client';

import YouTubePlayer from '@/components/player/YouTubePlayer';
import { Card, CardContent } from '@/components/ui/card';
import type { TranscriptItem } from '@/lib/youtube/transcript';
import VideoChat from '@/components/chat/VideoChat';
import { useEffect, useRef, useState } from 'react';
import { VideoPlayerProvider } from '@/components/player/VideoPlayerProvider';
import type { VideoPlayerContextValue } from '@/components/player/VideoPlayerProvider';

type Props = {
  videoId: string;
  title: string;
  channel: string;
  description?: string;
  uploadedAt?: string | null;
  views?: number | null;
  transcript: TranscriptItem[] | null;
};

export default function WatchClient({
  videoId,
  title,
  channel,
  description,
  uploadedAt,
  views,
  transcript,
}: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [chapters, setChapters] = useState<
    Array<{ title: string; startMs: number }>
  >([]);
  const [chaptersSource, setChaptersSource] = useState<
    'description' | 'transcript' | null
  >(null);
  const [_chapterWindow, setChapterWindow] = useState<{
    startMs: number;
    windowMs: number;
  } | null>(null);
  const lastRequestedStartRef = useRef<number | null>(null);
  const [playerCtx, setPlayerCtx] = useState<VideoPlayerContextValue>({
    videoId,
    status: 'unstarted',
    currentTimeMs: 0,
    durationMs: 0,
    playbackRate: 1,
    play: () => {},
    pause: () => {},
    seekToMs: () => {},
    setPlaybackRate: () => {},
  });

  const _formatChapterTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const transcriptSample = transcript
          ?.slice(0, 120)
          .map((t) => t.text)
          .join(' ');
        const r = await fetch('/api/suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, description, transcriptSample }),
        });
        const j = await r.json();
        if (mounted && Array.isArray(j.suggestions))
          setSuggestions(j.suggestions);
      } catch {}
    };
    load();
    return () => {
      mounted = false;
    };
  }, [title, description, transcript]);

  useEffect(() => {
    let mounted = true;
    const load = async (startMs?: number) => {
      if (!transcript || transcript.length === 0) return;
      try {
        const r = await fetch('/api/chapters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript,
            description,
            startMs,
            windowMs: 15 * 60 * 1000,
          }),
        });
        const j = await r.json();
        if (mounted && Array.isArray(j.chapters)) {
          setChapters(j.chapters);
          if (j.source === 'description' || j.source === 'transcript')
            setChaptersSource(j.source);
          if (
            j.window &&
            typeof j.window.startMs === 'number' &&
            typeof j.window.windowMs === 'number'
          )
            setChapterWindow(j.window);
        }
      } catch {}
    };
    load(0);
    return () => {
      mounted = false;
    };
  }, [transcript]);

  useEffect(() => {
    if (chaptersSource !== 'transcript') return;
    const upcoming = chapters.filter(
      (c) => c.startMs >= playerCtx.currentTimeMs,
    );
    if (upcoming.length <= 1) {
      const startAt = Math.max(0, playerCtx.currentTimeMs);
      const last = lastRequestedStartRef.current;
      if (last == null || Math.abs(startAt - last) > 30_000) {
        lastRequestedStartRef.current = startAt;
        (async () => {
          try {
            const r = await fetch('/api/chapters', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                transcript,
                description,
                startMs: startAt,
                windowMs: 15 * 60 * 1000,
              }),
            });
            const j = await r.json();
            if (Array.isArray(j.chapters)) {
              setChapters(j.chapters);
              if (
                j.window &&
                typeof j.window.startMs === 'number' &&
                typeof j.window.windowMs === 'number'
              )
                setChapterWindow(j.window);
            }
          } catch {}
        })();
      }
    }
  }, [
    playerCtx.currentTimeMs,
    chapters,
    chaptersSource,
    transcript,
    description,
  ]);

  useEffect(() => {
    if (chaptersSource !== 'description') return;
    if (!transcript || transcript.length === 0) return;
    const lastKnownStart = chapters.reduce(
      (max, c) => (c.startMs > max ? c.startMs : max),
      0,
    );
    if (playerCtx.currentTimeMs <= lastKnownStart) return;

    const startAt = Math.max(0, playerCtx.currentTimeMs);
    const last = lastRequestedStartRef.current;
    if (last != null && Math.abs(startAt - last) <= 30_000) return;
    lastRequestedStartRef.current = startAt;

    (async () => {
      try {
        const r = await fetch('/api/chapters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript,
            startMs: startAt,
            windowMs: 15 * 60 * 1000,
          }),
        });
        const j = await r.json();
        if (Array.isArray(j.chapters) && j.chapters.length) {
          setChapters((prev) => {
            const map = new Map<number, { title: string; startMs: number }>();
            for (const c of prev) map.set(c.startMs, c);
            for (const c of j.chapters) map.set(c.startMs, c);
            return Array.from(map.values()).sort(
              (a, b) => a.startMs - b.startMs,
            );
          });
          if (
            j.window &&
            typeof j.window.startMs === 'number' &&
            typeof j.window.windowMs === 'number'
          )
            setChapterWindow(j.window);
        }
      } catch {}
    })();
  }, [chaptersSource, playerCtx.currentTimeMs, transcript, chapters]);

  return (
    <VideoPlayerProvider value={playerCtx}>
      <div className="p-2 sm:p-4">
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-0">
          <div className="lg:pr-4">
            <div className="sticky top-4">
              {/* idk if we want p-0 here, this makes it flush */}
              <Card className="mb-4 shadow-sm py-0">
                <CardContent className="p-0">
                  <YouTubePlayer
                    videoId={videoId}
                    className="w-full"
                    useExternalProvider
                    onContextChange={setPlayerCtx}
                  />
                </CardContent>
              </Card>
              <div className="mb-4 px-1">
                <h1 className="text-2xl font-semibold leading-tight">
                  {title}
                </h1>
                <div className="mt-0 text-sm text-muted-foreground">
                  <span>{uploadedAt ?? ''}</span>
                  {typeof views === 'number' && (
                    <span>
                      {' • '}
                      {new Intl.NumberFormat(undefined, {
                        notation: 'compact',
                      }).format(views)}{' '}
                      views
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <aside className="lg:border-l lg:pl-4">
            <div className="sticky top-4">
              <Card className="shadow-sm py-0">
                <CardContent className="flex h-[calc(100vh-3rem)] flex-col p-3 sm:p-4">
                  <div className="min-h-0 flex-1 overflow-auto">
                    <VideoChat
                      transcript={transcript}
                      suggestions={suggestions}
                      chapters={chapters}
                      chaptersSource={chaptersSource}
                      title={title}
                      description={description}
                      channel={channel}
                      youtubeId={videoId}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </aside>
        </div>
      </div>
    </VideoPlayerProvider>
  );
}
