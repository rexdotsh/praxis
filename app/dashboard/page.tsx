'use client';

import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
  return (
    <Card className="md:col-span-2 h-96">
      <CardContent className="p-4 h-full">
        <div className="h-full">
          <DatesheetsForm />
        </div>
      </CardContent>
    </Card>
  );
}
