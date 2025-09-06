'use client';

import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { onboardingSchema, type OnboardingData } from '@/lib/validations';
import {
  GRADE_OPTIONS,
  EXAM_OPTIONS,
  SUBJECT_OPTIONS,
  EXAM_GROUPS,
  SUBJECT_GROUPS,
  QUICK_EXAM_SUGGESTIONS,
  QUICK_SUBJECT_SUGGESTIONS,
} from '@/lib/constants/onboarding';
import { completeOnboarding } from './_actions';
import { OnboardingFormLayout } from '@/components/onboarding/form-layout';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  MultiSelectCommand,
  toItems,
} from '@/components/onboarding/MultiSelectCommand';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function OnboardingPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  // Steps: 0 details, 1 grade, 2 combined exams+subjects
  const totalSteps = 3;

  const { user } = useUser();
  const router = useRouter();

  const form = useForm<OnboardingData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      name: '',
      age: 16,
      grade: undefined,
      exams: [],
      subjects: [],
    },
    mode: 'onChange',
  });

  const getFieldsForStep = useCallback(
    (s: number): (keyof OnboardingData)[] => {
      switch (s) {
        case 0:
          return ['name', 'age'];
        case 1:
          return ['grade'];
        case 2:
          return ['exams', 'subjects'];
        default:
          return [];
      }
    },
    [],
  );

  const titles = ['Your details', 'Education level', 'Exams & subjects'];
  const descriptions = [
    'Tell us who you are to personalize your experience.',
    'Select your current grade or level.',
    'Choose up to 5 exams and up to 10 subjects.',
  ];

  const isLastStep = step === totalSteps - 1;

  const watchedValues = form.watch();
  const isNextDisabled = (() => {
    switch (step) {
      case 0:
        return !watchedValues.name || !watchedValues.age;
      case 1:
        return !watchedValues.grade;
      case 2:
        return (
          !watchedValues.exams ||
          watchedValues.exams.length < 1 ||
          watchedValues.exams.length > 5 ||
          !watchedValues.subjects ||
          watchedValues.subjects.length < 1 ||
          watchedValues.subjects.length > 10
        );
      default:
        return true;
    }
  })();

  const handleNext = useCallback(async () => {
    const fields = getFieldsForStep(step);
    if (fields.length > 0) {
      const valid = await form.trigger(fields);
      if (!valid) return;
    }
    setStep((s) => s + 1);
  }, [form, step, getFieldsForStep]);

  const handleBack = useCallback(() => setStep((s) => s - 1), []);

  async function onSubmit(values: OnboardingData) {
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('name', values.name);
      formData.append('age', values.age.toString());
      formData.append('grade', values.grade);
      values.exams.forEach((exam) => formData.append('exams', exam));
      values.subjects.forEach((subject) =>
        formData.append('subjects', subject),
      );

      const result = await completeOnboarding(formData);
      if (result.success === false) {
        if (result.errors) {
          Object.entries(result.errors).forEach(([field, messages]) => {
            form.setError(field as keyof OnboardingData, {
              message: messages[0],
            });
          });
        }
        if (result.message) setError(result.message);
        return;
      }

      await user?.reload();
      router.push('/dashboard');
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Onboarding error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {error && (
          <div className="container mx-auto px-4">
            <Alert className="mb-6 mx-auto max-w-3xl">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        <OnboardingFormLayout
          currentStep={step}
          totalSteps={totalSteps}
          title={titles[step]}
          description={descriptions[step]}
          onNext={isLastStep ? undefined : handleNext}
          onBack={handleBack}
          isLastStep={isLastStep}
          isNextDisabled={isLoading || isNextDisabled}
        >
          {step === 0 && (
            <div className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Age</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Enter your age"
                        {...field}
                        onChange={(e) =>
                          field.onChange(
                            Number.parseInt(e.target.value, 10) || 0,
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {step === 1 && (
            <FormField
              control={form.control}
              name="grade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Grade/Level</FormLabel>
                  <FormControl>
                    <div className="grid max-w-xl grid-cols-2 gap-2 sm:grid-cols-3">
                      {GRADE_OPTIONS.map((grade) => (
                        <Button
                          key={grade}
                          type="button"
                          variant="outline"
                          className={cn(
                            'justify-start',
                            field.value === grade &&
                              'border-primary bg-primary/10 text-primary',
                          )}
                          onClick={() => field.onChange(grade)}
                        >
                          {grade}
                        </Button>
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {step === 2 && (
            <div className="space-y-6">
              <FormField
                control={form.control}
                name="exams"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Exams (Select up to 5)</FormLabel>
                    <div className="mb-4 flex flex-wrap gap-2">
                      {QUICK_EXAM_SUGGESTIONS.map((x) => (
                        <Button
                          key={x}
                          type="button"
                          size="sm"
                          variant="outline"
                          className={cn(
                            field.value?.includes(x) &&
                              'border-primary bg-primary/10 text-primary',
                          )}
                          onClick={() => {
                            const selected = field.value ?? [];
                            if (selected.includes(x)) {
                              field.onChange(selected.filter((v) => v !== x));
                              return;
                            }
                            if (selected.length >= 5) {
                              toast('Selection limit reached', {
                                description: 'You can select up to 5 exams.',
                              });
                              return;
                            }
                            field.onChange([...selected, x]);
                          }}
                        >
                          {x}
                        </Button>
                      ))}
                    </div>
                    <FormControl>
                      <MultiSelectCommand
                        value={field.value ?? []}
                        onChange={field.onChange}
                        options={toItems(EXAM_OPTIONS, EXAM_GROUPS)}
                        max={5}
                        placeholder="Search and select exams"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="subjects"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject Preferences (Select up to 10)</FormLabel>
                    <div className="mb-4 flex flex-wrap gap-2">
                      {QUICK_SUBJECT_SUGGESTIONS.map((x) => (
                        <Button
                          key={x}
                          type="button"
                          size="sm"
                          variant="outline"
                          className={cn(
                            field.value?.includes(x) &&
                              'border-primary bg-primary/10 text-primary',
                          )}
                          onClick={() => {
                            const selected = field.value ?? [];
                            if (selected.includes(x)) {
                              field.onChange(selected.filter((v) => v !== x));
                              return;
                            }
                            if (selected.length >= 10) {
                              toast('Selection limit reached', {
                                description:
                                  'You can select up to 10 subjects.',
                              });
                              return;
                            }
                            field.onChange([...selected, x]);
                          }}
                        >
                          {x}
                        </Button>
                      ))}
                    </div>
                    <FormControl>
                      <MultiSelectCommand
                        value={field.value ?? []}
                        onChange={field.onChange}
                        options={toItems(SUBJECT_OPTIONS, SUBJECT_GROUPS)}
                        max={10}
                        placeholder="Search and select subjects"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
        </OnboardingFormLayout>
      </form>
    </Form>
  );
}
