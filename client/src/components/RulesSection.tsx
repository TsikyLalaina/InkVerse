"use client";

import { motion, useMotionValue, useSpring } from 'framer-motion';

function Card({ title, lines, icon }: { title: string; lines: string[]; icon: React.ReactNode }) {
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const springRx = useSpring(rx, { stiffness: 180, damping: 18 });
  const springRy = useSpring(ry, { stiffness: 180, damping: 18 });
  const mx = useMotionValue(0.5); // 0..1
  const my = useMotionValue(0.5); // 0..1

  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.035, rotateX: 2, rotateY: -2, boxShadow: '0 0 46px rgba(0,212,255,0.6)' }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="relative rounded-xl border border-cyan-400/60 bg-black/40 p-5 backdrop-blur-md shadow-[0_0_26px_rgba(0,212,255,0.3)] hover:border-cyan-300/80"
      style={{ rotateX: springRx as any, rotateY: springRy as any, transformPerspective: 800 }}
      onMouseMove={(e) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width;  // 0..1
        const py = (e.clientY - rect.top) / rect.height;  // 0..1
        const max = 4; // degrees
        ry.set((px - 0.5) * max);
        rx.set(-(py - 0.5) * max);
        mx.set(px);
        my.set(py);
      }}
      onMouseLeave={() => { rx.set(0); ry.set(0); }}
    >
      {/* Dynamic glow towards cursor */}
      <div
        className="pointer-events-none absolute inset-0 rounded-xl"
        style={{
          background: `radial-gradient(240px circle at calc(${(mx.get() * 100).toFixed(2)}%) calc(${(my.get() * 100).toFixed(2)}%), rgba(34,211,238,0.15), transparent 60%)`
        }}
      />

      <div className="relative mb-3 flex items-center gap-2 text-cyan-300">
        <motion.span
          className="inline-flex h-6 w-6 items-center justify-center"
          style={{ x: useSpring(useMotionValue(0), { stiffness: 220, damping: 20 }), y: useSpring(useMotionValue(0), { stiffness: 220, damping: 20 }) }}
          animate={{
            x: (mx.get() - 0.5) * 6,
            y: (my.get() - 0.5) * 6,
          }}
          transition={{ type: 'spring', stiffness: 220, damping: 20 }}
        >
          {icon}
        </motion.span>
        <span className="text-xs tracking-[0.2em]">SYSTEM CARD</span>
      </div>
      <div className="text-lg font-semibold text-white mb-2">{title}</div>
      <ul className="text-sm text-slate-300 space-y-1.5">
        {lines.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
      {/* Corner accents */}
      <span className="pointer-events-none absolute left-0 top-0 h-5 w-5 border-l-2 border-t-2 border-cyan-400/70" />
      <span className="pointer-events-none absolute right-0 top-0 h-5 w-5 border-r-2 border-t-2 border-cyan-400/70" />
      <span className="pointer-events-none absolute left-0 bottom-0 h-5 w-5 border-l-2 border-b-2 border-cyan-400/70" />
      <span className="pointer-events-none absolute right-0 bottom-0 h-5 w-5 border-r-2 border-b-2 border-cyan-400/70" />
      <div className="pointer-events-none absolute -inset-0.5 rounded-xl border border-cyan-400/30 blur-[6px]" />

      {/* Reflection sweep */}
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-xl"
        initial={false}
        whileHover={{ background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.08) 50%, transparent 70%)' }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
    </motion.div>
  );
}

export default function RulesSection() {
  return (
    <section className="relative w-full py-16 md:py-24">
      {/* Subtle grid background */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6">
        <h2 className="text-2xl md:text-3xl lg:text-4xl font-semibold text-white mb-10">Your Story, Your Rules</h2>
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.12 } } }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}>
            <Card
            title="WORLD BUILDING"
            lines={["Define magic,", "factions, tech"]}
            icon={
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
                <path d="M12 3l9 4.5v9L12 21 3 16.5v-9L12 3z" stroke="#22d3ee" strokeWidth="1.5" />
                <path d="M12 3v18M3 7.5l9 4.5 9-4.5" stroke="#22d3ee" strokeWidth="1.2" opacity=".7" />
              </svg>
            }
          />
          </motion.div>
          <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}>
            <Card
            title="CHARACTER BIBLE"
            lines={["Full profiles,", "arcs, secrets"]}
            icon={
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
                <path d="M5 4h11a3 3 0 013 3v12H8a3 3 0 01-3-3V4z" stroke="#22d3ee" strokeWidth="1.5" />
                <path d="M8 4v12a3 3 0 003 3" stroke="#22d3ee" strokeWidth="1.2" opacity=".7" />
              </svg>
            }
          />
          </motion.div>
          <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}>
            <Card
            title="BRANCHING PATHS"
            lines={["Explore alternate", "endings instantly"]}
            icon={
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
                <path d="M4 18h4a4 4 0 004-4V6M12 10h4a4 4 0 014 4v4" stroke="#22d3ee" strokeWidth="1.5" />
                <circle cx="12" cy="6" r="2" stroke="#22d3ee" strokeWidth="1.5" />
              </svg>
            }
          />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
