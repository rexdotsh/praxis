'use client';

import { Authenticated, Unauthenticated, AuthLoading } from 'convex/react';
import { SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { usePathname } from 'next/navigation';

export function SiteHeader() {
  const pathname = usePathname();
  if (pathname.startsWith('/onboarding')) return null;
  return (
    <header className="flex justify-end p-4 border-b border-border">
      <div className="w-full flex justify-end">
        <AuthLoading>
          <div className="h-7 w-[50px] animate-pulse rounded-md bg-muted" />
        </AuthLoading>
        <Unauthenticated>
          <div className="flex gap-2">
            <SignInButton mode="modal">
              <Button type="button" size="sm">
                Sign in
              </Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button type="button" size="sm" variant="secondary">
                Sign up
              </Button>
            </SignUpButton>
          </div>
        </Unauthenticated>
        <Authenticated>
          <UserButton />
        </Authenticated>
      </div>
    </header>
  );
}
