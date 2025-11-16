"use client";

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

export default function MuseSection() {
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const demoUrl = process.env.NEXT_PUBLIC_DEMO_URL;

  useEffect(() => {
    if (open) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 900);
      return () => clearTimeout(t);
    }
  }, [open]);

  const listVariants = useMemo(() => ({
    hidden: { opacity: 0, y: 6 },
    show: {
      opacity: 1,
      y: 0,
      transition: { staggerChildren: 0.08, when: 'beforeChildren' },
    },
  }), []);
  const itemVariants = useMemo(() => ({ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }), []);

  return (
    <section className="relative w-full bg-gradient-to-b from-[#0B0B10] to-[#0A0A0A]">
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <div className="grid gap-10 md:grid-cols-5 md:gap-12 items-center">
          {/* Left (60%) */}
          <div className="md:col-span-3">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-semibold text-white mb-6">The Power of the Muse</h2>
            <h3 className="text-xl md:text-2xl text-cyan-300 mb-4">Your AI Co-Author</h3>
            <motion.ul
              variants={listVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.5 }}
              className="space-y-3 text-slate-300/95"
            >
              <motion.li variants={itemVariants}>Writes <span className="font-semibold text-white">novel prose</span> or <span className="font-semibold text-white">manhwa panels</span></motion.li>
              <motion.li variants={itemVariants}>Remembers <span className="font-semibold text-white">every character, rule, and twist</span></motion.li>
              <motion.li variants={itemVariants}>Branches <span className="font-semibold text-white">"What if?"</span> scenarios instantly</motion.li>
              <motion.li variants={itemVariants}>Generates <span className="font-semibold text-white">Flux.1 images</span> on demand</motion.li>
            </motion.ul>

            <div className="mt-8">
              <button
                onClick={() => setOpen(true)}
                className="inline-flex items-center rounded-lg bg-cyan-400 px-5 py-3 font-semibold text-black hover:bg-cyan-300 transition shadow-[0_0_30px_rgba(0,212,255,0.4)]"
              >
                See It In Action
              </button>
            </div>
          </div>

          {/* Right (40%) - Animated system window */}
          <div className="md:col-span-2">
            <motion.div
              animate={pulse ? { boxShadow: ['0 0 24px rgba(0,212,255,0.35)', '0 0 42px rgba(0,212,255,0.6)', '0 0 24px rgba(0,212,255,0.35)'] } : {}}
              transition={{ duration: 0.9, ease: 'easeOut' }}
              className="relative rounded-xl border border-cyan-400/50 bg-black/40 p-4 backdrop-blur-md shadow-[0_0_24px_rgba(0,212,255,0.35)]"
            >
              <div className="mb-3 text-xs tracking-[0.2em] text-cyan-300">SYSTEM WINDOW</div>
              <div className="space-y-3">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{ duration: 0.5 }}
                  className="rounded-md border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-200"
                >
                  <span className="text-cyan-300">User:</span> "What if she betrays him?"
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: [0, 1], y: [8, 0] }}
                  transition={{ duration: 0.6, delay: 0.6 }}
                  className="relative rounded-md border border-cyan-700/60 bg-cyan-950/50 p-3 pr-10 text-sm text-cyan-200"
                >
                  <span className="text-cyan-300">AI:</span> {"{ action: \\\"create_branch\\\", title: \\\"The Knife in the Dark\\\" }"}
                  <button
                    onClick={() => navigator.clipboard?.writeText('{ "action": "create_branch", "title": "The Knife in the Dark" }')}
                    className="absolute right-2 top-2 rounded px-2 py-1 text-[11px] bg-cyan-400/10 text-cyan-200 border border-cyan-400/40 hover:bg-cyan-400/20"
                    aria-label="Copy JSON"
                    title="Copy"
                  >
                    Copy
                  </button>
                </motion.div>
              </div>
              <div className="pointer-events-none absolute -inset-0.5 rounded-xl border border-cyan-400/30 blur-[6px]" />
            </motion.div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-3xl rounded-xl border border-slate-700 bg-slate-950 p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-slate-200 font-semibold">InkVerse Demo</h4>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="aspect-video w-full overflow-hidden rounded-lg border border-slate-800 bg-black">
              {demoUrl ? (
                <iframe
                  className="h-full w-full"
                  src={demoUrl}
                  title="InkVerse Demo"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-300 text-sm">
                  Demo coming soon. Set NEXT_PUBLIC_DEMO_URL to show your video.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
