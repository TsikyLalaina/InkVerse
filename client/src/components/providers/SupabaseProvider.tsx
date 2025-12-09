"use client";

import { createContext, useContext, useMemo } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SupabaseCtx = createContext<SupabaseClient | null>(null);

declare global {
  // eslint-disable-next-line no-var
  var __supabase__: SupabaseClient | undefined;
}

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => {
    // Avoid initializing Supabase on the server (build/SSR). Return a harmless stub.
    if (typeof window === 'undefined') {
      return ({} as SupabaseClient);
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) {
      console.warn('Supabase env is missing in NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
      // Provide a stub so hydration can proceed; actual calls will fail until envs are configured.
      return ({} as SupabaseClient);
    }
    if (!window.__supabase__) {
      window.__supabase__ = createClient(url, anon);
    }
    return window.__supabase__;
  }, []);

  return <SupabaseCtx.Provider value={supabase}>{children}</SupabaseCtx.Provider>;
}

export function useSupabase() {
  const ctx = useContext(SupabaseCtx);
  if (!ctx) throw new Error('SupabaseProvider is missing');
  return ctx;
}
