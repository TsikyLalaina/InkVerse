"use client";

import React from 'react';
import CoinStore from '@/components/monetization/CoinStore';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/components/providers/SupabaseProvider';

export default function StorePage() {
  const router = useRouter();
  const supabase = useSupabase();
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/login?next=/store');
      } else {
        setLoading(false);
      }
    }
    checkAuth();
  }, [router, supabase]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-bg-primary text-text-secondary"><Loader2 className="animate-spin" /></div>;

  return (
    <main className="min-h-screen bg-bg-primary text-text-primary p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <button 
          onClick={() => router.back()} 
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary mb-8 transition"
        >
          <ArrowLeft size={20} />
          Back
        </button>
        
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-yellow-300 to-amber-500 bg-clip-text text-transparent inline-block">
            Coin Store
          </h1>
          <p className="text-text-secondary">
            Purchase coins to unlock premium chapters and support authors.
          </p>
        </div>

        <CoinStore />
      </div>
    </main>
  );
}
