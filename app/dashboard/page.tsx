'use client';

import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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
        <div className="grid gap-4 md:grid-cols-3">
          <DashboardDatesheetsCard />
          <div className="bg-muted/50 h-96 rounded-xl md:col-span-2" />
          <div className="bg-muted/50 h-72 rounded-xl md:col-span-2" />
          <div className="bg-muted/50 h-72 rounded-xl md:col-span-1" />
        </div>
      </div>
    </>
  );
}

function DashboardDatesheetsCard() {
  const datesheets = useQuery(api.datesheets.listByUser) ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (() => {
    const all = datesheets.flatMap((d) =>
      d.firstExamDate ? [{ title: d.title, date: d.firstExamDate }] : [],
    );
    return all
      .filter((x) => x.date >= today)
      .sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  })();

  return (
    <Card className="md:col-span-1">
      <CardContent className="p-4">
        <div className="flex flex-col gap-2">
          <div className="text-sm text-muted-foreground">Datesheets</div>
          <div className="text-2xl font-semibold">{datesheets.length}</div>
          <div className="text-sm">
            {upcoming ? (
              <span>
                Next exam: {upcoming.title} on {upcoming.date}
              </span>
            ) : (
              <span>No upcoming exams</span>
            )}
          </div>
          <div>
            <a href="/datesheets">
              <Button size="sm">Create new</Button>
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
