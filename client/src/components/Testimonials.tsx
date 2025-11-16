"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type TItem = { quote: string; author: string };

const DEFAULTS: TItem[] = [
  { quote: "I wrote a 12-chapter manhwa in 3 days.", author: "— @HunterK, Webtoon Creator" },
  { quote: "The AI remembers my lore better than I do.", author: "— @ShadowScribe" },
  { quote: "Branching scenes saved my series.", author: "— @PanelSmith" },
  { quote: "Flux.1 images hit the tone I needed.", author: "— @NeonInk" },
];

export default function Testimonials({ items = DEFAULTS }: { items?: TItem[] }) {
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<number | null>(null);

  const go = (n: number) => setIdx((p) => (n + items.length) % items.length);
  const next = () => go(idx + 1);

  useEffect(() => {
    timerRef.current && window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(next, 4500) as any;
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [idx, items.length]);

  const bg = useMemo(() => (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-[0.06]"
      style={{
        backgroundImage:
          "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"800\" height=\"400\" viewBox=\"0 0 800 400\"><path d=\"M120 360 q40-140 120-160 q40-10 90-80 q50 120 120 160 q40 20 90 20\" stroke=\"%23ffffff\" stroke-opacity=\"0.5\" fill=\"none\"/></svg>')",
        backgroundRepeat: "repeat",
        backgroundSize: "600px 300px",
      }}
    />
  ), []);

  return (
    <section className="relative w-full py-16 md:py-24 bg-gradient-to-b from-[#0A0A0A] to-[#0B0B12]">
      {/* Faint silhouettes bg */}
      {bg}

      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-2xl md:text-3xl lg:text-4xl font-semibold text-white mb-8">Used by 10,000+ Creators</h2>

        <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-black/20 backdrop-blur-md">
          <div className="relative h-[220px] sm:h-[240px] flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.45, ease: "easeOut" }}
                className="px-6"
              >
                <SpeechBubble>
                  <p className="text-slate-100 text-lg leading-relaxed">“{items[idx].quote}”</p>
                  <div className="mt-3 text-sm text-cyan-300">{items[idx].author}</div>
                </SpeechBubble>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Dots */}
          <div className="flex items-center justify-center gap-2 py-4">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => go(i)}
                className={`h-2.5 w-2.5 rounded-full border transition ${
                  i === idx
                    ? "bg-cyan-400 border-cyan-300 shadow-[0_0_12px_rgba(0,212,255,0.5)]"
                    : "bg-transparent border-cyan-700 hover:bg-cyan-900/30"
                }`}
                aria-label={`Go to testimonial ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SpeechBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative max-w-3xl">
      <div className="rounded-xl border border-cyan-400/60 bg-slate-900/60 p-5 shadow-[0_0_24px_rgba(0,212,255,0.35)] backdrop-blur-md">
        {children}
      </div>
      {/* Tail */}
      <div className="absolute left-10 -bottom-2 h-4 w-4 rotate-45 border-b border-r border-cyan-400/60 bg-slate-900/60" />
      {/* Glow ring */}
      <div className="pointer-events-none absolute -inset-1 rounded-xl border border-cyan-400/20 blur-sm" />
    </div>
  );
}
