'use server';

import { auth, clerkClient } from '@clerk/nextjs/server';
import { onboardingSchema } from '@/lib/validations';

interface OnboardingResult {
  success?: boolean;
  message?: string;
  errors?: Record<string, string[]>;
}

export async function completeOnboarding(
  formData: FormData,
): Promise<OnboardingResult> {
  const { userId } = await auth();

  if (!userId) {
    return {
      success: false,
      message: 'No authenticated user found',
    };
  }

  const rawData = {
    name: formData.get('name') as string,
    age: Number.parseInt(formData.get('age') as string, 10),
    grade: formData.get('grade') as string,
    exams: formData.getAll('exams') as string[],
    subjects: formData.getAll('subjects') as string[],
  };

  const validation = onboardingSchema.safeParse(rawData);

  if (!validation.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: validation.error.flatten().fieldErrors,
    };
  }

  const { name, age, grade, exams, subjects } = validation.data;

  try {
    const client = await clerkClient();

    await client.users.updateUser(userId, {
      publicMetadata: {
        onboardingComplete: true,
        name,
        age,
        grade,
        exams,
        subjects,
      },
    });

    return { success: true, message: 'Onboarding complete' };
  } catch (error) {
    console.error('Error updating user metadata:', error);
    return {
      success: false,
      message:
        'There was an error completing your onboarding. Please try again.',
    };
  }
}
