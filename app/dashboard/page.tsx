'use client';

import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import DatesheetsForm from '@/components/datesheets/DatesheetsForm';

export default function DashboardPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace('/');
      return;
    }
    const onboardingComplete = (user?.publicMetadata as any)
      ?.onboardingComplete;
    if (onboardingComplete !== true) {
      router.replace('/onboarding');
    }
  }, [isLoaded, isSignedIn, user, router]);

  const greetingName = useMemo(() => {
    return user?.firstName || user?.fullName || user?.username || 'there';
  }, [user]);

  if (!isLoaded || !isSignedIn) return null;

  return (
    <>
      <header className="flex h-32 shrink-0 items-start justify-start p-4 pt-8 pl-8">
        <h1 className="text-6xl font-bold tracking-tight">
          Hi, {greetingName}!
        </h1>
      </header>
      <div className="flex flex-1 flex-col justify-end gap-4 p-4 pt-0 pb-8">
        <div className="grid gap-4 md:grid-cols-3 relative">
          <div className="bg-muted/50 h-96 rounded-xl md:col-span-1" />
          <UpcomingExamsCard />
          <div className="bg-muted/50 h-72 rounded-xl md:col-span-2" />
          <div className="bg-muted/50 h-72 rounded-xl md:col-span-1" />
        </div>
      </div>
    </>
  );
}

function UpcomingExamsCard() {
  const items =
    useQuery(api.datesheets.listUpcomingItemsByUser, { limit: 10 }) ?? [];
  const datesheets = useQuery(api.datesheets.listByUser) ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const nextExam = (() => {
    const all = datesheets.flatMap((d) =>
      d.firstExamDate ? [{ title: d.title, date: d.firstExamDate }] : [],
    );
    return all
      .filter((x) => x.date >= today)
      .sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  })();
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const removeExam = useMutation(api.datesheets.removeExam);
  const [isCreating, setIsCreating] = useState(false);

  return (
    <Card className={isCreating ? 'md:col-span-2' : 'md:col-span-2 h-96'}>
      <CardContent className="p-4 h-full">
        <div className="flex h-full flex-col relative">
          <div className="mb-2 flex items-center justify-between gap-4 flex-wrap">
            <div className="text-sm text-muted-foreground">Upcoming exams</div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Datesheets
                </span>
                <span className="text-lg font-semibold tabular-nums">
                  {datesheets.length}
                </span>
              </div>
              <div className="text-sm">
                {nextExam ? (
                  <span>
                    Next exam: {nextExam.title} on {nextExam.date}
                  </span>
                ) : (
                  <span>No upcoming exams</span>
                )}
              </div>
              <div>
                {isCreating ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setIsCreating(false)}
                  >
                    Cancel
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setIsCreating(true)}>
                    Create new
                  </Button>
                )}
              </div>
            </div>
          </div>
          {isCreating ? (
            <div className="mt-2">
              <DatesheetsForm onSaved={() => setIsCreating(false)} />
            </div>
          ) : items.length === 0 ? (
            <div className="text-sm">No upcoming exams</div>
          ) : (
            <ul className="space-y-2 overflow-auto pr-1">
              {items.map((it, idx) => {
                const isOpen = openIdx === idx;
                const label =
                  it.title && it.title !== it.subject
                    ? `${it.title}: ${it.subject}`
                    : it.subject;
                return (
                  <li
                    key={`${it.datesheetId}-${it.examDate}`}
                    className="rounded-md border"
                  >
                    <button
                      type="button"
                      className="w-full flex items-center justify-between p-2 text-left hover:bg-muted/50"
                      onClick={() =>
                        setOpenIdx((prev) => (prev === idx ? null : idx))
                      }
                    >
                      <span className="font-medium truncate mr-2" title={label}>
                        {label}
                      </span>
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {it.examDate}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="px-3 pb-3">
                        {it.syllabus.length > 0 && (
                          <ul className="list-disc pl-5 space-y-1 text-sm">
                            {it.syllabus.map((s) => (
                              <li key={s}>{s}</li>
                            ))}
                          </ul>
                        )}
                        <div className="mt-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={async () => {
                              await removeExam({
                                datesheetId: it.datesheetId,
                                subject: it.subject,
                                examDate: it.examDate,
                              });
                            }}
                            title="Delete this exam"
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
