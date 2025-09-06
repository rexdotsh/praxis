import YouTube from 'youtube-sr';
import { fetchTranscript } from '@/lib/youtube/transcript';
import WatchClient from './WatchClient';

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
  // no-op: views and duration intentionally unused in current UI

  return (
    <WatchClient
      videoId={videoId}
      title={title}
      channel={channel}
      description={description}
      transcript={transcript}
    />
  );
}
