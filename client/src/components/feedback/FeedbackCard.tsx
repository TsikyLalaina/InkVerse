import { useState } from 'react';
import { useSupabase } from '@/components/providers/SupabaseProvider';
import { createApi } from '@/lib/api';

export default function FeedbackCard({ item, currentUserId }: { item: any, currentUserId?: string }) {
  const supabase = useSupabase();
  const api = createApi(supabase);
  const [votes, setVotes] = useState(item.votes || 0);
  const [hasVoted, setHasVoted] = useState<boolean>(
    !!item.feedback_votes?.find((v: any) => v.user_id === currentUserId)
  );
  const [loading, setLoading] = useState(false);

  const toggleVote = async () => {
    if (loading || !currentUserId) return;
    setLoading(true);

    // Optimistic update
    const newHasVoted = !hasVoted;
    setHasVoted(newHasVoted);
    setVotes((v: number) => newHasVoted ? v + 1 : v - 1);

    try {
      await api.voteFeedback(item.id, hasVoted);
    } catch (e) {
      // Revert if failed
      setHasVoted(!newHasVoted);
      setVotes((v: number) => !newHasVoted ? v + 1 : v - 1);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    open: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    planned: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    in_progress: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    completed: 'bg-green-500/10 text-green-500 border-green-500/20',
    closed: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  };

  const categoryLabels: Record<string, string> = {
    feature: 'Feature Request',
    bug: 'Bug Report',
    general: 'General',
    content: 'Content',
    docs: 'Documentation'
  };

  return (
    <div className="flex gap-4 p-4 rounded-xl border border-border-default bg-bg-elevated hover:border-accent/30 transition-all duration-300">
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={toggleVote}
          disabled={loading || !currentUserId}
          className={`flex flex-col items-center justify-center w-12 h-14 rounded-lg border transition-all duration-200 ${
            hasVoted
              ? 'bg-accent text-black border-accent'
              : 'bg-bg-primary text-text-secondary border-border-default hover:border-accent hover:text-accent'
          } ${!currentUserId ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <svg className="w-4 h-4 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
          </svg>
          <span className="text-sm font-bold">{votes}</span>
        </button>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
            <div>
                 <h3 className="text-base font-semibold text-text-primary mb-1 leading-tight">{item.title}</h3>
                 <p className="text-sm text-text-secondary line-clamp-2 mb-2">{item.description}</p>
            </div>
             <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border ${statusColors[item.status] || statusColors.open}`}>
              {item.status.replace('_', ' ')}
            </span>
        </div>
        
        <div className="flex items-center gap-3 text-xs text-text-tertiary">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-bg-primary border border-border-default">
             {categoryLabels[item.category] || item.category}
          </span>
          <span>•</span>
          <span>{new Date(item.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}
