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
import {
  TrendingUp,
  Clock,
  BookOpen,
  Flame,
  CheckCircle,
  Target,
  Timer,
} from 'lucide-react';
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
    <div className="flex flex-1 flex-col gap-6 p-6 pb-6">
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
        <QuotesCard />
        <StudyStatsCard />
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

function QuotesCard() {
  const quotes = [
    {
      text: 'Success is not final, failure is not fatal:',
      subtext: 'it is the courage to continue that counts.',
    },
    {
      text: 'The future belongs to those who believe',
      subtext: 'in the beauty of their dreams.',
    },
    {
      text: 'Education is the most powerful weapon',
      subtext: 'which you can use to change the world.',
    },
    {
      text: 'The only impossible journey',
      subtext: 'is the one you never begin.',
    },
    {
      text: "Don't watch the clock; do what it does.",
      subtext: 'Keep going.',
    },
    {
      text: "Believe you can and you're halfway there.",
      subtext: 'The rest is just showing up.',
    },
  ];

  const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

  return (
    <Card className="md:col-span-2 h-72 overflow-hidden rounded-xl relative">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/quote.png)' }}
      />
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[0.5px]" />
      <CardContent className="relative h-full flex items-center justify-start p-8">
        <div className="text-left text-white space-y-1">
          {(() => {
            const quoteWords = randomQuote.text.split(' ');
            const firstLine = quoteWords.slice(0, 4).join(' ');
            const remainingWords = quoteWords.slice(4).join(' ');
            return (
              <blockquote className="text-5xl md:text-6xl font-bold leading-[1.1] tracking-tight">
                <div>
                  {'"'}
                  {firstLine}
                  {remainingWords.length === 0 && '"'}
                </div>
                {remainingWords && (
                  <div>
                    {remainingWords}
                    {'"'}
                  </div>
                )}
              </blockquote>
            );
          })()}
          <p className="text-xl font-medium opacity-90">
            {randomQuote.subtext}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function StudyStatsCard() {
  const stats = [
    {
      icon: Timer,
      label: 'Study Time',
      value: '3.5h',
      progress: 70,
      color: 'text-blue-600',
      progressColor: 'bg-blue-500',
    },
    {
      icon: Flame,
      label: 'Streak',
      value: '12d',
      progress: 85,
      color: 'text-orange-600',
      progressColor: 'bg-orange-500',
    },
    {
      icon: CheckCircle,
      label: 'Tasks',
      value: '8/12',
      progress: 67,
      color: 'text-green-600',
      progressColor: 'bg-green-500',
    },
    {
      icon: Target,
      label: 'Goal',
      value: '85%',
      progress: 85,
      color: 'text-purple-600',
      progressColor: 'bg-purple-500',
    },
  ];

  return (
    <Card className="md:col-span-1 h-72 py-4 gap-1">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-lg">Today's Progress</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="grid grid-cols-2 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="bg-muted/30 rounded-lg p-3 hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                  <span className="text-xs font-medium text-muted-foreground">
                    {stat.label}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="text-lg font-bold">{stat.value}</div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-500 group-hover:opacity-80 ${stat.progressColor}`}
                      style={{ width: `${stat.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
