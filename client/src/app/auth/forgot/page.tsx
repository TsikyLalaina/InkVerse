"use client";

import { useState } from "react";
import SystemWindow from "@/components/SystemWindow";
import PortalBackground from "@/components/PortalBackground";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import Link from "next/link";

export default function ForgotPage() {
  const supabase = useSupabase();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/verify`,
    });
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <main className="relative min-h-screen grid place-items-center px-6">
      <PortalBackground />
      <SystemWindow title="SYSTEM — RESET ACCESS">
        {sent ? (
          <div className="space-y-4 text-slate-200">
            <p>We sent a password reset link to {email}. Follow the link to set a new password.</p>
            <Link href="/auth/login" className="text-cyan-300 hover:text-white">Return to login</Link>
          </div>
        ) : (
          <form onSubmit={sendReset} className="space-y-4">
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
            {error && <div className="text-sm text-red-400">{error}</div>}
            <button type="submit" className="w-full rounded-lg bg-cyan-400 py-2.5 font-semibold text-black hover:bg-cyan-300">Send reset link</button>
            <div className="text-sm text-slate-400 text-right">
              <Link href="/auth/login" className="hover:text-white">Back to login</Link>
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
