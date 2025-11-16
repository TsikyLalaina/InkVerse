"use client";

import { motion } from "framer-motion";

export default function PortalBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Dark gradient base */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(10,30,40,0.6)_0%,rgba(0,0,0,0.9)_60%,rgba(0,0,0,1)_100%)]" />

      {/* Gate ring */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 0.6, scale: [0.95, 1.05, 0.95] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute left-1/2 top-1/2 h-[60vmin] w-[60vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          boxShadow:
            "inset 0 0 80px rgba(0,212,255,0.25), 0 0 120px rgba(0,212,255,0.25)",
          border: "1.5px solid rgba(0,212,255,0.35)",
          background:
            "radial-gradient(circle at 50% 50%, rgba(0,212,255,0.08), transparent 60%)",
        }}
      />

      {/* Particles */}
      {[...Array(24)].map((_, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 40, scale: 0.8 }}
          animate={{ opacity: [0, 1, 0], y: [-10, -60 - (i % 5) * 10], scale: [0.8, 1, 0.8] }}
          transition={{ duration: 4 + (i % 5), repeat: Infinity, delay: i * 0.15 }}
          className="absolute h-[2px] w-[2px] bg-cyan-300/70 shadow-[0_0_12px_rgba(0,212,255,0.8)]"
          style={{ left: `${(i * 37) % 100}%`, top: `${60 + (i % 20)}%` }}
        />
      ))}
    </div>
  );
}
