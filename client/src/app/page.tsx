import { Orbitron, JetBrains_Mono } from 'next/font/google';
import dynamic from 'next/dynamic';

const orbitron = Orbitron({ subsets: ['latin'], weight: ['400','600','700'] });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400','600'] });

const Hero = dynamic(() => import('@/components/Hero'), { ssr: false });
const MuseSection = dynamic(() => import('@/components/MuseSection'), { ssr: false });
const RulesSection = dynamic(() => import('@/components/RulesSection'), { ssr: false });
const FromTextToPanels = dynamic(() => import('@/components/FromTextToPanels'), { ssr: false });
const Testimonials = dynamic(() => import('@/components/Testimonials'), { ssr: false });
const Investor = dynamic(() => import('@/components/Investor'), { ssr: false });
const AwakenCTA = dynamic(() => import('@/components/AwakenCTA'), { ssr: false });

export const metadata = {
  title: 'InkVerse — Awaken Your Story',
  description: 'AI-assisted novel and manhwa creation. Enter the Gate and craft your world with InkVerse.',
};

export default function Home() {
  return (
    <main>
      <Hero titleClass={orbitron.className} monoClass={jetbrains.className} />
      <MuseSection />
      <RulesSection />
      <FromTextToPanels />
      <Testimonials />
      <Investor />
      <AwakenCTA />
    </main>
  );
}
