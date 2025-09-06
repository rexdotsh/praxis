import { YouTubeEmbed } from '@next/third-parties/google';
import YouTube from 'youtube-sr';
import { fetchTranscript } from '@/lib/youtube/transcript';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

type Props = { params: { id: string } };

export default async function WatchPage({ params }: Props) {
  const { id: videoId } = await params;

  // Fetch metadata
  const video = await YouTube.getVideo(
    `https://www.youtube.com/watch?v=${videoId}`,
  ).catch(() => null);

  // Fetch transcript (best-effort)
  const transcript = await fetchTranscript(videoId).catch(() => null);

  const description = video?.description ?? '';
  const title = video?.title ?? 'YouTube Video';
  const channel = video?.channel?.name ?? '';
  const views = typeof video?.views === 'number' ? video?.views : undefined;
  const duration = video?.durationFormatted ?? '';

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="container mx-auto grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-0">
              <div className="w-full">
                <YouTubeEmbed
                  videoid={videoId}
                  style="width: 100%; aspect-ratio: 16/9;"
                />
              </div>
            </CardContent>
          </Card>
          <div className="mt-4 space-y-2">
            <h1 className="text-2xl font-semibold leading-tight">{title}</h1>
            <div className="text-sm text-muted-foreground">
              {channel}
              {views ? ` • ${views.toLocaleString()} views` : ''}
              {duration ? ` • ${duration}` : ''}
            </div>
            {description ? (
              <div className="prose prose-invert max-w-none whitespace-pre-wrap text-sm">
                {description}
              </div>
            ) : null}
          </div>
        </div>
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-4">
              <div className="mb-2 font-medium">Transcript</div>
              <Separator className="mb-2" />
              <div className="max-h-[600px] space-y-2 overflow-auto pr-2 text-sm">
                {transcript ? (
                  transcript.map((t) => (
                    <div
                      key={`${t.startMs}-${t.durationMs}`}
                      className="leading-relaxed"
                    >
                      {t.text}
                    </div>
                  ))
                ) : (
                  <div className="text-muted-foreground">
                    Transcript unavailable.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
