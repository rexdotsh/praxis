'use client';

import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from 'recharts';
import { TrendingUp } from 'lucide-react';
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
          <SubjectPerformanceChart />
          <UpcomingExamsCard />
          <div className="bg-muted/50 h-72 rounded-xl md:col-span-2" />
          <div className="bg-muted/50 h-72 rounded-xl md:col-span-1" />
        </div>
      </div>
    </>
  );
}

function SubjectPerformanceChart() {
  // TODO: temporary data
  const chartData = [
    { subject: 'Physics', score: 85 },
    { subject: 'Chemistry', score: 78 },
    { subject: 'Mathematics', score: 92 },
    { subject: 'Biology', score: 88 },
    { subject: 'English', score: 76 },
    { subject: 'History', score: 82 },
  ];

  const chartConfig = {
    score: {
      label: 'Score',
      color: 'var(--chart-1)',
    },
  } satisfies ChartConfig;

  return (
    <Card className="md:col-span-1 h-96 py-2 gap-0">
      <CardHeader className="items-center pt-4 gap-0 pb-1">
        <CardTitle className="text-lg">Subject Performance</CardTitle>
        <CardDescription className="text-xs">
          Your current academic performance
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[260px] w-full"
        >
          <RadarChart data={chartData}>
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <PolarAngleAxis dataKey="subject" className="text-xs" />
            <PolarGrid />
            <Radar
              dataKey="score"
              fill="var(--color-score)"
              fillOpacity={0.6}
              dot={{
                r: 4,
                fillOpacity: 1,
              }}
              stroke="var(--color-score)"
              strokeWidth={2}
            />
          </RadarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-1 text-xs pt-1 pb-4">
        <div className="flex items-center gap-2 leading-none font-medium">
          Trending up by 3.8% this term <TrendingUp className="h-3 w-3" />
        </div>
        <div className="text-muted-foreground flex items-center gap-2 leading-none">
          Overall Average: 83.5%
        </div>
      </CardFooter>
    </Card>
  );
}

function UpcomingExamsCard() {
  return (
    <Card className="md:col-span-2 h-96 py-0">
      <CardContent className="p-4 h-full">
        <div className="h-full">
          <DatesheetsForm />
        </div>
      </CardContent>
    </Card>
  );
}
