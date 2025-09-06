import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';
import { Analytics } from '@vercel/analytics/react';
import ConvexClientProvider from '@/components/ConvexClientProvider';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Praxis',
  description:
    'Transform your learning with AI-curated video lessons, adaptive study paths, and smart flashcards.',
  authors: [{ name: 'Team Rocket' }],
  creator: 'Team Rocket',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ClerkProvider>
          <ConvexClientProvider>
            <SidebarProvider>
              <AppSidebar />
              <SidebarInset>{children}</SidebarInset>
            </SidebarProvider>
          </ConvexClientProvider>
        </ClerkProvider>
        <Toaster position="top-right" richColors />
        <Analytics basePath="/monitor" />
      </body>
    </html>
  );
}
