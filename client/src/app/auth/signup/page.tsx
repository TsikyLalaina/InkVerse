"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import SystemWindow from "@/components/SystemWindow";
import PortalBackground from "@/components/PortalBackground";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { motion } from "framer-motion";
import Link from "next/link";

export default function SignupPage() {
  const supabase = useSupabase();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") router.replace("/dashboard");
    });
    return () => sub.subscription.unsubscribe();
  }, [router, supabase]);

  const signUpEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${origin}/auth/verify` },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  const signUpGoogle = async () => {
    setLoading(true);
    setError(null);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${origin}/dashboard` } });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen grid place-items-center px-6">
      <PortalBackground />
      <SystemWindow title="SYSTEM — SIGN UP">
        {sent ? (
          <div className="space-y-4 text-slate-200">
            <p>We sent a confirmation link to {email}. Please verify your email to continue.</p>
            <div className="text-sm text-slate-400">Didn’t get it? Check spam or try again.</div>
            <button
              onClick={() => setSent(false)}
              className="rounded-lg border border-cyan-400/60 px-4 py-2 text-cyan-200 hover:bg-cyan-400/10"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={signUpEmail} className="space-y-4">
            <Field label="Email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent outline-none text-slate-100 border-b border-cyan-700 focus:border-cyan-400 transition placeholder:text-slate-500 py-2"
                placeholder="hunter@gate.com"
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent outline-none text-slate-100 border-b border-cyan-700 focus:border-cyan-400 transition placeholder:text-slate-500 py-2"
                placeholder="••••••••"
              />
            </Field>

            {error && <div className="text-sm text-red-400">{error}</div>}

            <motion.button
              whileTap={{ scale: 0.98 }}
              disabled={loading}
              type="submit"
              className="w-full rounded-lg bg-cyan-400 py-2.5 font-semibold text-black hover:bg-cyan-300 shadow-[0_0_20px_rgba(0,212,255,0.45)]"
            >
              {loading ? "Creating…" : "Create account"}
            </motion.button>

            <button
              type="button"
              onClick={signUpGoogle}
              className="w-full rounded-lg border border-cyan-400/60 bg-cyan-400/10 py-2.5 text-cyan-200 hover:bg-cyan-400/20"
            >
              Continue with Google
            </button>

            <div className="flex items-center justify-between text-sm text-slate-400 pt-2">
              <Link href="/auth/login" className="hover:text-white">Already have an account?</Link>
              <Link href="/auth/forgot" className="hover:text-white">Forgot password</Link>
            </div>
          </form>
        )}
      </SystemWindow>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block group">
      <div className="mb-1 text-xs tracking-widest text-cyan-300">{label}</div>
      <div className="relative">
        {children}
        <span className="pointer-events-none absolute left-0 right-0 -bottom-px h-[1.5px] bg-cyan-400/0 group-focus-within:bg-cyan-400/80 transition" />
      </div>
    </label>
  );
}
