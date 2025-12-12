"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { createApi } from "@/lib/api";
import { ReaderView } from "@/components/ReaderView";

export default function PublicReadPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const supabase = useSupabase();
  const api = useMemo(() => createApi(supabase), [supabase]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<{ id: string; title: string; mode: "novel" | "manhwa"; description?: string | null; coverImage?: string | null } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const p = await api.getPublicProject(slug);
        if (!mounted) return;
        setProject({ id: p.id, title: p.title, mode: (p.mode === "manhwa" ? "manhwa" : "novel"), description: p.description, coverImage: p.coverImage });
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Not found or not public");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [api, slug]);

  if (loading) return <div className="min-h-screen p-6 text-slate-300">Loading…</div>;
  if (error || !project) return <div className="min-h-screen p-6 text-red-400">{error || "Unable to load"}</div>;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 bg-bg-primary/80 backdrop-blur-soft border-b border-border-default px-4 py-3 flex items-center justify-between">
        <div className="font-semibold tracking-wide truncate">{project.title}</div>
        <div className="text-xs text-text-tertiary uppercase">Public Read</div>
      </header>
      <main className="flex-1 min-h-0">
        <ReaderView
          projectId={project.id}
          mode={project.mode}
          onProgress={() => {}}
        />
      </main>
    </div>
  );
}
