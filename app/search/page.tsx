'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Image from 'next/image';
import { toast } from 'sonner';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

type Pick = {
  id: string;
  title: string;
  url: string;
  channel: string;
  durationMs?: number;
  views?: number;
  thumbnailUrl?: string;
  reason?: string;
};

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Pick[]>([]);
  const [refined, setRefined] = useState<string | null>(null);
  const [candidatesCount, setCandidatesCount] = useState<number | null>(null);
  const createSearch = useMutation(api.users.createSearch);
  const upsertVideo = useMutation(api.users.upsertVideo);
  const createSelection = useMutation(api.users.createSelection);

  async function runSearch(q: string) {
    setLoading(true);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      if (!res.ok) throw new Error('Search failed');
      const data = (await res.json()) as {
        refinedQuery: string;
        candidatesCount: number;
        picks: Pick[];
      };
      setSubmittedQuery(q);
      setRefined(data.refinedQuery);
      setCandidatesCount(data.candidatesCount);
      setResults(data.picks);
    } catch {
      toast.error('Something went wrong running search');
    } finally {
      setLoading(false);
    }
  }

  async function onProceed(p: Pick) {
    try {
      // Persist selection in Convex
      const searchId = await createSearch({
        query: submittedQuery ?? query,
        refinedQuery: refined ?? submittedQuery ?? query,
        candidatesCount: candidatesCount ?? results.length,
      });
      const videoId = await upsertVideo({
        youtubeId: p.id,
        title: p.title,
        url: p.url,
        channel: p.channel,
        durationMs: p.durationMs,
        views: p.views,
        thumbnailUrl: p.thumbnailUrl,
      });
      await createSelection({ searchId, videoId, reason: p.reason });
      toast.success('Saved selection');
      // TODO: navigate to next page for transcript flow in future
    } catch {
      toast.error('Failed to save selection');
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div
        className={`sticky top-0 z-10 bg-background/80 backdrop-blur ${submittedQuery ? 'border-b' : ''}`}
      >
        <div className="container mx-auto px-4 py-6">
          <div className="mx-auto max-w-2xl">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const value = query.trim();
                if (!value) return;
                void runSearch(value);
              }}
              className="flex gap-2"
            >
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  submittedQuery
                    ? submittedQuery
                    : 'Search educational videos...'
                }
                disabled={loading}
              />
              <Button type="submit" disabled={loading}>
                {loading ? 'Searching…' : 'Search'}
              </Button>
            </form>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4">
        {results.length === 0 && !loading ? (
          <div className="mx-auto max-w-2xl text-center text-muted-foreground">
            Enter a topic and press Enter to search.
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {results.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <CardContent className="p-0">
                {p.thumbnailUrl ? (
                  <div className="relative aspect-video w-full">
                    <Image
                      src={p.thumbnailUrl}
                      alt={p.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : null}
                <div className="flex flex-col gap-2 p-4">
                  <div className="text-sm text-muted-foreground">
                    {p.channel}
                  </div>
                  <div className="font-medium leading-tight">{p.title}</div>
                  {p.reason ? (
                    <div className="text-sm text-muted-foreground">
                      {p.reason}
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between pt-2">
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm underline"
                    >
                      Open on YouTube
                    </a>
                    <Button size="sm" onClick={() => void onProceed(p)}>
                      Proceed
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
