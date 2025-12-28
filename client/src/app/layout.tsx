import './globals.css';
import type { Metadata } from 'next';
import { RegisterSW } from '@/components/pwa/RegisterSW';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import nextDynamic from 'next/dynamic';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL('https://inkverseapp.com'), // Replace with actual domain if known, default placeholder
  title: {
    default: 'InkVerse — AI Manhwa Creation Suite',
    template: '%s | InkVerse',
  },
  description: 'Unleash your creativity with InkVerse. AI-assisted novel and manhwa creation tool. Turn your stories into visual masterpieces.',
  keywords: ['AI', 'Manhwa', 'Webtoon', 'Novel', 'Writing', 'Comics', 'Creation', 'Stable Diffusion', 'Storytelling'],
  authors: [{ name: 'InkVerse Team' }],
  creator: 'InkVerse',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://inkverseapp.com',
    title: 'InkVerse — Awaken Your Story',
    description: 'AI-assisted novel and manhwa creation suite.',
    siteName: 'InkVerse',
    images: [
      {
        url: '/inkverse.png',
        width: 1200,
        height: 630,
        alt: 'InkVerse Preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'InkVerse — Awaken Your Story',
    description: 'AI-assisted novel and manhwa creation suite.',
    images: ['/inkverse.png'],
    creator: '@InkVerseAI',
  },
  icons: {
    icon: '/inkverse.png',
    apple: '/inkverse.png', // Optional: also use for Apple touch icon
  },
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
