"use client";

import { useSupabase } from "@/components/providers/SupabaseProvider";
import { createApi } from "@/lib/api";
import { Loader2, ArrowLeft, Check, X, Building, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function AdminPayoutsPage() {
  const supabase = useSupabase();
  const api = createApi(supabase);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchPayouts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/payment/admin/payouts');
      setPayouts(res);
    } catch (e: any) {
      console.error(e);
      alert("Failed to load payouts: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
  }, []);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    if (!confirm(`Are you sure you want to ${action.toUpperCase()} this request? This cannot be undone.`)) return;
    
    setProcessingId(id);
    try {
      await api.post(`/api/payment/admin/payouts/${id}/${action}`, {});
      // Optimistic update or refetch
      setPayouts(prev => prev.map(p => p.id === id ? { ...p, status: action + 'd' } : p)); // simple 'approved' / 'rejected'
      alert(`Request ${action}d successfully`);
    } catch (e: any) {
      alert(`Failed to ${action}: ` + e.message);
    } finally {
      setProcessingId(null);
      fetchPayouts(); // verification
    }
  };

  return (
    <div className="min-h-screen bg-bg-base text-text-primary p-6 animate-in fade-in">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-4">
              <Link href="/dashboard" className="p-2 hover:bg-bg-hover rounded-full transition text-text-secondary"><ArrowLeft size={24} /></Link>
              <h1 className="text-2xl font-bold tracking-tight">Admin Payout Review</h1>
           </div>
           <button onClick={fetchPayouts} className="px-4 py-2 text-sm bg-bg-elevated border border-border-default rounded-md hover:bg-bg-hover transition">
             Refresh
           </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin w-8 h-8 text-accent" /></div>
         ) : (
          <div className="bg-bg-elevated border border-border-default rounded-xl overflow-hidden shadow-sm">
             <table className="w-full text-sm text-left">
               <thead className="bg-bg-hover text-text-secondary font-medium border-b border-border-default">
                  <tr>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4 w-1/3">Bank Details / Note</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-border-default">
                  {payouts.map((p) => (
                    <tr key={p.id} className="hover:bg-bg-hover/50 transition">
                      <td className="px-6 py-4 whitespace-nowrap text-text-secondary">{new Date(p.createdAt).toLocaleDateString()} <span className="text-xs text-text-tertiary">{new Date(p.createdAt).toLocaleTimeString()}</span></td>
                      <td className="px-6 py-4 font-medium text-text-primary">{p.username}</td>
                      <td className="px-6 py-4 font-bold text-text-primary text-base">${(p.amount / 100).toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <div className="max-h-24 overflow-y-auto bg-bg-base p-2 rounded border border-border-default text-xs font-mono whitespace-pre-wrap text-text-secondary">
                          {p.note || 'No details provided'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize border
                          ${p.status === 'approved' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                            p.status === 'rejected' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 
                            'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {p.status === 'pending' && (
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => handleAction(p.id, 'approve')}
                              disabled={!!processingId}
                              className="p-2 rounded-md bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 transition disabled:opacity-50"
                              title="Approve & Mark as Paid"
                            >
                              <Check size={16} />
                            </button>
                            <button 
                              onClick={() => handleAction(p.id, 'reject')}
                              disabled={!!processingId}
                              className="p-2 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition disabled:opacity-50"
                              title="Reject"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        )}
                        {p.status !== 'pending' && (
                          <span className="text-xs text-text-tertiary">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {payouts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-text-tertiary">
                        No payout requests found.
                      </td>
                    </tr>
                  )}
               </tbody>
             </table>
          </div>
        )}
      </div>
    </div>
  );
}
