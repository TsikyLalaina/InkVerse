"use client";

import { useRef, useState, useEffect, useCallback } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';

export default function FromTextToPanels() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const x = useMotionValue(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [open, setOpen] = useState(false);

  const blip = useCallback((freq = 520, duration = 0.07) => {
    try {
      const ctx = (audioCtxRef.current ||= new (window.AudioContext || (window as any).webkitAudioContext)());
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.01);
    } catch {}
  }, []);

  useEffect(() => {
    function measure() {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      setWidth(w);
      // Load saved position ratio if present
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('inkverse:slider:ratio') : null;
      const ratio = stored ? Math.max(0, Math.min(1, parseFloat(stored))) : 0.5;
      if (x.get() === 0) x.set(w * ratio);
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [x]);

  // Persist slider position ratio
  useEffect(() => {
    const unsub = x.on('change', (val) => {
      if (!width) return;
      const ratio = Math.max(0, Math.min(1, val / width));
      try { window.localStorage.setItem('inkverse:slider:ratio', String(ratio)); } catch {}
    });
    return () => { unsub && (unsub as any)(); };
  }, [x, width]);

  const prose = `Evening light pooled behind him as he glanced back, jaw set.\n\nHe ran, breath burning, each step a vow he wouldn’t break.\n\nHeat stung his eyes—no turning away now.\n\nThe door stood open at last; beyond it waited another threshold.`;

  return (
    <section className="relative w-full bg-gradient-to-b from-[#0A0A0A] to-[#0B0B12] py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-2xl md:text-3xl lg:text-4xl font-semibold text-white mb-6">From Text to Panels</h2>
        <p className="text-slate-400 mb-6">Each panel has its own prose. Swipe vertically on a card to reveal the art.</p>

        {(() => {
          const imgs = (
            process.env.NEXT_PUBLIC_PANEL_IMAGES
              ? process.env.NEXT_PUBLIC_PANEL_IMAGES.split(',')
              : [
                  '/panels/panel2.jpeg',
                  '/panels/panel3.jpeg',
                  '/panels/panel4.jpeg',
                  '/panels/panel5.jpeg',
                ]
          ).map(s => (s || '').trim()).filter(Boolean).slice(0, 4);

          const proseList = [
            // panel2
            'He looks back once. The sky is warm, but his eyes have already chosen the colder road ahead.',
            // panel3
            'Sweat beads, stride widens—he runs toward the choice no one else would take.',
            // panel4
            'Resolve burns hottest behind the eyes. The world narrows to a single breath he refuses to waste.',
            // panel5
            'An old door, a light that waits. Cross one threshold and another appears—stories stack like rooms.',
          ];

          function MiniRevealCard({ src, text, idx }: { src: string; text: string; idx: number }) {
            const cardRef = useRef<HTMLDivElement | null>(null);
            const [h, setH] = useState(420);
            const y = useMotionValue(0);
            const initRef = useRef(false);

            useEffect(() => {
              const measure = () => {
                if (!cardRef.current) return;
                const ch = cardRef.current.clientHeight;
                setH(ch);
                if (!initRef.current) {
                  y.set(ch); // cover full image initially
                  initRef.current = true;
                } else if (y.get() > ch) {
                  y.set(ch);
                }
              };
              measure();
              window.addEventListener('resize', measure);
              return () => window.removeEventListener('resize', measure);
            }, [y]);

            return (
              <div ref={cardRef} className="relative aspect-[2/3] max-h-[100vh] sm:aspect-auto sm:h-[420px] lg:h-[480px] overflow-hidden rounded-xl border border-slate-800 bg-black/40 backdrop-blur-md">
                <img
                  src={src}
                  alt={`panel-${idx}`}
                  className="absolute inset-0 h-full w-full object-contain sm:object-cover bg-black"
                  onError={(e) => {
                    const el = e.currentTarget as HTMLImageElement;
                    if (el.src.endsWith('.jpeg')) el.src = el.src.replace('.jpeg', '.jpg');
                    else if (el.src.endsWith('.jpg')) el.src = el.src.replace('.jpg', '.jpeg');
                  }}
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 to-black/20" />

                {/* Prose overlay with vertical reveal height */}
                <motion.div className="absolute left-0 top-0 w-full overflow-hidden" style={{ height: y }}>
                  <div className="h-full w-full p-4">
                    <div className="h-full w-full rounded-lg border border-slate-700 bg-slate-900/80 text-slate-200 shadow-[0_0_16px_rgba(0,0,0,0.3)]">
                      <div className="p-4">
                        <div className="text-xs tracking-[0.2em] text-cyan-300 mb-2">NOVEL PROSE</div>
                        <p className="text-sm leading-relaxed">{text}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Vertical handle */}
                <motion.div
                  drag="y"
                  dragConstraints={{ top: 0, bottom: Math.max(0, h - 1) }}
                  style={{ y, touchAction: 'none' as any }}
                  className="absolute left-0 right-0 h-1 cursor-ns-resize bg-cyan-400/80 shadow-[0_0_18px_rgba(0,212,255,0.6)] focus:outline-none select-none"
                  role="slider"
                  aria-label="Vertical Reveal"
                  aria-valuemin={0}
                  aria-valuemax={h}
                  aria-valuenow={Math.round(y.get())}
                  tabIndex={0}
                  onDragStart={() => blip(640, 0.06)}
                  onDragEnd={() => blip(820, 0.08)}
                >
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-cyan-400/60 bg-cyan-400/10 px-2 py-1 text-[10px] text-cyan-200">Swipe</div>
                </motion.div>
              </div>
            );
          }

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {imgs.map((src, i) => (
                <MiniRevealCard key={i} src={src} text={proseList[i] || ''} idx={i} />
              ))}
            </div>
          );
        })()}

        <div className="mt-4 flex items-center justify-between">
          <div className="text-slate-400 text-sm">→ AI converts in <span className="text-white font-semibold">3 seconds</span></div>
          <div className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300">
            Powered by <span className="text-cyan-300">Groq</span> + <span className="text-pink-300">Fal.ai</span>
          </div>
        </div>
      </div>
      {/* Demo Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-3xl rounded-xl border border-slate-700 bg-slate-950 p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-slate-200 font-semibold">InkVerse Demo</h4>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="aspect-video w-full overflow-hidden rounded-lg border border-slate-800 bg-black">
              <iframe
                className="h-full w-full"
                src={process.env.NEXT_PUBLIC_DEMO_URL}
                title="InkVerse Demo"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
