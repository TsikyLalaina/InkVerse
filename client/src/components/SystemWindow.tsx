"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { useRef, useState } from "react";

export default function SystemWindow({ title, children, ...rest }: { title: string; children: React.ReactNode } & HTMLMotionProps<"div">) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="relative w-full max-w-md p-8 backdrop-blur-sm
      border-2 border-sky-400/70 shadow-[0_0_40px_rgba(56,189,248,0.35)]
      bg-[linear-gradient(180deg,rgba(17,58,102,0.65)_0%,rgba(9,28,54,0.7)_100%)]"
      ref={rootRef}
      onFocusCapture={() => setActive(true)}
      onBlurCapture={(e) => {
        // if focus left the panel entirely
        if (rootRef.current && !rootRef.current.contains(e.relatedTarget as Node)) setActive(false);
      }}
      {...rest}
    >
      {/* Ornate corner decorations */}
      <OrnateCorners active={active} />

      {/* Top window controls / flourish */}
      <div className="absolute right-3 top-2 text-sky-200/70 text-xs select-none">— ×</div>

      {/* Subtle inner separators like SYSTEM panel */}
      <motion.div
        className="absolute left-0 right-0 top-14 h-px bg-gradient-to-r from-transparent via-sky-200/25 to-transparent"
        animate={{ opacity: active ? 1 : 0.6 }}
        transition={{ duration: 0.25 }}
      />
      <motion.div
        className="absolute left-0 right-0 -bottom-px h-px bg-gradient-to-r from-transparent via-sky-200/15 to-transparent"
        animate={{ opacity: active ? 0.9 : 0.5 }}
        transition={{ duration: 0.25 }}
      />

      <div className="relative mb-6">
        <h1 className="text-center font-orbitron text-2xl text-sky-200 drop-shadow-[0_0_12px_rgba(56,189,248,0.35)]">{title}</h1>
        {/* Glowing underline that intensifies on focus */}
        <motion.div
          className="absolute left-0 right-0 -bottom-2 h-[2px] bg-gradient-to-r from-sky-300/0 via-sky-300/70 to-sky-300/0"
          initial={{ opacity: 0.4, scaleX: 0.6, originX: 0.5 }}
          animate={{ opacity: active ? 1 : 0.5, scaleX: active ? 1 : 0.6 }}
          transition={{ duration: 0.25 }}
        />
      </div>
      {children}
    </motion.div>
  );
}

function OrnateCorners({ active }: { active: boolean }) {
  const common = "pointer-events-none absolute h-10 w-10 opacity-80";
  const stroke = encodeURIComponent("#7dd3fc"); // sky-300
  const path = encodeURIComponent(
    "M2 8 C6 6, 8 4, 10 2 M2 18 C10 12, 16 10, 22 8 M8 22 C12 18, 16 14, 22 12"
  );
  const svg = (rotate: string) => `url("data:image/svg+xml;utf8,` +
    `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24'>` +
    `<path d='${path}' fill='none' stroke='${stroke}' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/>` +
    `</svg>` + `")`;
  return (
    <>
      <motion.div
        className={`${common} left-0 top-0`}
        style={{ backgroundImage: svg("0") }}
        animate={{ rotate: active ? [0, 1.2, 0, -1.2, 0] : 0, scale: active ? 1.02 : 1 }}
        transition={{ duration: 2.4, repeat: active ? Infinity : 0, ease: "easeInOut" }}
      />
      <motion.div
        className={`${common} right-0 top-0`}
        style={{ backgroundImage: svg("90") }}
        animate={{ rotate: active ? [90, 91.2, 90, 88.8, 90] : 90, scale: active ? 1.02 : 1 }}
        transition={{ duration: 2.4, repeat: active ? Infinity : 0, ease: "easeInOut", delay: 0.1 }}
      />
      <motion.div
        className={`${common} left-0 bottom-0`}
        style={{ backgroundImage: svg("-90") }}
        animate={{ rotate: active ? [-90, -88.8, -90, -91.2, -90] : -90, scale: active ? 1.02 : 1 }}
        transition={{ duration: 2.4, repeat: active ? Infinity : 0, ease: "easeInOut", delay: 0.2 }}
      />
      <motion.div
        className={`${common} right-0 bottom-0`}
        style={{ backgroundImage: svg("180") }}
        animate={{ rotate: active ? [180, 181.2, 180, 178.8, 180] : 180, scale: active ? 1.02 : 1 }}
        transition={{ duration: 2.4, repeat: active ? Infinity : 0, ease: "easeInOut", delay: 0.3 }}
      />

      {/* Soft radial glow vignette */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        animate={{ boxShadow: active ? "inset 0 0 120px rgba(56,189,248,0.22)" : "inset 0 0 90px rgba(56,189,248,0.15)" }}
        transition={{ duration: 0.3 }}
      />
    </>
  );
}
