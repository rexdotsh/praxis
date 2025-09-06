'use client';

import YouTubePlayer from '@/components/player/YouTubePlayer';
import { Card, CardContent } from '@/components/ui/card';
import type { TranscriptItem } from '@/lib/youtube/transcript';
import VideoChat from '@/components/chat/VideoChat';
import { useEffect, useState } from 'react';

type Props = {
  videoId: string;
  title: string;
  channel: string;
  description?: string;
  transcript: TranscriptItem[] | null;
};

export default function WatchClient({
  videoId,
  title,
  channel,
  description,
  transcript,
}: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [chapters, setChapters] = useState<
    Array<{ title: string; startMs: number }>
  >([]);

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
    const load = async () => {
      if (!transcript || transcript.length === 0) return;
      try {
        const r = await fetch('/api/chapters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript }),
        });
        const j = await r.json();
        if (mounted && Array.isArray(j.chapters)) setChapters(j.chapters);
      } catch {}
    };
    load();
    return () => {
      mounted = false;
    };
  }, [transcript]);

  return (
    <div className="p-2 sm:p-4">
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-0">
        <div className="lg:pr-4">
          <div className="sticky top-4">
            {/* idk if we want p-0 here, this makes it flush */}
            <Card className="mb-4 shadow-sm py-0">
              <CardContent className="p-0">
                <YouTubePlayer videoId={videoId} className="w-full" />
              </CardContent>
            </Card>
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
  );
}
