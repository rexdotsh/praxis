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
import { Badge } from '@/components/ui/badge';
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from 'recharts';
import { TrendingUp, Clock } from 'lucide-react';
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

  const getCurrentGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getCurrentDate = () => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (!isLoaded || !isSignedIn) return null;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pb-8">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-4xl font-bold tracking-tight">
            {getCurrentGreeting()}, {greetingName}!
          </h1>
          <Badge variant="secondary" className="text-xs">
            <Clock className="w-3 h-3 mr-1" />
            {getCurrentDate()}
          </Badge>
        </div>
        <p className="text-muted-foreground text-lg">
          Ready to crush your academic goals today? Let's make it count! 🎯
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 relative">
        <SubjectPerformanceChart />
        <UpcomingExamsCard />
        <div className="bg-muted/50 h-72 rounded-xl md:col-span-2" />
        <div className="bg-muted/50 h-72 rounded-xl md:col-span-1" />
      </div>
    </div>
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
    <Card className="md:col-span-1 h-120 py-2 gap-0">
      <CardHeader className="items-center pt-4 gap-0 pb-4">
        <CardTitle className="text-xl">Subject Performance</CardTitle>
        <CardDescription className="text-sm">
          Your current academic performance
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[320px] w-full"
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
      <CardFooter className="flex-col gap-1 text-sm pt-1 pb-4">
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
    <Card className="md:col-span-2 h-120 py-0">
      <CardContent className="p-4 h-full">
        <div className="h-full">
          <DatesheetsForm />
        </div>
      </CardContent>
    </Card>
  );
}
