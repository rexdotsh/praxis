import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const { userId, sessionClaims } = await auth();
  const user = await currentUser();

  if (!userId) {
    redirect('/');
  }

  if (!sessionClaims?.metadata?.onboardingComplete) {
    redirect('/onboarding');
  }

  const greetingName =
    user?.firstName ?? user?.fullName ?? user?.username ?? 'there';

  return (
    <>
      <header className="flex h-32 shrink-0 items-start justify-start p-4 pt-8 pl-8">
        <h1 className="text-6xl font-bold tracking-tight">
          Hi, {greetingName}!
        </h1>
      </header>
      <div className="flex flex-1 flex-col justify-end gap-4 p-4 pt-0 pb-8">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="bg-muted/50 h-96 rounded-xl md:col-span-1" />
          <div className="bg-muted/50 h-96 rounded-xl md:col-span-2" />
          <div className="bg-muted/50 h-72 rounded-xl md:col-span-2" />
          <div className="bg-muted/50 h-72 rounded-xl md:col-span-1" />
        </div>
      </div>
    </>
  );
}
