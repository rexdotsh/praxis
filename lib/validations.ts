import { z } from 'zod';
import {
  EXAM_OPTIONS,
  SUBJECT_OPTIONS,
  GRADE_OPTIONS,
} from '@/lib/constants/onboarding';

export const onboardingSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters long')
    .max(50, 'Name must be less than 50 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces'),

  age: z
    .number()
    .int('Age must be a whole number')
    .min(10, 'Age must be at least 10')
    .max(100, 'Age must be less than 100'),

  grade: z.enum(GRADE_OPTIONS, { message: 'Please select a valid grade' }),

  exams: z
    .array(z.enum(EXAM_OPTIONS))
    .min(1, 'Please select at least one exam')
    .max(5, 'Please select no more than 5 exams'),

  subjects: z
    .array(z.enum(SUBJECT_OPTIONS))
    .min(1, 'Please select at least one subject')
    .max(10, 'Please select no more than 10 subjects'),
});

export type OnboardingData = z.infer<typeof onboardingSchema>;
