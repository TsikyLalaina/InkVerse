import './globals.css';
import type { Metadata } from 'next';
import { SupabaseProvider } from '@/components/providers/SupabaseProvider';
import { RegisterSW } from '@/components/pwa/RegisterSW';

export const metadata: Metadata = {
  title: 'InkVerse',
  description: 'AI manhwa creation suite',
  manifest: '/manifest.webmanifest',
};

export const viewport = {
  themeColor: '#0f172a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <SupabaseProvider>
          {children}
        </SupabaseProvider>
        <RegisterSW />
      </body>
    </html>
  );
}
