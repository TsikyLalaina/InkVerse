"use client";

import { useState, useEffect } from "react";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { createApi } from "@/lib/api";
import { Lock, Coins, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface UnlockModalProps {
  chapterId: string;
  cost: number;
  onUnlock: () => void;
  onCancel: () => void;
}

export default function UnlockModal({ chapterId, cost, onUnlock, onCancel }: UnlockModalProps) {
  const supabase = useSupabase();
  const api = createApi(supabase);
  const [balance, setBalance] = useState<{ paidCoins: number; bonusCoins: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function fetchBalance() {
      try {
        const bal = await api.getWalletBalance();
        setBalance(bal);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchBalance();
  }, [api]);

  const handleUnlock = async () => {
    if (!balance || balance.total < cost) return;
    setUnlocking(true);
    try {
      await api.unlockChapter(chapterId, cost);
      onUnlock();
    } catch (err: any) {
      alert("Failed to unlock: " + err.message);
    } finally {
      setUnlocking(false);
    }
  };

  const handleBuyCoins = () => {
    // Redirect to store or open store modal
    // For now, let's redirect to dashboard where store is likely located
    router.push('/dashboard'); 
  };

  if (loading) return null;

  const canAfford = balance && balance.total >= cost;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative">
        <button 
          onClick={onCancel}
          className="absolute top-4 right-4 text-slate-400 hover:text-white"
        >
          ✕
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 text-cyan-400">
            <Lock size={32} />
          </div>
          
          <h3 className="text-xl font-bold text-white mb-2">Unlock Chapter</h3>
          <p className="text-slate-400 text-sm mb-6">
            This chapter is locked. Spend coins to continue reading.
          </p>

          <div className="bg-slate-950 rounded-lg p-4 w-full mb-6 flex justify-between items-center border border-slate-800">
             <span className="text-slate-400 text-sm">Cost</span>
             <span className="font-bold text-white flex items-center gap-1">
               {cost} <Coins size={14} className="text-yellow-400" />
             </span>
          </div>

          <div className="flex justify-between w-full text-sm mb-6 px-1">
             <span className="text-slate-400">Your Balance:</span>
             <span className={`font-bold ${canAfford ? 'text-green-400' : 'text-red-400'} flex items-center gap-1`}>
               {balance?.total || 0} <Coins size={14} className="text-yellow-400" />
             </span>
          </div>

          {canAfford ? (
            <button
               onClick={handleUnlock}
               disabled={unlocking}
               className="w-full bg-cyan-400 hover:bg-cyan-300 text-black font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition"
            >
              {unlocking ? <Loader2 className="animate-spin" /> : <Lock size={16} />}
              Unlock for {cost} Coins
            </button>
          ) : (
             <button
               onClick={handleBuyCoins}
               className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition"
            >
               <Coins size={16} />
               Get More Coins
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
