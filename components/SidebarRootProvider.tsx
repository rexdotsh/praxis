'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { SidebarProvider } from '@/components/ui/sidebar';

export default function SidebarRootProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const defaultOpen = pathname === '/dashboard';

  return (
    <SidebarProvider defaultOpen={defaultOpen}>{children}</SidebarProvider>
  );
}
