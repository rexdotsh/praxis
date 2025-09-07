'use client';

import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Calendar } from '@/components/ui/calendar';
import { SidebarGroup, SidebarGroupContent } from '@/components/ui/sidebar';

const EMPTY_MODIFIERS = {};

const MODIFIERS_CLASSNAMES = {
  hasExam:
    'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 font-medium',
  todayExam:
    'bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-100 font-semibold ring-2 ring-red-500/50',
  soonExam:
    'bg-orange-100 dark:bg-orange-900/30 text-orange-900 dark:text-orange-100 font-medium ring-1 ring-orange-500/50',
  futureExam:
    'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100',
} as const;

function normalizeToLocalMidnight(input: Date): Date {
  const date = new Date(input);
  date.setHours(0, 0, 0, 0);
  return date;
}

function buildCalendarModifiers(
  upcomingExams: Array<{ examDate: string | number | Date }> | undefined,
) {
  if (!upcomingExams) return EMPTY_MODIFIERS;

  const examDates: Date[] = [];
  const todayExams: Date[] = [];
  const soonExams: Date[] = [];
  const futureExams: Date[] = [];

  const today = normalizeToLocalMidnight(new Date());

  for (const exam of upcomingExams) {
    const examDate = normalizeToLocalMidnight(new Date(exam.examDate));
    examDates.push(examDate);

    const timeDiff = examDate.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

    if (daysDiff === 0) {
      todayExams.push(examDate);
    } else if (daysDiff > 0 && daysDiff <= 7) {
      soonExams.push(examDate);
    } else if (daysDiff > 7) {
      futureExams.push(examDate);
    }
  }

  return {
    hasExam: examDates,
    todayExam: todayExams,
    soonExam: soonExams,
    futureExam: futureExams,
  };
}

export function DatePicker() {
  const upcomingExams = useQuery(api.datesheets.listUpcomingItemsByUser, {
    limit: 50,
  });

  const calendarModifiers = useMemo(
    () => buildCalendarModifiers(upcomingExams as any),
    [upcomingExams],
  );

  return (
    <SidebarGroup className="px-0">
      <SidebarGroupContent className="flex justify-center">
        <Calendar
          modifiers={calendarModifiers}
          modifiersClassNames={MODIFIERS_CLASSNAMES}
          className="[&_[role=gridcell].bg-accent]:bg-sidebar-primary [&_[role=gridcell].bg-accent]:text-sidebar-primary-foreground [&_[role=gridcell]]:w-[32px] p-2"
        />
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
