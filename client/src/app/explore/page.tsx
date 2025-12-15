"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState, useRef, memo } from "react";
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

function rankForProject(id: string) {
  let x = 0;
  for (let i = 0; i < id.length; i++) x = (x * 31 + id.charCodeAt(i)) >>> 0;
  const r = ["S", "A", "B", "C"][x % 4];
  return r as 'S' | 'A' | 'B' | 'C';
}

export default function ExplorePage() {
  const supabase = useSupabase();
  const api = useMemo(() => createApi(supabase), [supabase]);
  const router = useRouter();

  const [items, setItems] = useState<PublicProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"recent" | "rank">("recent");
  const [view, setView] = useState<"list" | "gallery">("list");
  const [modeFilter, setModeFilter] = useState<'all' | 'novel' | 'manhwa'>('all');
  const [rankFilter, setRankFilter] = useState<'all' | 'S' | 'A' | 'B' | 'C'>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | '7d' | '30d'>('all');
  const [genreFilters, setGenreFilters] = useState<Set<string>>(new Set());
  const [readerOpen, setReaderOpen] = useState<{ slug: string; mode: "novel" | "manhwa" } | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(false);

  // Check screen size on mount and resize
  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= 1024);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Load all public projects on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        let allItems: PublicProject[] = [];
        let page = 0;
        let hasMore = true;
        
        while (hasMore) {
          const res = await api.getPublicProjects(page, 100);
          allItems = allItems.concat(res.items as PublicProject[]);
          hasMore = allItems.length < (res.total || 0);
          page++;
        }
        
        if (mounted) {
          setItems(allItems);
        }
      } catch (e: any) {
        if (mounted) {
          setError(e?.message || "Failed to load public projects");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();
    return () => { mounted = false; };
  }, [api]);

  const filtered = useMemo(() => {
    let result = items;
    
    // Search filter
    if (q.trim()) {
      const query = q.toLowerCase();
      result = result.filter(p =>
        p.title.toLowerCase().includes(query) || (p.description || "").toLowerCase().includes(query)
      );
    }
    
    // Mode filter
    if (modeFilter !== 'all') {
      result = result.filter(p => p.mode === modeFilter);
    }
    
    // Rank filter
    if (rankFilter !== 'all') {
      result = result.filter(p => rankForProject(p.id) === rankFilter);
    }
    
    // Time filter
    if (timeFilter !== 'all') {
      const now = Date.now();
      const maxAge = timeFilter === '7d' ? 7 : 30; // days
      result = result.filter(p => {
        const t = new Date(p.createdAt).getTime();
        return (now - t) <= maxAge * 24 * 60 * 60 * 1000;
      });
    }
    
    // Genre filter
    if (genreFilters.size > 0) {
      result = result.filter(p => {
        const projectGenres = (p.genres || []) as string[];
        return projectGenres.some(g => genreFilters.has(g));
      });
    }
    
    return result;
  }, [items, q, modeFilter, rankFilter, timeFilter, genreFilters]);

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 bg-bg-primary/80 backdrop-blur-soft flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-accent/30 border-t-accent rounded-full animate-spin" />
            <div className="text-sm text-text-secondary">Loading projects...</div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-bg-primary/80 backdrop-blur-soft border-b border-border-default">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-3 sm:mb-0">
            <div className="text-base sm:text-lg font-semibold tracking-elegant">EXPLORE PUBLIC LIBRARY</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search stories..."
              className="w-full sm:w-auto rounded-md bg-bg-elevated border border-border-default px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent transition-colors"
            />
          </div>

          {/* Toggle buttons for mobile */}
          <div className="lg:hidden flex gap-2">
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="flex-1 rounded-md bg-bg-elevated border border-border-default px-3 py-2 text-sm font-semibold text-text-primary hover:bg-bg-hover transition-colors"
            >
              {filtersOpen ? '✕ Hide Filters' : '⊕ Show Filters'}
            </button>
            <button
              onClick={() => setControlsOpen(!controlsOpen)}
              className="flex-1 rounded-md bg-bg-elevated border border-border-default px-3 py-2 text-sm font-semibold text-text-primary hover:bg-bg-hover transition-colors"
            >
              {controlsOpen ? '✕ Hide Controls' : '⊕ Show Controls'}
            </button>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-4 sm:py-6 flex flex-col lg:flex-row gap-4 sm:gap-6 h-auto lg:h-[calc(100vh-6rem)]">
        {/* Filters Sidebar */}
        {(filtersOpen || isLargeScreen) && (
          <LeftFilters 
            modeFilter={modeFilter} 
            onModeFilter={setModeFilter} 
            rankFilter={rankFilter} 
            onRankFilter={setRankFilter}
            timeFilter={timeFilter}
            onTimeFilter={setTimeFilter}
            genreFilters={genreFilters}
            onGenreFiltersChange={setGenreFilters}
            projects={items}
          />
        )}

        {/* Center - Story Vault */}
        <PublicVault 
          items={filtered} 
          sort={sort} 
          view={view} 
          loading={loading} 
          onRead={(slug, mode) => setReaderOpen({ slug, mode: mode === "manhwa" ? "manhwa" : "novel" })} 
        />

        {/* Controls Sidebar */}
        {(controlsOpen || isLargeScreen) && (
          <RightControls sort={sort} onSort={setSort} view={view} onView={setView} />
        )}
      </main>

      {/* Reader Modal */}
      {readerOpen && (
        <PublicReaderOverlay
          slug={readerOpen.slug}
          initialMode={readerOpen.mode}
          onClose={() => setReaderOpen(null)}
        />
      )}
    </div>
  );
}

function LeftFilters({ modeFilter, onModeFilter, rankFilter, onRankFilter, timeFilter, onTimeFilter, genreFilters, onGenreFiltersChange, projects }: { modeFilter: 'all' | 'novel' | 'manhwa'; onModeFilter: (m: 'all' | 'novel' | 'manhwa') => void; rankFilter: 'all' | 'S' | 'A' | 'B' | 'C'; onRankFilter: (r: 'all' | 'S' | 'A' | 'B' | 'C') => void; timeFilter: 'all' | '7d' | '30d'; onTimeFilter: (t: 'all' | '7d' | '30d') => void; genreFilters: Set<string>; onGenreFiltersChange: (filters: Set<string>) => void; projects: PublicProject[]; }) {
  const [genreExpanded, setGenreExpanded] = useState(false);

  const allAvailableGenres = useMemo(() => {
    const genres = new Set<string>();
    projects.forEach(p => {
      (p.genres || []).forEach(g => genres.add(g));
    });
    return Array.from(genres).sort();
  }, [projects]);

  const handleGenreToggle = (genre: string) => {
    const newFilters = new Set(genreFilters);
    if (newFilters.has(genre)) {
      newFilters.delete(genre);
    } else {
      newFilters.add(genre);
    }
    onGenreFiltersChange(newFilters);
  };

  const handleClearGenres = () => {
    onGenreFiltersChange(new Set());
  };

  return (
    <aside className="w-full lg:basis-1/5 bg-bg-elevated border border-border-default rounded-xl p-4 sm:p-6 h-fit space-y-4 shadow-elevation overflow-y-auto max-h-none lg:max-h-[calc(100vh-8rem)]">
      <div className="text-sm font-semibold tracking-elegant">FILTERS</div>
      
      <div>
        <div className="text-xs text-text-tertiary mb-2">Mode</div>
        <select value={modeFilter} onChange={(e) => onModeFilter(e.target.value as any)} className="w-full rounded-md bg-bg-primary border border-border-default px-3 py-2 text-sm text-text-primary focus:border-accent transition-colors duration-micro">
          <option value="all">All Modes</option>
          <option value="novel">Novel</option>
          <option value="manhwa">Manhwa</option>
        </select>
      </div>

      <div>
        <div className="text-xs text-text-tertiary mb-2">Rank</div>
        <select value={rankFilter} onChange={(e) => onRankFilter(e.target.value as any)} className="w-full rounded-md bg-bg-primary border border-border-default px-3 py-2 text-sm text-text-primary focus:border-accent transition-colors duration-micro">
          <option value="all">All Ranks</option>
          <option value="S">S Rank</option>
          <option value="A">A Rank</option>
          <option value="B">B Rank</option>
          <option value="C">C Rank</option>
        </select>
      </div>

      <div>
        <div className="text-xs text-text-tertiary mb-2">Time</div>
        <select value={timeFilter} onChange={(e) => onTimeFilter(e.target.value as any)} className="w-full rounded-md bg-bg-primary border border-border-default px-3 py-2 text-sm text-text-primary focus:border-accent transition-colors duration-micro">
          <option value="all">All Time</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
      </div>

      <div className="border-t border-border-default pt-4">
        <button
          onClick={() => setGenreExpanded(!genreExpanded)}
          className="w-full flex items-center justify-between text-xs text-text-tertiary hover:text-text-secondary transition-colors"
        >
          <span className="font-medium">Genres {genreFilters.size > 0 && `(${genreFilters.size})`}</span>
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${genreExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>

        {genreExpanded && (
          <div className="mt-3 space-y-2">
            {genreFilters.size > 0 && (
              <button
                onClick={handleClearGenres}
                className="w-full text-xs text-accent hover:text-accent/80 transition-colors text-left py-1"
              >
                Clear all
              </button>
            )}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {allAvailableGenres.map(genre => {
                const isSelected = genreFilters.has(genre);
                return (
                  <label key={genre} className="flex items-center gap-2 text-xs cursor-pointer transition-colors hover:text-text-primary">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleGenreToggle(genre)}
                      className="rounded border-border-default"
                    />
                    <span>{genre}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function PublicVault({ items, sort, view, loading, onRead }: { items: PublicProject[]; sort: "recent" | "rank"; view: "list" | "gallery"; loading: boolean; onRead: (slug: string, mode?: PublicProject["mode"]) => void; }) {
  const [visible, setVisible] = useState(10);

  const sorted = useMemo(() => {
    const arr = [...items];
    if (sort === "rank") {
      const rankOrder: Record<string, number> = { S: 0, A: 1, B: 2, C: 3 };
      arr.sort((a, b) => (rankOrder[rankForProject(a.id)] - rankOrder[rankForProject(b.id)]));
    } else {
      arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return arr;
  }, [items, sort]);

  useEffect(() => { setVisible(10); }, [items.length, sort]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      setVisible((v: number) => Math.min(v + 10, sorted.length));
    }
  };

  return (
    <section className="w-full lg:basis-3/5 flex-1 overflow-hidden">
      <div className="mb-3">
        <div className="text-sm font-semibold tracking-elegant">STORY VAULT</div>
      </div>
      <div onScroll={handleScroll} className="h-auto lg:h-[calc(100vh-14rem)] overflow-y-auto pr-1 lg:pr-2">
        <div className={view === 'gallery' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}>
          {sorted.slice(0, visible).map((p) => (
            <PublicCard
              key={p.id}
              item={p}
              view={view}
              onRead={onRead}
            />
          ))}
        </div>
        {visible < sorted.length && (
          <div className="py-4 text-center text-sm text-text-secondary">Loading more…</div>
        )}
        {!loading && sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mb-4">
              <BookOpen className="w-10 h-10 text-accent" />
            </div>
            <div className="text-base font-semibold text-text-primary mb-2">No Public Projects</div>
            <div className="text-sm text-text-secondary max-w-xs">Try a different search or filter.</div>
          </div>
        )}
      </div>
    </section>
  );
}

function RightControls({ sort, onSort, view, onView }: { sort: "recent" | "rank"; onSort: (s: "recent" | "rank") => void; view: "list" | "gallery"; onView: (v: "list" | "gallery") => void; }) {
  return (
    <aside className="w-full lg:basis-1/5 bg-bg-elevated border border-border-default rounded-xl p-4 sm:p-6 h-fit space-y-4 shadow-elevation">
      <div className="text-sm font-semibold tracking-elegant">CONTROLS</div>
      <div className="text-xs text-text-tertiary">Sort</div>
      <select value={sort} onChange={(e) => onSort(e.target.value as any)} className="w-full rounded-md bg-bg-primary border border-border-default px-3 py-2 text-sm text-text-primary focus:border-accent transition-colors duration-micro">
        <option value="recent">Recent</option>
        <option value="rank">Rank</option>
      </select>
      <div className="text-xs text-text-tertiary">View</div>
      <div className="flex gap-2">
        <button onClick={() => onView("list")} className={`flex-1 rounded-md px-3 py-2 text-sm border transition-all duration-micro ${view === "list" ? "bg-accent text-black border-accent" : "border-border-default text-text-secondary hover:bg-bg-hover"}`}>List</button>
        <button onClick={() => onView("gallery")} className={`flex-1 rounded-md px-3 py-2 text-sm border transition-all duration-micro ${view === "gallery" ? "bg-accent text-black border-accent" : "border-border-default text-text-secondary hover:bg-bg-hover"}`}>Gallery</button>
      </div>
    </aside>
  );
}

const PublicCard = memo(function PublicCard({ item, view, onRead }: { item: PublicProject; view: "list" | "gallery"; onRead: (slug: string, mode?: PublicProject["mode"]) => void; }) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const rank = rankForProject(item.id);
  const rankColors: Record<string, string> = {
    S: 'bg-gradient-to-r from-gold-start to-gold-end text-black',
    A: 'bg-accent text-black',
    B: 'bg-success text-black',
    C: 'bg-text-tertiary text-white'
  };

  // Gallery view: compact card
  if (view === 'gallery') {
    return (
      <div ref={cardRef} className="rounded-xl border border-border-default bg-bg-elevated overflow-hidden hover:shadow-elevation hover:scale-[1.02] transition-all duration-micro flex flex-col">
        <div className="relative w-1/2 sm:w-full pt-[66%] sm:pt-[133%] overflow-hidden rounded-lg border-0 sm:border-0 bg-transparent sm:bg-bg-primary mx-auto sm:mx-0">
          {item.coverImage ? (
            <img src={item.coverImage} alt={item.title} className="absolute inset-0 w-full h-full object-contain sm:object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <BookOpen className="w-12 h-12 text-text-tertiary/30" />
            </div>
          )}
        </div>
        <div className="p-2 sm:p-4 flex flex-col gap-2 sm:gap-3 flex-1">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-xs sm:text-sm font-semibold text-text-primary truncate">{item.title}</div>
              <div className="text-xs text-text-tertiary">{labelMode(item.mode)}</div>
            </div>
            <span className={`px-2 py-0.5 rounded text-xs font-bold flex-shrink-0 ${rankColors[rank]}`}>{rank}</span>
          </div>
          <div className="text-xs text-text-secondary">{item.chapterCount !== null ? `${item.chapterCount} Chapters` : "—"}</div>
          <button onClick={() => onRead(item.publicSlug!, item.mode || "novel")} className="w-full rounded-md bg-accent px-3 py-2 text-xs font-semibold text-black hover:bg-accent-hover transition-all duration-micro inline-flex items-center justify-center gap-1 mt-auto">
            <BookOpen className="w-3 h-3" aria-hidden="true" />
            <span>Read</span>
          </button>
        </div>
      </div>
    );
  }

  // List view: full details
  return (
    <div ref={cardRef} className="rounded-xl border border-border-default bg-bg-elevated p-6 hover:shadow-elevation hover:scale-[1.01] transition-all duration-micro">
      <div className="flex items-center gap-2 mb-1">
        <div className="text-base font-semibold text-text-primary">{item.title}</div>
        <span className={`px-2 py-0.5 rounded text-xs font-bold ${rankColors[rank]}`}>{rank}</span>
      </div>
      <div className="text-xs text-text-tertiary">{labelMode(item.mode)} • {item.chapterCount !== null ? `${item.chapterCount} Chapters` : "Chapters —"}</div>
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
        <div className="flex flex-col gap-3 flex-1">
          <div className="text-sm text-text-secondary leading-relaxed line-clamp-3 max-h-[4.5rem] overflow-hidden">{(item.description || "").trim() || "No preview available."}</div>
          <div className="flex items-center gap-3 relative mt-auto">
            <button onClick={() => onRead(item.publicSlug!, item.mode || "novel")} className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-black hover:bg-accent-hover hover:scale-105 transition-all duration-micro inline-flex items-center gap-1" title="Read Full">
              <BookOpen className="w-4 h-4" aria-hidden="true" />
              <span className="sr-only">Read Full</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

function labelMode(mode?: PublicProject["mode"]) {
  if (mode === "manhwa") return "Manhwa";
  if (mode === "convert") return "Convert";
  return "Novel";
}

function PublicReaderOverlay({ slug, initialMode, onClose }: { slug: string; initialMode: "novel" | "manhwa"; onClose: () => void; }) {
  const supabase = useSupabase();
  const api = useMemo(() => createApi(supabase), [supabase]);
  const [mode, setMode] = useState<"novel" | "manhwa">(initialMode);
  const [chapters, setChapters] = useState<Array<{ id: string; title: string }>>([]);
  const [activeCh, setActiveCh] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [fs, setFs] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const toggleFs = async () => {
    try {
      if (!document.fullscreenElement) {
        await wrapRef.current?.requestFullscreen?.();
        setFs(true);
      } else {
        await document.exitFullscreen();
        setFs(false);
      }
    } catch (e) {
      console.error('Fullscreen error:', e);
    }
  };

  const [chaptersLoading, setChaptersLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setChaptersLoading(true);
        // Load chapters from public API
        const first = await api.getPublicChapters(slug, 0, 100);
        if (!mounted) return;
        let all = first.items as Array<{ id: string; title: string }>;
        const total = typeof first.total === 'number' ? first.total : all.length;
        let page = 1;
        while (all.length < total) {
          const next = await api.getPublicChapters(slug, page, 100);
          all = all.concat(next.items as Array<{ id: string; title: string }>);
          page += 1;
          if (!mounted) return;
        }
        if (mounted) {
          setChapters(all.map((c: any) => ({ id: c.id, title: c.title })));
          setActiveCh(all[0]?.id || null);
          setChaptersLoading(false);
        }
      } catch (e) {
        console.error('Failed to load public chapters:', e);
        if (mounted) setChaptersLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [slug, api]);

  return (
    <div ref={wrapRef} className="fixed inset-0 z-30 bg-bg-primary/95 backdrop-blur-soft">
      <div className="h-12 border-b border-border-default px-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors"
            title="Close reader"
          >
            ✕
          </button>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-text-secondary hover:text-text-primary transition-colors"
            title={sidebarOpen ? "Hide chapters" : "Show chapters"}
          >
            {sidebarOpen ? '☰' : '☰'}
          </button>
          <div className="text-sm font-semibold text-text-primary">Public Reader</div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as any)}
            className="rounded-md bg-bg-elevated border border-border-default px-3 py-1 text-sm text-text-primary focus:border-accent transition-colors"
          >
            <option value="novel">Novel</option>
            <option value="manhwa">Manhwa</option>
          </select>
          <button
            onClick={toggleFs}
            className="text-text-secondary hover:text-text-primary transition-colors p-1"
            title={fs ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {fs ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 4H5a2 2 0 00-2 2v4m0 0v10a2 2 0 002 2h4m0 0h10a2 2 0 002-2v-4m0 0V6a2 2 0 00-2-2h-4m0 0v10" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 20v-4m0 4h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-3rem)]">
        {/* Left sidebar - Chapters (Collapsible) */}
        {sidebarOpen && (
          <div className="w-full sm:w-64 border-r border-border-default bg-bg-elevated overflow-y-auto">
            {chaptersLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-3 border-accent/30 border-t-accent rounded-full animate-spin" />
                  <div className="text-xs text-text-secondary">Loading chapters...</div>
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {chapters.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => setActiveCh(ch.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      activeCh === ch.id
                        ? 'bg-accent text-black font-semibold'
                        : 'text-text-secondary hover:bg-bg-hover'
                    }`}
                  >
                    {ch.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          {activeCh ? (
            <ChapterContent slug={slug} chapterId={activeCh} mode={mode} />
          ) : (
            <div className="flex items-center justify-center h-full text-text-secondary">
              No chapters available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChapterContent({ slug, chapterId, mode }: { slug: string; chapterId: string; mode: "novel" | "manhwa"; }) {
  const supabase = useSupabase();
  const api = useMemo(() => createApi(supabase), [supabase]);
  const [chapter, setChapter] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        // Fetch chapters in batches (max 100 per request)
        let allChapters: any[] = [];
        let page = 0;
        let hasMore = true;
        
        while (hasMore) {
          const res = await api.getPublicChapters(slug, page, 100);
          allChapters = allChapters.concat(res.items as any[]);
          hasMore = allChapters.length < (res.total || 0);
          page++;
        }
        
        const found = allChapters.find(c => c.id === chapterId);
        if (mounted && found) {
          setChapter(found);
        }
      } catch (e) {
        console.error('Failed to load chapter:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [slug, chapterId, api]);

  if (loading) {
    return <div className="flex items-center justify-center h-full text-text-secondary">Loading…</div>;
  }

  if (!chapter) {
    return <div className="flex items-center justify-center h-full text-text-secondary">Chapter not found</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-8 py-12">
      <h1 className="text-3xl font-bold text-text-primary mb-2">{chapter.title}</h1>
      <div className="text-sm text-text-tertiary mb-8">
        {new Date(chapter.createdAt).toLocaleDateString()}
      </div>

      {mode === 'novel' ? (
        <div className="prose prose-invert max-w-none">
          <div className="text-text-secondary leading-relaxed whitespace-pre-wrap">
            {chapter.content}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {chapter.panelScript && (
            <div className="text-text-secondary leading-relaxed whitespace-pre-wrap">
              {chapter.panelScript}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
