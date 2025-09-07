'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Image from 'next/image';
import { toast } from 'sonner';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

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
  const router = useRouter();
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
      router.push(`/watch/${p.id}`);
    } catch {
      toast.error('Failed to save selection');
    }
  }

  const hasResults = results.length > 0 || loading;

  return (
    <div className="min-h-screen">
      <div
        className={`transition-all duration-500 ${
          hasResults
            ? 'sticky top-0 z-10 bg-background border-b py-4'
            : 'flex items-center justify-center min-h-[80vh]'
        }`}
      >
        <div className="w-full max-w-2xl mx-auto px-6">
          {!hasResults && (
            <div className="text-center mb-12">
              <h1 className="text-6xl font-semibold mb-2 tracking-tight">
                Learn Anything
              </h1>
              <p className="text-lg text-muted-foreground">
                Search millions of educational videos
              </p>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const value = query.trim();
              if (!value) return;
              void runSearch(value);
            }}
            className="flex gap-3"
          >
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for anything..."
                disabled={loading}
                className={`pl-11 transition-all duration-300 ${
                  hasResults ? 'h-10' : 'h-14 text-lg'
                }`}
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className={hasResults ? 'h-10' : 'h-14'}
            >
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </form>

          {submittedQuery && candidatesCount && (
            <div className="mt-4 text-sm text-muted-foreground text-center">
              {candidatesCount.toLocaleString()} results
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {loading && (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {results.map((pick) => (
            <Card
              key={pick.id}
              className="overflow-hidden hover:shadow-md transition-shadow"
            >
              <CardContent className="p-0">
                {pick.thumbnailUrl && (
                  <div className="relative aspect-video">
                    <Image
                      src={pick.thumbnailUrl}
                      alt={pick.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 33vw"
                      unoptimized
                    />
                  </div>
                )}
                <div className="p-4 space-y-3">
                  <div className="text-xs text-muted-foreground">
                    {pick.channel}
                  </div>
                  <h3 className="font-medium leading-snug line-clamp-2">
                    {pick.title}
                  </h3>
                  {pick.reason && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {pick.reason}
                    </p>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="flex-1"
                    >
                      <a href={pick.url} target="_blank" rel="noreferrer">
                        YouTube
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void onProceed(pick)}
                      className="flex-1"
                    >
                      Select
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {!loading && results.length === 0 && submittedQuery && (
          <div className="text-center py-16 text-muted-foreground">
            No results found for "{submittedQuery}"
          </div>
        )}
      </div>

      <style jsx>{`
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}
