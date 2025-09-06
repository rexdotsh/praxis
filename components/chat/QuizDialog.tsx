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
      <DialogContent className="sm:max-w-lg">
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

        {step === 'generating' && <div className="py-4">Generating quiz…</div>}

        {step === 'quiz' && nextQ && (
          <>
            <div className="mb-3 text-sm">
              Question {nextQ.index + 1} / {nextQ.total}
              <Progress
                className="mt-1"
                value={(progress.answered / progress.total) * 100}
              />
            </div>
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="font-medium">{nextQ.prompt}</div>
                <div className="space-y-2">
                  {nextQ.options.map((opt, i) => (
                    <label
                      key={`${nextQ._id}-${i}`}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="radio"
                        name="quiz-option"
                        checked={selected === i}
                        onChange={() => setSelected(i)}
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
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
            <div className="space-y-2">
              {results.details.map((d: any) => {
                const isWrong = d.selectedIndex !== d.correctIndex;
                return (
                  <Collapsible
                    key={String(d.questionId)}
                    defaultOpen={isWrong}
                    className="rounded border"
                  >
                    <CollapsibleTrigger className="px-3 py-2 w-full text-left">
                      <div className="text-left">
                        <div className="font-medium">{d.prompt}</div>
                        <div className="text-xs text-muted-foreground">
                          {isWrong ? 'Incorrect' : 'Correct'}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-3 pb-3">
                      <div className="space-y-1 text-sm">
                        {d.options.map((o: string, i: number) => (
                          <div
                            key={`${d.questionId}-${i}`}
                            className={
                              i === d.correctIndex ? 'font-medium' : ''
                            }
                          >
                            {i + 1}. {o}
                            {i === d.selectedIndex ? ' (your answer)' : ''}
                            {i === d.correctIndex ? ' (correct)' : ''}
                          </div>
                        ))}
                        {d.explanation ? (
                          <div className="mt-2 text-xs text-muted-foreground">
                            {d.explanation}
                          </div>
                        ) : null}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Close</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
