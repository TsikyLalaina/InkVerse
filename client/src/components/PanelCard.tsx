"use client";

import { useState, useMemo, useEffect } from 'react';
import { useDrag } from 'react-dnd';
import type { DragSourceMonitor } from 'react-dnd';
import { z } from 'zod';
import { useSupabase } from '@/components/providers/SupabaseProvider';

const schema = z.object({
  description: z.string().min(1, 'Description is required').max(1000, 'Keep it concise (<= 1000 chars)')
});

export type PanelCardProps = {
  projectId: string;
  panelId?: string | null;
  initialDescription?: string;
  stylePreset?: string | null;
  imageUrl?: string | null;
  onUpdated?: (description: string) => void;
  onRegenerateQueued?: (jobId: string) => void;
};

export function PanelCard({
  projectId,
  panelId,
  initialDescription,
  stylePreset,
  imageUrl,
  onUpdated,
  onRegenerateQueued,
}: PanelCardProps) {
  const supabase = useSupabase();
  const [description, setDescription] = useState(initialDescription || '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(imageUrl || null);

  useEffect(() => {
    setLocalImageUrl(imageUrl || null);
  }, [imageUrl]);

  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'PANEL',
    item: { panelId },
    canDrag: () => Boolean(panelId),
    collect: (monitor: DragSourceMonitor) => ({ isDragging: monitor.isDragging() })
  }), [panelId]);

  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000', []);

  async function handleSave() {
    const parsed = schema.safeParse({ description });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Invalid');
      return;
    }
    setError(null);
    onUpdated?.(description);
  }

  async function handleRegenerate() {
    const parsed = schema.safeParse({ description });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Invalid');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${apiBase}/api/generate/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          description: parsed.data.description,
          style: stylePreset || undefined,
          projectId: projectId,
        }),
      });
      if (!res.ok) throw new Error(`Failed to queue image (${res.status})`);
      const json = await res.json();
      if (json?.url) setLocalImageUrl(String(json.url));
      if (json?.jobId) onRegenerateQueued?.(String(json.jobId));
    } catch (e: any) {
      setError(e?.message || 'Failed to queue image');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      ref={panelId ? (drag as any) : undefined}
      className={`rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-3 ${isDragging ? 'opacity-60' : ''}`}
    >
      {localImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={localImageUrl} alt="panel" className="w-full h-auto rounded-md" />
      ) : (
        <div className="w-full aspect-[3/4] bg-slate-800 rounded-md grid place-items-center text-slate-500 text-sm">
          No image
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs text-slate-400">Panel description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="w-full resize-y bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 ring-sky-600"
          placeholder="Describe the panel for regeneration"
        />
        {error && <div className="text-xs text-red-400">{error}</div>}
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={handleSave}
          className="px-3 py-1.5 text-sm rounded-md border border-slate-700 hover:bg-slate-800"
          disabled={submitting}
        >
          Save
        </button>
        <button
          onClick={handleRegenerate}
          className="px-3 py-1.5 text-sm rounded-md bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50"
          disabled={submitting}
        >
          {submitting ? 'Queuing…' : 'Regenerate'}
        </button>
      </div>
    </div>
  );
}
