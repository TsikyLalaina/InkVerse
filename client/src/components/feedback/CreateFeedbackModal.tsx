import { useState } from 'react';
import { useSupabase } from '@/components/providers/SupabaseProvider';
import { createApi } from '@/lib/api';

export default function CreateFeedbackModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void; }) {
  const supabase = useSupabase();
  const api = createApi(supabase);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'feature' });

  const submit = async () => {
    if (!form.title || !form.description) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      const { error } = await api.createFeedback({ ...form, user_id: user.id });
      if (error) throw error;
      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      alert('Failed to submit feedback');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-border-default bg-bg-elevated p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-text-primary tracking-tight">Submit Feedback</h2>
             <button onClick={onClose} className="text-text-tertiary hover:text-text-primary">✕</button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g., Dark mode is too dark"
              className="w-full rounded-lg bg-bg-primary border border-border-default px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent outline-none transition-colors"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-lg bg-bg-primary border border-border-default px-3 py-2.5 text-sm text-text-primary focus:border-accent outline-none transition-colors"
            >
              <option value="feature">Feature Request</option>
              <option value="bug">Bug Report</option>
              <option value="content">Content</option>
              <option value="docs">Documentation</option>
              <option value="general">General</option>
            </select>
          </div>

          <div>
             <label className="block text-xs font-medium text-text-secondary mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe your idea or the issue you found..."
              className="w-full min-h-[120px] rounded-lg bg-bg-primary border border-border-default px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent outline-none transition-colors resize-none"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading || !form.title || !form.description}
            className="px-4 py-2 rounded-lg text-sm font-bold bg-accent text-black hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? 'Submitting...' : 'Post Feedback'}
          </button>
        </div>
      </div>
    </div>
  );
}
