"use client";

import { useState } from "react";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { createApi } from "@/lib/api";
import { Loader2, Coins } from "lucide-react";

const PRODUCTS = [
  {
    id: "prod_100coins", // Internal ID
    priceId: "price_1Sp7VM4KRXLkEsHZa5MoYLAB", // REPLACE THIS WITH REAL PRICE ID
    name: "100 InkCoins",
    amount: 100,
    price: "$0.99",
    description: "Perfect for unlocking a few chapters.",
  }
];

export default function CoinStore() {
  const supabase = useSupabase();
  const api = createApi(supabase);
  const [loading, setLoading] = useState<string | null>(null);

  const handleBuy = async (priceId: string) => {
    try {
      setLoading(priceId);
      // Construct return/cancel URLs
      const origin = window.location.origin;
      const successUrl = `${origin}/dashboard?payment=success`;
      const cancelUrl = `${origin}/dashboard?payment=cancelled`;

      // Call API
      const { url } = await api.createCheckoutSession(priceId, successUrl, cancelUrl);
      
      // Redirect
      if (url) window.location.href = url;
    } catch (err) {
      console.error(err);
      alert("Failed to start checkout");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-text-primary mb-6 flex items-center gap-2">
        <Coins className="text-yellow-500" /> Coin Store
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PRODUCTS.map((prod) => (
          <div key={prod.id} className="bg-bg-elevated border border-border-default rounded-xl p-6 flex flex-col items-center text-center shadow-elevation hover:border-accent/50 transition">
            <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mb-4 text-yellow-500">
               <Coins size={32} />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-1">{prod.name}</h3>
            <p className="text-text-secondary text-sm mb-6">{prod.description}</p>
            
            <div className="mt-auto w-full">
               <button
                 onClick={() => handleBuy(prod.priceId)}
                 disabled={!!loading}
                 className="w-full bg-accent hover:bg-accent-hover text-accent-foreground font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition"
               >
                 {loading === prod.priceId ? <Loader2 className="animate-spin" /> : null}
                 Buy for {prod.price}
               </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
