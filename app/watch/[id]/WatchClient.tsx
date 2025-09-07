'use client';

import YouTubePlayer from '@/components/player/YouTubePlayer';
import { Card, CardContent } from '@/components/ui/card';
import type { TranscriptItem } from '@/lib/youtube/transcript';
import VideoChat from '@/components/chat/VideoChat';
import { useEffect, useRef, useState } from 'react';
import { VideoPlayerProvider } from '@/components/player/VideoPlayerProvider';
import type { VideoPlayerContextValue } from '@/components/player/VideoPlayerProvider';
import { PromptInputButton } from '@/components/ai-elements/prompt-input';
import QuizDialog from '@/components/chat/QuizDialog';
import { getWindowByMinutes } from '@/lib/transcript/window';

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

  const minPastMs = 5 * 60 * 1000;
  const hasFiveMinutesPlayed = playerCtx.currentTimeMs >= minPastMs;
  const latestChapterStartMs =
    chapters
      .slice()
      .reverse()
      .find((c) => c.startMs <= playerCtx.currentTimeMs)?.startMs ?? undefined;
  const minutesSinceChapterStart =
    latestChapterStartMs == null
      ? 0
      : Math.max(
          0,
          Math.floor((playerCtx.currentTimeMs - latestChapterStartMs) / 60000),
        );

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
    const fetchInitialChapters = async () => {
      if (!transcript || transcript.length === 0) return;
      try {
        const r = await fetch('/api/chapters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript,
            description,
            startMs: 0,
            windowMs: 15 * 60 * 1000,
          }),
        });
        const j = await r.json();
        if (!mounted || !Array.isArray(j.chapters)) return;
        const sorted = [...j.chapters].sort((a, b) => a.startMs - b.startMs);
        setChapters(sorted);
        if (j.source === 'description' || j.source === 'transcript') {
          setChaptersSource(j.source);
        }
      } catch {}
    };
    fetchInitialChapters();
    return () => {
      mounted = false;
    };
  }, [transcript, description]);

  useEffect(() => {
    if (!transcript || transcript.length === 0) return;
    const currentMs = playerCtx.currentTimeMs;
    const upcomingCount = chapters.filter((c) => c.startMs >= currentMs).length;

    const lastKnownStart = chapters.reduce(
      (max, c) => (c.startMs > max ? c.startMs : max),
      0,
    );

    const needsMore =
      chaptersSource === 'transcript'
        ? upcomingCount <= 1
        : chaptersSource === 'description'
          ? currentMs > lastKnownStart
          : false;

    if (!needsMore) return;

    const startAt = Math.max(0, currentMs);
    const last = lastRequestedStartRef.current;
    if (last != null && Math.abs(startAt - last) <= 30_000) return;
    lastRequestedStartRef.current = startAt;

    let cancelled = false;
    const fetchMoreChapters = async () => {
      try {
        const r = await fetch('/api/chapters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript,
            // Intentionally omit description to avoid re-parsing description-based chapters
            startMs: startAt,
            windowMs: 15 * 60 * 1000,
          }),
        });
        const j = await r.json();
        if (cancelled || !Array.isArray(j.chapters) || j.chapters.length === 0)
          return;
        setChapters((prev) => {
          const map = new Map<number, { title: string; startMs: number }>();
          for (const c of prev) map.set(c.startMs, c);
          for (const c of j.chapters) map.set(c.startMs, c);
          return Array.from(map.values()).sort((a, b) => a.startMs - b.startMs);
        });
      } catch {}
    };
    fetchMoreChapters();
    return () => {
      cancelled = true;
    };
  }, [transcript, chapters, chaptersSource, playerCtx.currentTimeMs]);

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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <h1 className="text-2xl font-semibold leading-tight min-w-0 sm:max-w-[75%]">
                    {title}
                  </h1>
                  <div className="mt-1 flex w-full flex-col gap-2 sm:mt-0 sm:w-auto sm:flex-row sm:items-center sm:pl-2">
                    {!!videoId && !!transcript && (
                      <QuizDialog
                        youtubeId={videoId}
                        hasChapters={chapters.length > 0}
                        latestChapterStartMs={latestChapterStartMs}
                        hasFiveMinutesPlayed={hasFiveMinutesPlayed}
                        minutesSinceChapterStart={minutesSinceChapterStart}
                        meta={{ title, description, channel }}
                        transcriptContextBuilder={(mins: number) =>
                          getWindowByMinutes(
                            transcript ?? [],
                            playerCtx.currentTimeMs,
                            mins,
                          ).text
                        }
                        trigger={
                          <PromptInputButton
                            className="h-10 w-full px-6 text-sm sm:w-auto sm:text-base"
                            size="default"
                            variant="default"
                          >
                            Quiz
                          </PromptInputButton>
                        }
                      />
                    )}
                    <div className="w-full sm:w-auto">
                      <PromptInputButton
                        className="h-10 w-full px-6 text-sm sm:w-auto sm:text-base"
                        size="default"
                        variant="outline"
                      >
                        Flashcards
                      </PromptInputButton>
                    </div>
                  </div>
                </div>
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
