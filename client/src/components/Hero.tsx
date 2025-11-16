"use client";

function OrnateCornersHero() {
  const common = "pointer-events-none absolute h-10 w-10 opacity-80";
  const stroke = encodeURIComponent('#7dd3fc');
  const path = encodeURIComponent(
    "M2 8 C6 6, 8 4, 10 2 M2 18 C10 12, 16 10, 22 8 M8 22 C12 18, 16 14, 22 12"
  );
  const svg = (rotate: string) => `url("data:image/svg+xml;utf8,` +
    `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24'>` +
    `<path d='${path}' fill='none' stroke='${stroke}' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/>` +
    `</svg>` + `")`;
  return (
    <>
      <div className={`${common} left-0 top-0`} style={{ backgroundImage: svg("0") }} />
      <div className={`${common} right-0 top-0`} style={{ backgroundImage: svg("90"), transform: "rotate(90deg)" }} />
      <div className={`${common} left-0 bottom-0`} style={{ backgroundImage: svg("-90"), transform: "rotate(-90deg)" }} />
      <div className={`${common} right-0 bottom-0`} style={{ backgroundImage: svg("180"), transform: "rotate(180deg)" }} />
      <div className="pointer-events-none absolute inset-0" style={{ boxShadow: 'inset 0 0 90px rgba(56,189,248,0.15)' }} />
    </>
  );
}

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useCallback, useRef } from 'react';

export default function Hero({ titleClass, monoClass }: { titleClass: string; monoClass: string }) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playBlip = useCallback((freq = 520, duration = 0.08) => {
    try {
      const ctx = (audioCtxRef.current ||= new (window.AudioContext || (window as any).webkitAudioContext)());
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.01);
    } catch {}
  }, []);
  const particles = Array.from({ length: 24 });

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-[#0A0A0A] to-[#1A1A2E]">
      {/* Scanline overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-soft-light opacity-20"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 2px, transparent 4px)'
        }}
      />

      {/* Subtle particles */}
      <div className="pointer-events-none absolute inset-0">
        {particles.map((_, i) => {
          const delay = (i % 6) * 0.6;
          const left = `${(i * 37) % 100}%`;
          const size = 2 + (i % 3);
          return (
            <motion.span
              key={i}
              className="absolute rounded-full bg-cyan-400/30 shadow-[0_0_12px_rgba(0,212,255,0.35)]"
              style={{ left, top: `${(i * 19) % 100}%`, width: size, height: size }}
              initial={{ opacity: 0.1, y: 0 }}
              animate={{ opacity: [0.1, 0.35, 0.1], y: [-8, 8, -8] }}
              transition={{ duration: 6 + (i % 5), repeat: Infinity, ease: 'easeInOut', delay }}
            />
          );
        })}
      </div>

      {/* Centered system window */}
      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="w-full"
        >
          <div
            className="relative p-6 sm:p-8 backdrop-blur-md shadow-[0_0_40px_rgba(56,189,248,0.35)] border-2 border-sky-400/70 
            bg-[linear-gradient(180deg,rgba(17,58,102,0.65)_0%,rgba(9,28,54,0.7)_100%)]"
          >
            <OrnateCornersHero />
            <div className="absolute right-3 top-2 text-sky-200/70 text-xs select-none">— ×</div>
            <div className="absolute left-0 right-0 top-10 h-px bg-gradient-to-r from-transparent via-sky-200/25 to-transparent" />
            <div className="absolute left-0 right-0 -bottom-px h-px bg-gradient-to-r from-transparent via-sky-200/15 to-transparent" />

            <div className={`mb-6 text-center text-sky-200 ${monoClass}`}>
              <div className="tracking-[0.2em] text-xs sm:text-sm">SYSTEM INITIALIZED</div>
              <div className="mx-auto mt-2 h-[2px] w-48 bg-gradient-to-r from-sky-300/0 via-sky-300/70 to-sky-300/0" />
            </div>

            {/* Body */}
            <div className="grid gap-6 sm:gap-8">
              <div className={`${titleClass} text-3xl sm:text-5xl text-cyan-200 drop-shadow-[0_0_10px_rgba(34,211,238,0.35)] relative`}> 
                <span className="block text-base sm:text-lg text-cyan-300/80 tracking-widest mb-2">[LEVEL 1] Welcome, Hunter.</span>
                <span className="relative inline-block glitch" data-text="Awaken your story.">Awaken your story.</span>
              </div>

              <div className={`${monoClass} text-slate-300/90 text-sm sm:text-base`}>
                Choose your class:
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/auth/signup"
                  onMouseEnter={() => playBlip(640, 0.06)}
                  onClick={() => playBlip(760, 0.1)}
                  className={`${monoClass} rounded border border-cyan-400/60 bg-cyan-400/10 px-4 py-2 text-cyan-200 hover:bg-cyan-400/20 transition shadow-[0_0_16px_rgba(0,212,255,0.25)]`}
                >
                  NOVEL WRITER
                </Link>
                <Link
                  href="/auth/signup"
                  onMouseEnter={() => playBlip(540, 0.06)}
                  onClick={() => playBlip(720, 0.1)}
                  className={`${monoClass} rounded border border-cyan-400/60 bg-cyan-400/10 px-4 py-2 text-cyan-200 hover:bg-cyan-400/20 transition shadow-[0_0_16px_rgba(0,212,255,0.25)]`}
                >
                  MANHWA CREATOR
                </Link>
              </div>

              <div className={`${monoClass} text-cyan-200/90`}>→ AWAKEN YOUR STORY</div>

              <div>
                <Link
                  href="/auth/signup"
                  onMouseEnter={() => playBlip(460, 0.08)}
                  onClick={() => playBlip(880, 0.12)}
                  className={`inline-flex items-center justify-center rounded-lg bg-cyan-400 px-5 py-3 font-semibold text-black hover:bg-cyan-300 transition ${
                    'shadow-[0_0_30px_rgba(0,212,255,0.5)]'
                  }`}
                >
                  ENTER THE GATE
                </Link>
              </div>
            </div>

            <div className="pointer-events-none absolute inset-0" style={{ boxShadow: 'inset 0 0 90px rgba(56,189,248,0.15)' }} />
          </div>
        </motion.div>
      </div>
      <style jsx>{`
        @keyframes glitchy {
          0% { transform: translate(0,0); filter: hue-rotate(0deg); }
          10% { transform: translate(1px,-1px) skewX(0.3deg); }
          20% { transform: translate(-1px,1px) skewX(-0.3deg); }
          30% { transform: translate(1px,0) }
          40% { transform: translate(-1px,0) }
          50% { transform: translate(0,1px) }
          60% { transform: translate(0,-1px) }
          70% { transform: translate(1px,1px) }
          80% { transform: translate(-1px,-1px) }
          90% { transform: translate(1px,-1px) }
          100% { transform: translate(0,0); filter: hue-rotate(0deg); }
        }
        .glitch::before, .glitch::after {
          content: attr(data-text);
          position: absolute;
          left: 0; top: 0;
          overflow: hidden;
          clip-path: inset(0 0 0 0);
          opacity: 0.6;
          pointer-events: none;
        }
        .glitch::before {
          color: rgba(34,211,238,0.8);
          transform: translate(1px, 0);
          mix-blend-mode: screen;
          text-shadow: -1px 0 rgba(0,212,255,0.6);
          animation: glitchy 2.2s infinite ease-in-out;
        }
        .glitch::after {
          color: rgba(59,130,246,0.65);
          transform: translate(-1px, 0);
          mix-blend-mode: screen;
          text-shadow: 1px 0 rgba(0,212,255,0.4);
          animation: glitchy 1.8s infinite ease-in-out reverse;
        }
        .glitch {
          animation: glitchy 3.2s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
}
