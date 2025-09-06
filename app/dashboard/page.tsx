import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect('/');
  }

  if (!sessionClaims?.metadata?.onboardingComplete) {
    redirect('/onboarding');
  }

  const userMetadata = sessionClaims.metadata;

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold text-foreground mb-6">
        Welcome to your Dashboard!
      </h1>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-card text-card-foreground p-6 rounded-lg border border-border">
          <h2 className="text-xl font-semibold mb-4">Your Profile</h2>
          <div className="space-y-2">
            <p>
              <strong>Name:</strong> {userMetadata.name}
            </p>
            <p>
              <strong>Age:</strong> {userMetadata.age}
            </p>
            <p>
              <strong>Grade:</strong> {userMetadata.grade}
            </p>
          </div>
        </div>

        <div className="bg-card text-card-foreground p-6 rounded-lg border border-border">
          <h2 className="text-xl font-semibold mb-4">Target Exams</h2>
          <div className="flex flex-wrap gap-2">
            {userMetadata.exams?.map((exam) => (
              <span
                key={exam}
                className="bg-primary text-primary-foreground px-2 py-1 rounded-md text-sm"
              >
                {exam}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-card text-card-foreground p-6 rounded-lg border border-border md:col-span-2">
          <h2 className="text-xl font-semibold mb-4">Subjects</h2>
          <div className="flex flex-wrap gap-2">
            {userMetadata.subjects?.map((subject) => (
              <span
                key={subject}
                className="bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-sm"
              >
                {subject}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
