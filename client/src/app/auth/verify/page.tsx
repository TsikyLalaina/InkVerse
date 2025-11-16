"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import SystemWindow from "@/components/SystemWindow";
import PortalBackground from "@/components/PortalBackground";

export default function VerifyPage() {
  const supabase = useSupabase();
  const router = useRouter();
  const [mode, setMode] = useState<"verifying" | "reset" | "done" | "error">("verifying");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("reset");
      } else if (event === "SIGNED_IN") {
        setMode("done");
        setTimeout(() => router.replace("/project"), 600);
      }
    });
    // In case the session is already present (email confirm flow)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setMode("done");
        setTimeout(() => router.replace("/project"), 600);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router, supabase]);

  const submitNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setError(error.message);
    else {
      setMode("done");
      setTimeout(() => router.replace("/auth/login"), 600);
    }
  };

  return (
    <main className="relative min-h-screen grid place-items-center px-6">
      <PortalBackground />
      {mode === "reset" ? (
        <SystemWindow title="SYSTEM — SET NEW PASSWORD">
          <form onSubmit={submitNewPassword} className="space-y-4">
            <label className="block group">
              <div className="mb-1 text-xs tracking-widest text-cyan-300">New password</div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent outline-none text-slate-100 border-b border-cyan-700 focus:border-cyan-400 transition placeholder:text-slate-500 py-2"
                placeholder="••••••••"
              />
            </label>
            {error && <div className="text-sm text-red-400">{error}</div>}
            <button type="submit" className="w-full rounded-lg bg-cyan-400 py-2.5 font-semibold text-black hover:bg-cyan-300">Update password</button>
          </form>
        </SystemWindow>
      ) : mode === "done" ? (
        <SystemWindow title="SYSTEM — VERIFIED">
          <div className="text-slate-200">Portal open. Redirecting…</div>
        </SystemWindow>
      ) : mode === "error" ? (
        <SystemWindow title="SYSTEM — ERROR">
          <div className="text-red-400">Something went wrong. Please retry the link or contact support.</div>
        </SystemWindow>
      ) : (
        <SystemWindow title="SYSTEM — VERIFY">
          <div className="text-slate-200">Verifying your link…</div>
        </SystemWindow>
      )}
    </main>
  );
}
