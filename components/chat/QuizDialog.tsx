'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2Icon, ChevronDownIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

type Props = {
  youtubeId: string;
  transcriptContextBuilder: (minutes: number) => string;
  hasChapters: boolean;
  latestChapterStartMs?: number | null;
  hasFiveMinutesPlayed?: boolean;
  minutesSinceChapterStart?: number;
  meta?: { title?: string; description?: string; channel?: string };
  trigger?: React.ReactNode;
};

type NextQ = {
  _id: string;
  prompt: string;
  options: string[];
  index: number;
  total: number;
} | null;

export default function QuizDialog({
  youtubeId,
  transcriptContextBuilder,
  hasChapters,
  latestChapterStartMs,
  hasFiveMinutesPlayed,
  minutesSinceChapterStart,
  meta,
  trigger,
}: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'setup' | 'generating' | 'quiz' | 'results'>(
    'setup',
  );
  const [scope, setScope] = useState<'minutes' | 'chapter'>('minutes');
  const [minutes, setMinutes] = useState<number>(10);
  const [numQuestions, setNumQuestions] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>(
    'medium',
  );

  const [quizId, setQuizId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [nextQ, setNextQ] = useState<NextQ>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ answered: number; total: number }>(
    { answered: 0, total: 0 },
  );
  const [results, setResults] = useState<any | null>(null);

  useEffect(() => {
    if (!open) {
      setStep('setup');
      setQuizId(null);
      setSessionId(null);
      setNextQ(null);
      setSelected(null);
      setProgress({ answered: 0, total: 0 });
      setResults(null);
    }
  }, [open]);

  const canGenerate = useMemo(() => {
    if (scope === 'minutes')
      return (hasFiveMinutesPlayed ?? false) && minutes >= 3 && minutes <= 30;
    const minsSinceChapter = minutesSinceChapterStart ?? 0;
    return (
      hasChapters && (latestChapterStartMs ?? -1) >= 0 && minsSinceChapter >= 5
    );
  }, [
    scope,
    minutes,
    hasChapters,
    latestChapterStartMs,
    hasFiveMinutesPlayed,
    minutesSinceChapterStart,
  ]);

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setStep('generating');
    const transcriptContext =
      scope === 'minutes'
        ? transcriptContextBuilder(minutes)
        : transcriptContextBuilder(Math.max(5, minutesSinceChapterStart ?? 0));
    const r = await fetch('/api/quiz/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        youtubeId,
        model: 'openai/gpt-4.1-mini',
        transcriptContext,
        contextSpec: {
          type: scope,
          value:
            scope === 'minutes'
              ? minutes
              : Math.max(5, minutesSinceChapterStart ?? 0),
        },
        numQuestions,
        choicesCount: 4,
        difficulty,
        meta,
      }),
    });
    const j = await r.json();
    if (!r.ok) {
      setStep('setup');
      return;
    }
    setQuizId(j.quizId);
    setSessionId(j.sessionId);
    setProgress({ answered: 0, total: j.total });
    setStep('quiz');
    await loadNext(j.sessionId, j.quizId);
  };

  const loadNext = async (sessionId: string, quizId: string) => {
    const r = await fetch('/api/quiz/next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, quizId }),
    });
    const j = await r.json();
    setNextQ(j);
    setSelected(null);
  };

  const submitAnswer = async () => {
    if (!sessionId || !nextQ || selected == null) return;
    try {
      const r = await fetch('/api/quiz/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          questionId: nextQ._id,
          selectedIndex: selected,
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j || !j.progress) {
        setStep('setup');
        return;
      }
      setProgress(j.progress);
      if (j.progress.answered >= j.progress.total) {
        const rf = await fetch('/api/quiz/finish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
        const res = await rf.json();
        setResults(res);
        setStep('results');
      } else if (quizId && sessionId) {
        await loadNext(sessionId, quizId);
      }
    } catch {
      setStep('setup');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        className={`sm:max-w-lg${step === 'results' ? ' my-6' : ''}`}
      >
        {step === 'setup' && (
          <>
            <DialogHeader>
              <DialogTitle>Generate quiz</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Scope</Label>
                <Select value={scope} onValueChange={(v) => setScope(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minutes">Last N minutes</SelectItem>
                    {hasChapters ? (
                      <SelectItem value="chapter">Last chapter</SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
              </div>
              {scope === 'minutes' && (
                <div className="space-y-2">
                  <Label>Minutes</Label>
                  <Input
                    type="number"
                    min={3}
                    max={30}
                    value={minutes}
                    onChange={(e) => setMinutes(Number(e.target.value))}
                    disabled={!hasFiveMinutesPlayed}
                  />
                  {!hasFiveMinutesPlayed && (
                    <div className="text-xs text-muted-foreground">
                      Start the video and watch at least 5 minutes to enable
                      transcript context.
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Questions</Label>
                  <Input
                    type="number"
                    min={3}
                    max={10}
                    value={numQuestions}
                    onChange={(e) => setNumQuestions(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Difficulty</Label>
                  <Select
                    value={difficulty}
                    onValueChange={(v) => setDifficulty(v as any)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleGenerate} disabled={!canGenerate}>
                Generate quiz
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'generating' && (
          <div className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" />
                <span>Generating {numQuestions} questions</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Difficulty: {difficulty}
              </div>
            </div>
            <div className="mt-3 rounded border p-3 text-xs text-muted-foreground">
              <div className="font-medium text-foreground text-sm">
                {meta?.title ?? 'Untitled video'}
              </div>
              <div className="mt-1">
                Scope:{' '}
                {scope === 'minutes'
                  ? `Last ${minutes} minutes`
                  : `Last chapter (~${Math.max(5, minutesSinceChapterStart ?? 0)} min)`}
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {[0, 1].map((i) => (
                <Card key={`sk-${i}`} className="py-0">
                  <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-4 w-3/5" />
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4 rounded-full" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4 rounded-full" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4 rounded-full" />
                        <Skeleton className="h-3 w-3/5" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4 rounded-full" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              This usually takes up to 10 seconds.
            </div>
          </div>
        )}

        {step === 'quiz' && nextQ && (
          <>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm">
                Question {nextQ.index + 1} / {nextQ.total}
                <Progress
                  className="mt-1"
                  value={
                    progress.total > 0
                      ? (progress.answered / progress.total) * 100
                      : 0
                  }
                />
              </div>
              <Badge variant="secondary">{difficulty}</Badge>
            </div>
            <Card className="py-0">
              <CardContent className="p-4 space-y-3">
                <div className="font-medium text-base leading-relaxed">
                  {nextQ.prompt}
                </div>
                <div className="grid gap-2">
                  {nextQ.options.map((opt, i) => {
                    const isSelected = selected === i;
                    return (
                      <button
                        type="button"
                        key={`${nextQ._id}-${i}`}
                        onClick={() => setSelected(i)}
                        className={`w-full text-left rounded-md border p-3 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 hover:bg-accent ${
                          isSelected
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                            : 'border-border'
                        }`}
                        aria-pressed={isSelected}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                              isSelected ? 'border-primary text-primary' : ''
                            }`}
                          >
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span>{opt}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
            <DialogFooter>
              <Button onClick={submitAnswer} disabled={selected == null}>
                {progress.answered + 1 >= progress.total ? 'Finish' : 'Next'}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'results' && results && (
          <>
            <DialogHeader>
              <DialogTitle>Results</DialogTitle>
            </DialogHeader>
            <div className="mb-3 text-sm">
              Score: {results.correct} / {results.total}
            </div>
            <ScrollArea className="max-h-[65vh] pr-2">
              <div className="space-y-2 pb-2">
                {results.details.map((d: any) => {
                  const isWrong = d.selectedIndex !== d.correctIndex;
                  return (
                    <Card
                      key={String(d.questionId)}
                      className={`border-l-4 py-2 hover:bg-accent/50 transition-colors duration-200 group ${
                        isWrong ? 'border-l-destructive' : 'border-l-primary'
                      }`}
                    >
                      <Collapsible defaultOpen={isWrong}>
                        <CollapsibleTrigger className="px-3 py-2 w-full text-left">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-left flex-1">
                              <div className="font-medium group-hover:text-accent-foreground">
                                {d.prompt}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={isWrong ? 'destructive' : 'secondary'}
                              >
                                {isWrong ? 'Incorrect' : 'Correct'}
                              </Badge>
                              <ChevronDownIcon className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="px-4 pb-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-1 data-[state=open]:slide-in-from-top-1 duration-200">
                          <div className="space-y-2">
                            {d.options.map((o: string, i: number) => {
                              const isCorrect = i === d.correctIndex;
                              const isUserAnswer = d.selectedIndex === i;
                              return (
                                <div
                                  key={`${d.questionId}-${i}`}
                                  className={`rounded-md px-3 py-2 text-sm ${
                                    isCorrect
                                      ? 'bg-emerald-100 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-800/50 dark:text-emerald-200'
                                      : isUserAnswer && isWrong
                                        ? 'bg-destructive/10 border border-destructive/20 text-destructive'
                                        : 'bg-muted/50'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium ${
                                        isCorrect
                                          ? 'bg-emerald-600 text-white'
                                          : isUserAnswer && isWrong
                                            ? 'bg-destructive text-white'
                                            : 'bg-muted text-muted-foreground'
                                      }`}
                                    >
                                      {String.fromCharCode(65 + i)}
                                    </span>
                                    <span className="flex-1">{o}</span>
                                    <div className="flex gap-2 text-xs">
                                      {isUserAnswer && (
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] px-1 py-0"
                                        >
                                          Your answer
                                        </Badge>
                                      )}
                                      {isCorrect && (
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] px-1 py-0 border-emerald-300 text-emerald-700"
                                        >
                                          Correct
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            {d.explanation && (
                              <div className="mt-3 p-3 rounded-md bg-muted/30 border border-muted text-xs text-muted-foreground animate-in fade-in-0 slide-in-from-top-1 duration-300">
                                <div className="font-medium mb-1 text-foreground">
                                  Explanation
                                </div>
                                {d.explanation}
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Close</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
