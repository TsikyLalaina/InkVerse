"use client";

import { useEffect, useState } from 'react';
import { useSupabase } from '@/components/providers/SupabaseProvider';
import { createApi } from '@/lib/api';
import Link from 'next/link';
import FeedbackCard from '@/components/feedback/FeedbackCard';
import CreateFeedbackModal from '@/components/feedback/CreateFeedbackModal';
import { ArrowLeft } from 'lucide-react'; 

export default function FeedbackPage() {
  const supabase = useSupabase();
  const api = createApi(supabase);
  const [user, setUser] = useState<any>(null);
  
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'feature' | 'bug' | 'general' | 'content' | 'docs'>('all');
  const [sort, setSort] = useState<'newest' | 'votes'>('votes');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, [supabase]);

  const loadFeedbacks = async () => {
    setLoading(true);
    try {
      const { data, error } = await api.listFeedbacks(filter, sort);
      if (error) throw error;
      setFeedbacks(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedbacks();
  }, [filter, sort]);

  return (
    <div className="flex flex-col bg-bg-primary min-h-screen text-text-primary font-sans transition-colors duration-300">
      <div className="w-full max-w-5xl mx-auto p-4 md:p-8">
        <div className="mb-6">
           <Link href="/dashboard" className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
           </Link>
        </div>
        <main className="flex-1 w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Feedback Hub</h1>
                    <p className="text-text-secondary">Help us build InkVerse together. Vote on ideas or submit your own.</p>
                </div>
                <button 
                  onClick={() => setShowCreate(true)}
                  disabled={!user}
                  className="px-4 py-2 bg-accent text-black font-bold rounded-lg hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                    {user ? 'Submit Feedback' : 'Login to Post'}
                </button>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sticky top-0 bg-bg-primary/95 backdrop-blur z-10 py-4 border-b border-border-default">
                <div className="flex items-center gap-1 bg-bg-elevated p-1 rounded-lg border border-border-default">
                    {['all', 'feature', 'bug', 'content', 'docs', 'general'].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f as any)}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                filter === f 
                                ? 'bg-bg-primary text-text-primary shadow-sm border border-border-default' 
                                : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'
                            }`}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>

                <select 
                    value={sort}
                    onChange={(e) => setSort(e.target.value as any)}
                    className="bg-bg-elevated border border-border-default text-text-secondary text-sm rounded-lg px-3 py-2 outline-none focus:border-accent transition-colors"
                >
                    <option value="votes">Top Voted</option>
                    <option value="newest">Newest</option>
                </select>
            </div>

            {/* List */}
             {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-24 rounded-xl bg-bg-elevated animate-pulse" />
                  ))}
                </div>
              ) : feedbacks.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-border-default rounded-xl">
                  <div className="text-4xl mb-4">💬</div>
                  <h3 className="text-lg font-semibold text-text-primary mb-1">No feedback yet</h3>
                  <p className="text-text-secondary mb-4">Be the first to share your thoughts!</p>
                  <button 
                  onClick={() => setShowCreate(true)}
                   className="text-accent hover:underline font-medium"
                  >
                    Submit an idea
                  </button>
                </div>
              ) : (
                <div className="space-y-4 pb-20">
                  {feedbacks.map((item) => (
                    <FeedbackCard key={item.id} item={item} currentUserId={user?.id} />
                  ))}
                </div>
              )}
        </main>
      </div>
      {showCreate && <CreateFeedbackModal onClose={() => setShowCreate(false)} onSuccess={loadFeedbacks} />}
    </div>
  );
}
