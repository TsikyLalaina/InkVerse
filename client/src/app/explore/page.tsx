"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { createApi } from "@/lib/api";
import { BookOpen } from "lucide-react";

type PublicProject = {
  id: string;
  title: string;
  description?: string | null;
  coverImage?: string | null;
  mode?: "novel" | "manhwa" | "convert";
  genres?: string[] | null;
  createdAt: string;
  publicSlug?: string | null;
  chapterCount?: number;
};

export default function ExplorePage() {
  const supabase = useSupabase();
  const api = useMemo(() => createApi(supabase), [supabase]);
  const router = useRouter();

  const [items, setItems] = useState<PublicProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [view, setView] = useState<"list" | "gallery">("list");

  const load = async (reset: boolean) => {
    try {
      setLoading(true);
      const p = reset ? 0 : page;
      const res = await api.getPublicProjects(p, 30, q || undefined);
      setTotal(res.total || 0);
      setItems((prev) => reset ? res.items as PublicProject[] : prev.concat(res.items as PublicProject[]));
      setPage(p + 1);
    } catch (e: any) {
      setError(e?.message || "Failed to load public projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setItems([]);
    setPage(0);
    setTotal(0);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const onScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (loading) return;
    const more = items.length < total;
    if (!more) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      await load(false);
    }
  };

  return (
    <div className="min-h-screen text-text-primary">
      <div className="sticky top-0 z-10 bg-bg-primary/80 backdrop-blur-soft border-b border-border-default">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="font-semibold tracking-wide">Explore Public Library</div>
          <div className="flex items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search public projects"
              className="rounded-md bg-bg-primary border border-border-default px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent transition-colors"
            />
            <div className="flex gap-2 text-xs">
              <button onClick={() => setView("list")} className={`px-3 py-2 rounded-md border transition-all ${view === "list" ? "bg-accent text-black border-accent" : "border-border-default text-text-secondary hover:bg-bg-hover"}`}>List</button>
              <button onClick={() => setView("gallery")} className={`px-3 py-2 rounded-md border transition-all ${view === "gallery" ? "bg-accent text-black border-accent" : "border-border-default text-text-secondary hover:bg-bg-hover"}`}>Gallery</button>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {error && <div className="text-sm text-red-400 p-4 rounded-lg bg-red-950/20 border border-red-500/20 mb-4">{error}</div>}
        <div onScroll={onScroll} className="h-[calc(100vh-10rem)] overflow-y-auto pr-1 md:pr-2">
          <div className={view === 'gallery' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}>
            {items.map((p) => (
              <PublicCard key={p.id} item={p} view={view} onRead={(slug) => router.push(`/read/${slug}`)} />
            ))}
          </div>
          {loading && (
            <div className="py-4 text-center text-sm text-text-secondary">Loading…</div>
          )}
          {!loading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                <BookOpen className="w-10 h-10 text-accent" />
              </div>
              <div className="text-base font-semibold text-text-primary mb-2">No Public Projects</div>
              <div className="text-sm text-text-secondary max-w-xs">Try a different search.</div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function PublicCard({ item, view, onRead }: { item: PublicProject; view: "list" | "gallery"; onRead: (slug: string) => void; }) {
  if (view === 'gallery') {
    return (
      <div className="rounded-xl border border-border-default bg-bg-elevated overflow-hidden hover:shadow-elevation hover:scale-[1.02] transition-all duration-micro flex flex-col">
        <div className="relative w-full pt-[133%] overflow-hidden bg-bg-primary">
          {item.coverImage ? (
            <img src={item.coverImage} alt={item.title} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <BookOpen className="w-12 h-12 text-text-tertiary/30" />
            </div>
          )}
        </div>
        <div className="p-4 flex flex-col gap-3 flex-1">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-text-primary truncate">{item.title}</div>
              <div className="text-xs text-text-tertiary">{labelMode(item.mode)}</div>
            </div>
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-accent text-black">{(item.chapterCount || 0)} ch</span>
          </div>
          <button onClick={() => onRead(item.publicSlug!)} className="w-full rounded-md bg-accent px-3 py-2 text-xs font-semibold text-black hover:bg-accent-hover transition-all duration-micro inline-flex items-center justify-center gap-1 mt-auto">
            <BookOpen className="w-3 h-3" aria-hidden="true" />
            <span>Read</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-default bg-bg-elevated p-6 hover:shadow-elevation hover:scale-[1.01] transition-all duration-micro">
      <div className="flex items-center gap-2 mb-1">
        <div className="text-base font-semibold text-text-primary">{item.title}</div>
        <span className="px-2 py-0.5 rounded text-xs font-bold bg-accent text-black">{(item.chapterCount || 0)} ch</span>
      </div>
      <div className="text-xs text-text-tertiary">{labelMode(item.mode)} • {new Date(item.createdAt).toLocaleDateString()}</div>
      <div className="mt-6 grid grid-cols-[minmax(160px,200px)_1fr] gap-6 items-start">
        <div className="relative w-full pt-[133%] overflow-hidden rounded-lg border border-border-default bg-bg-primary">
          {item.coverImage ? (
            <img src={item.coverImage} alt={item.title} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <BookOpen className="w-12 h-12 text-text-tertiary/30" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <div className="text-sm text-text-secondary leading-relaxed line-clamp-3">{(item.description || "").trim() || "No description."}</div>
          <div className="flex items-center gap-3">
            <button onClick={() => onRead(item.publicSlug!)} className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-black hover:bg-accent-hover hover:scale-105 transition-all duration-micro inline-flex items-center gap-1" title="Read Full">
              <BookOpen className="w-4 h-4" aria-hidden="true" />
              <span>Read</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function labelMode(mode?: PublicProject["mode"]) {
  if (mode === "manhwa") return "Manhwa";
  if (mode === "convert") return "Convert";
  return "Novel";
}
