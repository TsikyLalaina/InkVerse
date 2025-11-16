"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/components/providers/SupabaseProvider';

export default function ProjectIndexRedirect() {
  const router = useRouter();
  const supabase = useSupabase();
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) router.replace('/dashboard');
      else router.replace('/auth/login');
    })();
  }, [router, supabase]);
  return <div className="p-6 text-slate-400 text-sm">Redirecting…</div>;
}
