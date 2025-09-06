import { SignInButton, SignUpButton } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect('/dashboard');

  return (
    <main className="container mx-auto px-4 py-16">
      <div className="flex flex-col items-center justify-center gap-3 text-center">
        <SignInButton mode="modal">Sign in</SignInButton>
        <SignUpButton mode="modal">Sign up</SignUpButton>
      </div>
    </main>
  );
}
