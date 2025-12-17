import './globals.css';
import type { Metadata } from 'next';
import { RegisterSW } from '@/components/pwa/RegisterSW';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import nextDynamic from 'next/dynamic';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'InkVerse',
  description: 'AI manhwa creation suite',
  manifest: '/manifest.webmanifest',
};

export const viewport = {
  themeColor: '#0f172a',
};

const SupabaseProvider = nextDynamic(
  () => import('@/components/providers/SupabaseProvider').then((m) => m.SupabaseProvider),
  { ssr: false }
);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-bg-primary text-text-primary">
        <ThemeProvider>
          <SupabaseProvider>
            {children}
          </SupabaseProvider>
        </ThemeProvider>
        <RegisterSW />
      </body>
    </html>
  );
}
