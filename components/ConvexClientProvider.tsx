'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import {
  ConvexReactClient,
  Authenticated,
  useConvexAuth,
  useMutation,
} from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { useAuth } from '@clerk/nextjs';
import { api } from '@/convex/_generated/api';

if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
  throw new Error('NEXT_PUBLIC_CONVEX_URL is not set');
}

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL);

export default function ConvexClientProvider({
  children,
}: { children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <Authenticated>
        <StoreUserOnAuth />
      </Authenticated>
      {children}
    </ConvexProviderWithClerk>
  );
}

function StoreUserOnAuth() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const upsert = useMutation(api.users.upsertCurrent);
  const didCallRef = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated && !didCallRef.current) {
      didCallRef.current = true;
      void upsert();
    }
    if (!isAuthenticated) {
      didCallRef.current = false;
    }
  }, [isAuthenticated, isLoading, upsert]);

  return null;
}
