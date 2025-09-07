'use client';

import { SkipForwardIcon } from 'lucide-react';
import { useVideoPlayer } from '@/components/player/VideoPlayerProvider';

type Props = {
  chapters: Array<{ title: string; startMs: number }>;
  chaptersSource?: 'description' | 'transcript' | null;
};

export default function ChaptersList({ chapters, chaptersSource }: Props) {
  const player = useVideoPlayer();

  const upcomingChapters = chapters.filter(
    (c) => c.startMs >= player.currentTimeMs,
  );

  const formatChapterTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  if (chapters.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/25 p-8 text-center">
        <div className="text-sm text-muted-foreground">
          No chapters available for this video
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="mb-4">
        <h3 className="font-medium text-sm text-muted-foreground mb-2">
          {chaptersSource === 'description'
            ? `${chapters.length} chapters`
            : `${upcomingChapters.length} upcoming chapters`}
        </h3>
        <div className="h-px bg-border" />
      </div>
      <div className="space-y-2">
        {(chaptersSource === 'description' ? chapters : upcomingChapters).map(
          (c, idx) => {
            const isCurrent =
              player.currentTimeMs >= c.startMs &&
              (idx === chapters.length - 1 ||
                player.currentTimeMs <
                  (chapters[chapters.indexOf(c) + 1]?.startMs ??
                    Number.POSITIVE_INFINITY));
            const isPast = player.currentTimeMs > c.startMs && !isCurrent;
            const nextChapter = chapters[chapters.indexOf(c) + 1];
            const chapterDuration = nextChapter
              ? nextChapter.startMs - c.startMs
              : player.durationMs - c.startMs;
            const progressPercent =
              isCurrent && chapterDuration > 0
                ? Math.min(
                    100,
                    ((player.currentTimeMs - c.startMs) / chapterDuration) *
                      100,
                  )
                : isPast
                  ? 100
                  : 0;

            return (
              <div
                key={`${c.startMs}-${idx}`}
                className={`group relative rounded-lg border p-3 transition-all hover:bg-accent/50 hover:border-accent-foreground/20 ${
                  isCurrent
                    ? 'border-primary/40 bg-primary/5 shadow-sm'
                    : isPast
                      ? 'border-muted-foreground/20 bg-muted/30'
                      : 'border-border bg-background'
                }`}
              >
                <button
                  type="button"
                  onClick={() => player.seekToMs(c.startMs)}
                  className="w-full text-left space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-mono px-2 py-1 rounded-md ${
                          isCurrent
                            ? 'bg-primary/20 text-primary font-medium'
                            : isPast
                              ? 'bg-muted text-muted-foreground'
                              : 'bg-accent text-accent-foreground'
                        }`}
                      >
                        {formatChapterTime(c.startMs)}
                      </span>
                      {isCurrent && (
                        <div className="flex items-center gap-1">
                          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                          <span className="text-xs text-primary font-medium">
                            Now playing
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <SkipForwardIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h4
                      className={`text-sm font-medium leading-tight line-clamp-2 ${
                        isCurrent ? 'text-foreground' : 'text-foreground/90'
                      }`}
                    >
                      {c.title}
                    </h4>
                    {chapterDuration > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {Math.round(chapterDuration / 60000)} min duration
                      </div>
                    )}
                  </div>
                  {(isCurrent || isPast) && (
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isCurrent ? 'bg-primary' : 'bg-muted-foreground'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  )}
                </button>
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}
