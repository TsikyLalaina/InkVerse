import { useState, useEffect } from "react";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { createApi } from "@/lib/api";
import { Loader2, DollarSign, TrendingUp, History, AlertCircle, X } from "lucide-react";

export function RevenueDashboard() {
  const supabase = useSupabase();
  const api = createApi(supabase);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Payout Form State
  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [bankDetails, setBankDetails] = useState({
    name: "",
    bankName: "",
    accountNumber: "",
    swift: ""
  });

  const fetchStats = async () => {
    try {
      const res = await api.get('/api/payment/author-stats');
      setStats(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleOpenPayout = () => {
    if (!stats) return;
    setShowPayoutForm(true);
  };

  const handleSubmitPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stats) return;

    setRequesting(true);
    try {
      // Format the note
      const note = `Bank Transfer Details:\nName: ${bankDetails.name}\nBank: ${bankDetails.bankName}\nAccount: ${bankDetails.accountNumber}\nSWIFT/BIC: ${bankDetails.swift}`;
      
      await api.post('/api/payment/request-payout', { 
        amount: stats.availableBalance,
        note: note
      });
      
      fetchStats();
      setShowPayoutForm(false);
      setBankDetails({ name: "", bankName: "", accountNumber: "", swift: "" });
      alert("Payout requested successfully!");
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setRequesting(false);
    }
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-accent" /></div>;

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
         <h2 className="text-2xl font-bold text-text-primary tracking-tight">Revenue Dashboard</h2>
         <div className="text-xs text-text-tertiary">1 Coin = $0.005 Est.</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Cards same as before */}
        <div className="bg-bg-elevated border border-border-default rounded-xl p-6 shadow-sm">
           <div className="flex items-center gap-3 mb-2 text-text-secondary">
             <div className="p-2 bg-green-500/10 rounded-lg text-green-500"><TrendingUp size={20} /></div>
             <span className="text-sm font-medium">Lifetime Revenue</span>
           </div>
           <div className="text-3xl font-bold text-text-primary ml-1">
             ${(stats?.totalRevenue / 100).toFixed(2)}
           </div>
           <div className="text-xs text-text-tertiary mt-2 ml-1">
             {stats?.totalCoinsEarned.toLocaleString()} paid coins earned
           </div>
        </div>

        <div className="bg-bg-elevated border border-border-default rounded-xl p-6 shadow-sm">
           <div className="flex items-center gap-3 mb-2 text-text-secondary">
             <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500"><History size={20} /></div>
             <span className="text-sm font-medium">Total Payouts</span>
           </div>
           <div className="text-3xl font-bold text-text-primary ml-1">
             ${(stats?.totalPaidOut / 100).toFixed(2)}
           </div>
        </div>

        <div className="bg-bg-elevated border border-accent/20 rounded-xl p-6 shadow-sm relative overflow-hidden">
           <div className="absolute top-0 right-0 p-3 opacity-10">
              <DollarSign size={80} className="text-accent" />
           </div>
           <div className="flex items-center gap-3 mb-2 text-text-secondary">
             <div className="p-2 bg-accent/10 rounded-lg text-accent"><DollarSign size={20} /></div>
             <span className="text-sm font-medium">Available Balance</span>
           </div>
           <div className="text-3xl font-bold text-text-primary ml-1 mb-4">
             ${(stats?.availableBalance / 100).toFixed(2)}
           </div>
           <button
             onClick={handleOpenPayout}
             className="w-full py-2 bg-accent hover:bg-accent-hover text-black font-semibold rounded-lg text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
           >
             Request Payout
           </button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-text-primary mb-4">Payout History</h3>
        {stats?.payouts.length === 0 ? (
          <div className="p-8 border border-dashed border-border-default rounded-xl text-center text-text-tertiary text-sm">
            No payout requests found.
          </div>
        ) : (
          <div className="bg-bg-elevated border border-border-default rounded-xl overflow-hidden">
             <table className="w-full text-sm text-left">
               <thead className="bg-bg-hover text-text-secondary font-medium border-b border-border-default">
                  <tr>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Amount</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Note</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-border-default">
                  {stats.payouts.map((p: any) => (
                    <tr key={p.id} className="hover:bg-bg-hover/50 transition">
                      <td className="px-6 py-4 text-text-primary">{new Date(p.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 font-medium text-text-primary">${(p.amount / 100).toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize
                          ${p.status === 'approved' ? 'bg-green-500/10 text-green-400' : 
                            p.status === 'rejected' ? 'bg-red-500/10 text-red-400' : 
                            'bg-yellow-500/10 text-yellow-400'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-text-tertiary max-w-xs truncate" title={p.note}>{p.note || '-'}</td>
                    </tr>
                  ))}
               </tbody>
             </table>
          </div>
        )}
      </div>

      {showPayoutForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in p-4">
          <div className="relative w-full max-w-md bg-bg-base rounded-xl shadow-2xl border border-border-default p-6">
             <button onClick={() => setShowPayoutForm(false)} className="absolute top-4 right-4 text-text-tertiary hover:text-text-primary transition"><X size={20} /></button>
             <h3 className="text-lg font-bold text-text-primary mb-1">Request Payout</h3>
             <p className="text-sm text-text-secondary mb-4">
               Amount: <span className="font-semibold text-accent">${(stats?.availableBalance / 100).toFixed(2)}</span>
             </p>
             
             <form onSubmit={handleSubmitPayout} className="space-y-4">
               <div>
                 <label className="block text-xs font-medium text-text-secondary mb-1">Full Name (Account Holder)</label>
                 <input 
                   required
                   value={bankDetails.name}
                   onChange={e => setBankDetails({...bankDetails, name: e.target.value})}
                   className="w-full rounded-lg bg-bg-elevated border border-border-default px-3 py-2 text-sm text-text-primary focus:border-accent outline-none"
                   placeholder="John Doe"
                 />
               </div>
               <div>
                 <label className="block text-xs font-medium text-text-secondary mb-1">Bank Name</label>
                 <input 
                   required
                   value={bankDetails.bankName}
                   onChange={e => setBankDetails({...bankDetails, bankName: e.target.value})}
                   className="w-full rounded-lg bg-bg-elevated border border-border-default px-3 py-2 text-sm text-text-primary focus:border-accent outline-none"
                   placeholder="Chase Bank"
                 />
               </div>
               <div>
                 <label className="block text-xs font-medium text-text-secondary mb-1">Account Number / IBAN</label>
                 <input 
                   required
                   value={bankDetails.accountNumber}
                   onChange={e => setBankDetails({...bankDetails, accountNumber: e.target.value})}
                   className="w-full rounded-lg bg-bg-elevated border border-border-default px-3 py-2 text-sm text-text-primary focus:border-accent outline-none"
                   placeholder="US123456789"
                 />
               </div>
               <div>
                 <label className="block text-xs font-medium text-text-secondary mb-1">SWIFT / BIC / Routing</label>
                 <input 
                   required
                   value={bankDetails.swift}
                   onChange={e => setBankDetails({...bankDetails, swift: e.target.value})}
                   className="w-full rounded-lg bg-bg-elevated border border-border-default px-3 py-2 text-sm text-text-primary focus:border-accent outline-none"
                   placeholder="CHASUS33"
                 />
               </div>

               <button
                 type="submit"
                 disabled={requesting}
                 className="w-full py-2.5 bg-accent hover:bg-accent-hover text-black font-semibold rounded-lg text-sm transition disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
               >
                 {requesting && <Loader2 size={16} className="animate-spin" />}
                 Submit Request
               </button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}
