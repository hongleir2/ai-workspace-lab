import { PostHogProvider } from '@/components/posthog-provider';
import { ThemeProvider } from '@/components/theme-provider';
import type { Metadata } from 'next';
import { DM_Sans, Space_Grotesk } from 'next/font/google';
import NextTopLoader from 'nextjs-toploader';
import type { ReactNode } from 'react';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AI Workspace',
  description: 'AI workspace for teams that build with knowledge.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${dmSans.variable}`}
      suppressHydrationWarning
    >
      <body
        className="min-h-screen bg-background font-body text-foreground antialiased"
        suppressHydrationWarning
      >
        <NextTopLoader color="#6366f1" height={3} showSpinner={false} />
        <ThemeProvider>
          <PostHogProvider>{children}</PostHogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
