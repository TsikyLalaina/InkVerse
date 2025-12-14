"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useSupabase } from "@/components/providers/SupabaseProvider";

export default function AwakenCTA() {
  const supabase = useSupabase();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setIsLoggedIn(!!session);
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [supabase]);
  return (
    <section className="relative w-full py-20 bg-gradient-to-b from-[#0A0A0A] to-[#0B0B12]">
      <div className="mx-auto max-w-5xl px-6 text-center">
        <div className="relative rounded-2xl border border-cyan-400/60 bg-black/40 p-10 backdrop-blur-md shadow-[0_0_40px_rgba(0,212,255,0.45)]">
          <div className="text-cyan-300 tracking-[0.25em] text-xs">GATE OPEN</div>
          <h3 className="mt-3 text-3xl md:text-5xl font-semibold text-white">Start Your Story</h3>
          <p className="mt-2 text-slate-300">No credit card required</p>

          <motion.div
            initial={{ scale: 0.98, boxShadow: "0 0 0 rgba(0,212,255,0.0)" }}
            animate={{
              scale: [0.98, 1, 0.98],
              boxShadow: [
                "0 0 0 rgba(0,212,255,0.0)",
                "0 0 40px rgba(0,212,255,0.5)",
                "0 0 0 rgba(0,212,255,0.0)",
              ],
            }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4"
          >
            <Link
              href={isLoggedIn ? "/dashboard" : "/auth/signup"}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 rounded-xl bg-cyan-400 px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base text-black font-semibold hover:bg-cyan-300 transition shadow-[0_0_30px_rgba(0,212,255,0.6)]"
            >
              {isLoggedIn ? 'DASHBOARD' : 'ENTER'}
              <span className="text-black/70">→</span>
            </Link>
            <Link
              href="/explore"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 rounded-xl bg-purple-500 px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base text-white font-semibold hover:bg-purple-600 transition shadow-[0_0_30px_rgba(168,85,247,0.6)]"
            >
              EXPLORE
              <span className="text-white/70">→</span>
            </Link>
          </motion.div>

          {/* Outline glow */}
          <div className="pointer-events-none absolute -inset-1 rounded-2xl border border-cyan-400/30 blur-sm" />
        </div>

        {/* Footer */}
        <footer className="mt-10 flex items-center justify-center gap-4 text-sm text-slate-400">
          <Link href="/privacy" className="hover:text-white">Privacy</Link>
          <span>·</span>
          <Link href="/terms" className="hover:text-white">Terms</Link>
          <span>·</span>
          <span>Made with ███ in 2025</span>
        </footer>
      </div>
    </section>
  );
}
