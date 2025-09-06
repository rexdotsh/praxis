'use client';

import * as React from 'react';

import { DatePicker } from '@/components/date-picker';
import { NavUser } from '@/components/nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarSeparator,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { Authenticated, Unauthenticated, AuthLoading } from 'convex/react';
import { SignInButton, SignUpButton, useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

function SidebarBrand() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" asChild>
          <a href="/">
            {/* bg-white with logo being smaller? */}
            <div className="text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
              <Image
                src="/logo.svg"
                alt="Praxis Logo"
                className="size-8"
                width={32}
                height={32}
              />
            </div>
            <div className="flex flex-col gap-0.5 leading-none">
              <span className="font-medium">Praxis</span>
              <span className="">v1.0.0</span>
            </div>
          </a>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function SidebarUser() {
  const { user } = useUser();
  if (!user) return null;
  const name =
    user.fullName ??
    user.username ??
    user.primaryEmailAddress?.emailAddress ??
    'User';
  const email = user.primaryEmailAddress?.emailAddress ?? '';
  const avatar = user.imageUrl ?? '';
  return <NavUser user={{ name, email, avatar }} />;
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  if (pathname !== '/dashboard') return null;

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarBrand />
      </SidebarHeader>
      <SidebarSeparator className="mx-0" />
      <SidebarContent />
      <SidebarFooter>
        <DatePicker />
        <SidebarSeparator className="mx-0" />
        <AuthLoading>
          <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
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
          <SidebarUser />
        </Authenticated>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
