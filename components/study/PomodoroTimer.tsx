'use client';

import { useEffect, useState } from 'react';

export type PomodoroSettings = {
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  cyclesBeforeLongBreak: number;
  autoStartNext: boolean;
};

type PomodoroPhase = 'work' | 'short' | 'long';

type PomodoroState = {
  settings: PomodoroSettings;
  phase: PomodoroPhase;
  cycleCount: number; // completed work sessions
  running: boolean;
  startTimestamp: number; // ms, when current phase started
  pausedRemainingMs?: number; // if paused, remaining in current phase
} | null;

function PomodoroSettingsForm({
  initial,
  onSubmit,
}: {
  initial?: PomodoroSettings;
  onSubmit: (s: PomodoroSettings) => void;
}) {
  const [workMinutes, setWorkMinutes] = useState<number>(
    initial?.workMinutes ?? 25,
  );
  const [shortBreakMinutes, setShortBreakMinutes] = useState<number>(
    initial?.shortBreakMinutes ?? 5,
  );
  const [longBreakMinutes, setLongBreakMinutes] = useState<number>(
    initial?.longBreakMinutes ?? 15,
  );
  const [cyclesBeforeLongBreak, setCyclesBeforeLongBreak] = useState<number>(
    initial?.cyclesBeforeLongBreak ?? 4,
  );
  const [autoStartNext, setAutoStartNext] = useState<boolean>(
    initial?.autoStartNext ?? false,
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      workMinutes: Math.max(1, Math.floor(workMinutes)),
      shortBreakMinutes: Math.max(1, Math.floor(shortBreakMinutes)),
      longBreakMinutes: Math.max(1, Math.floor(longBreakMinutes)),
      cyclesBeforeLongBreak: Math.max(1, Math.floor(cyclesBeforeLongBreak)),
      autoStartNext,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
      <p className="col-span-2 text-xs text-muted-foreground">
        Set your Pomodoro preferences
      </p>
      <div className="flex flex-col gap-1">
        <span className="text-xs">Work (minutes)</span>
        <input
          type="number"
          min={1}
          className="rounded border px-2 py-1"
          value={workMinutes}
          onChange={(e) => setWorkMinutes(Number(e.target.value))}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs">Short break (minutes)</span>
        <input
          type="number"
          min={1}
          className="rounded border px-2 py-1"
          value={shortBreakMinutes}
          onChange={(e) => setShortBreakMinutes(Number(e.target.value))}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs">Long break (minutes)</span>
        <input
          type="number"
          min={1}
          className="rounded border px-2 py-1"
          value={longBreakMinutes}
          onChange={(e) => setLongBreakMinutes(Number(e.target.value))}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs">Cycles before long break</span>
        <input
          type="number"
          min={1}
          className="rounded border px-2 py-1"
          value={cyclesBeforeLongBreak}
          onChange={(e) => setCyclesBeforeLongBreak(Number(e.target.value))}
        />
      </div>
      <div className="col-span-2 flex items-center gap-2">
        <input
          id="autoStartNext"
          type="checkbox"
          className="size-4"
          checked={autoStartNext}
          onChange={(e) => setAutoStartNext(e.target.checked)}
        />
        <label htmlFor="autoStartNext" className="text-xs">
          Auto-start next phase
        </label>
      </div>
      <div className="col-span-2 mt-1 flex items-center gap-2">
        <button
          type="submit"
          className="rounded bg-primary px-3 py-1.5 text-primary-foreground hover:opacity-90"
        >
          Start
        </button>
      </div>
    </form>
  );
}

export default function PomodoroTimer() {
  const [pomodoroState, setPomodoroState] = useState<PomodoroState>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('pomodoroState');
      if (raw) return JSON.parse(raw) as PomodoroState;
    } catch {}
    return null;
  });
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [showSettings, setShowSettings] = useState<boolean>(false);

  const getPhaseDurationMs = (s: PomodoroState): number => {
    if (!s) return 0;
    switch (s.phase) {
      case 'work':
        return s.settings.workMinutes * 60 * 1000;
      case 'short':
        return s.settings.shortBreakMinutes * 60 * 1000;
      case 'long':
        return s.settings.longBreakMinutes * 60 * 1000;
    }
  };

  const computeRemainingMs = (s: PomodoroState, at: number): number => {
    if (!s) return 0;
    const total = getPhaseDurationMs(s);
    if (!s.running) return s.pausedRemainingMs ?? total;
    return Math.max(0, total - (at - s.startTimestamp));
  };

  const formatMs = (ms: number): string => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  // Tick once per second when a pomodoro exists to update display and handle transitions
  useEffect(() => {
    if (!pomodoroState) return;
    const id = setInterval(() => {
      setNowMs(Date.now());
      setPomodoroState((curr) => {
        if (!curr || !curr.running) return curr;
        const remaining = computeRemainingMs(curr, Date.now());
        if (remaining > 0) return curr;
        // transition to next phase
        const newCycleCount =
          curr.phase === 'work' ? curr.cycleCount + 1 : curr.cycleCount;
        let nextPhase: PomodoroPhase;
        if (curr.phase === 'work') {
          nextPhase =
            newCycleCount % curr.settings.cyclesBeforeLongBreak === 0
              ? 'long'
              : 'short';
        } else {
          nextPhase = 'work';
        }
        const nextDuration = (() => {
          switch (nextPhase) {
            case 'work':
              return curr.settings.workMinutes * 60 * 1000;
            case 'short':
              return curr.settings.shortBreakMinutes * 60 * 1000;
            case 'long':
              return curr.settings.longBreakMinutes * 60 * 1000;
          }
        })();
        if (curr.settings.autoStartNext) {
          return {
            ...curr,
            phase: nextPhase,
            cycleCount: newCycleCount,
            running: true,
            startTimestamp: Date.now(),
            pausedRemainingMs: undefined,
          };
        }
        return {
          ...curr,
          phase: nextPhase,
          cycleCount: newCycleCount,
          running: false,
          startTimestamp: curr.startTimestamp,
          pausedRemainingMs: nextDuration,
        };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [pomodoroState]);

  // Persist to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (pomodoroState) {
        localStorage.setItem('pomodoroState', JSON.stringify(pomodoroState));
      } else {
        localStorage.removeItem('pomodoroState');
      }
    } catch {}
  }, [pomodoroState]);

  const startPomodoro = (settings: PomodoroSettings) => {
    setPomodoroState({
      settings,
      phase: 'work',
      cycleCount: 0,
      running: true,
      startTimestamp: Date.now(),
      pausedRemainingMs: undefined,
    });
    setShowSettings(false);
  };

  const pausePomodoro = () => {
    setPomodoroState((curr) => {
      if (!curr || !curr.running) return curr;
      return {
        ...curr,
        running: false,
        pausedRemainingMs: computeRemainingMs(curr, Date.now()),
      };
    });
  };

  const resumePomodoro = () => {
    setPomodoroState((curr) => {
      if (!curr || curr.running) return curr;
      const total = getPhaseDurationMs(curr);
      const paused = curr.pausedRemainingMs ?? total;
      const adjustedStart = Date.now() - (total - paused);
      return {
        ...curr,
        running: true,
        startTimestamp: adjustedStart,
        pausedRemainingMs: undefined,
      };
    });
  };

  const resetPomodoro = () => {
    setPomodoroState((curr) => {
      if (!curr) return curr;
      const full = curr.settings.workMinutes * 60 * 1000;
      return {
        ...curr,
        phase: 'work',
        cycleCount: 0,
        running: false,
        startTimestamp: Date.now(),
        pausedRemainingMs: full,
      };
    });
  };

  return (
    <div className="rounded-md border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">Pomodoro</h3>
        {pomodoroState && (
          <button
            type="button"
            className="text-xs underline underline-offset-2 hover:opacity-80"
            onClick={() => setShowSettings((s) => !s)}
          >
            {showSettings ? 'Close settings' : 'Edit settings'}
          </button>
        )}
      </div>

      {!pomodoroState || showSettings ? (
        <PomodoroSettingsForm
          initial={pomodoroState?.settings}
          onSubmit={startPomodoro}
        />
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {pomodoroState.phase === 'work'
              ? 'Focus'
              : pomodoroState.phase === 'short'
                ? 'Short Break'
                : 'Long Break'}
          </div>
          <div className="text-5xl tabular-nums">
            {formatMs(computeRemainingMs(pomodoroState, nowMs))}
          </div>
          <div className="text-xs text-muted-foreground">
            Cycles completed: {pomodoroState.cycleCount}
          </div>
          <div className="mt-2 flex items-center gap-2">
            {pomodoroState.running ? (
              <button
                type="button"
                className="rounded bg-primary px-3 py-1.5 text-primary-foreground hover:opacity-90"
                onClick={pausePomodoro}
              >
                Pause
              </button>
            ) : (
              <button
                type="button"
                className="rounded bg-primary px-3 py-1.5 text-primary-foreground hover:opacity-90"
                onClick={resumePomodoro}
              >
                Resume
              </button>
            )}
            <button
              type="button"
              className="rounded border px-3 py-1.5 hover:bg-accent"
              onClick={resetPomodoro}
            >
              Reset
            </button>
            <button
              type="button"
              className="rounded border px-3 py-1.5 hover:bg-accent"
              onClick={() => setShowSettings(true)}
            >
              Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
