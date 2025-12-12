"use client";

export const dynamic = 'force-dynamic';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Download, GitBranch, FolderOpen, Share2, BookOpen, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { createApi } from "@/lib/api";
import { ReaderView } from "@/components/ReaderView";

type ProjectItem = {
  id: string;
  title: string;
  description?: string | null;
  createdAt: string;
  mode?: "novel" | "manhwa" | "convert";
  coverImage?: string | null;
  genres?: string[] | null;
  visibility?: 'private' | 'public' | 'unlisted';
  publicSlug?: string | null;
};

type Mode = "CREATE" | "READER";

export default function DashboardPage() {
  const supabase = useSupabase();
  const api = useMemo(() => createApi(supabase), [supabase]);
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("CREATE");
  const [overlay, setOverlay] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [query, setQuery] = useState("");
  const [userInitial, setUserInitial] = useState<string>("U");
  const [authChecked, setAuthChecked] = useState(false);
  const [readerSort, setReaderSort] = useState<"recent" | "rank">("recent");
  const [readerView, setReaderView] = useState<"list" | "gallery">("list");
  const [readerModeFilter, setReaderModeFilter] = useState<'all' | 'novel' | 'manhwa'>('all');
  const [readerRankFilter, setReaderRankFilter] = useState<'all' | 'S' | 'A' | 'B' | 'C'>('all');
  const [readerTimeFilter, setReaderTimeFilter] = useState<'all' | '7d' | '30d'>('all');
  const [readerGenreFilters, setReaderGenreFilters] = useState<Set<string>>(new Set());
  const [readerOpen, setReaderOpen] = useState<{ projectId: string; mode: "novel" | "manhwa" } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [userStats, setUserStats] = useState<any>(null);
  const [exportDialog, setExportDialog] = useState<{ projectId: string; title: string } | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportAllDialog, setExportAllDialog] = useState(false);
  const [exportAllLoading, setExportAllLoading] = useState(false);
  const [readerShareLoadingId, setReaderShareLoadingId] = useState<string | null>(null);


  const onSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      router.replace("/auth/login");
    }
  };

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/auth/login");
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email || "U";
      setUserInitial((email[0] || "U").toUpperCase());
      setAuthChecked(true);
    })();
  }, [router, supabase]);

  useEffect(() => {
    if (!authChecked) return;
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        
        // First, sync stats from database records (retroactive calculation)
        const syncedStats = await api.syncUserStats().catch(() => null);
        
        // Then fetch projects and use synced stats
        const list = await api.listProjects();
        
        if (!mounted) return;
        setProjects(list as ProjectItem[]);
        if (syncedStats) setUserStats(syncedStats);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load projects");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [api, authChecked]);

  const filtered = useMemo(() => {
    if (!query.trim()) return projects;
    const q = query.toLowerCase();
    return projects.filter(p =>
      p.title.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q)
    );
  }, [projects, query]);

  const handleReaderShareToggle = useCallback(async (id: string) => {
    const item = projects.find(p => p.id === id);
    if (!item) return;
    setReaderShareLoadingId(id);
    try {
      if (item.visibility === 'public') {
        const res = await api.unpublishProject(id);
        setProjects(prev => prev.map(p => p.id === id ? { ...p, visibility: res.visibility, publicSlug: (res as any).publicSlug ?? p.publicSlug } : p));
      } else {
        const res = await api.publishProject(id);
        const slug = (res as any).publicSlug as string | undefined;
        setProjects(prev => prev.map(p => p.id === id ? { ...p, visibility: res.visibility, publicSlug: slug || p.publicSlug } : p));
        try {
          const origin = typeof window !== 'undefined' ? window.location.origin : '';
          if (origin && slug) {
            const url = `${origin}/read/${slug}`;
            await navigator.clipboard.writeText(url);
          }
        } catch {}
      }
    } catch (e) {
      console.error(e);
    } finally {
      setReaderShareLoadingId(null);
    }
  }, [api, projects]);

  const handleReaderSetVisibility = useCallback(async (id: string, vis: 'private'|'public') => {
    if (vis === 'public') {
      await handleReaderShareToggle(id);
      return;
    }
    if (vis === 'private') {
      // Unpublish if needed
      const item = projects.find(p => p.id === id);
      if (!item) return;
      setReaderShareLoadingId(id);
      try {
        const res = await api.unpublishProject(id);
        setProjects(prev => prev.map(p => p.id === id ? { ...p, visibility: res.visibility } : p));
      } catch (e) {
        console.error(e);
      } finally {
        setReaderShareLoadingId(null);
      }
      return;
    }
  }, [api, projects, handleReaderShareToggle]);

  // Reader-mode specific filtered list (query + mode + rank + timeframe + genres)
  const readerFiltered = useMemo(() => {
    let list = projects;
    // Optional: reuse query if present
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(p => p.title.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q));
    }
    // Mode filter
    if (readerModeFilter !== 'all') {
      list = list.filter(p => (p.mode || 'novel') === readerModeFilter);
    }
    // Rank filter
    if (readerRankFilter !== 'all') {
      list = list.filter(p => rankForProject(p.id) === readerRankFilter);
    }
    // Time filter
    if (readerTimeFilter !== 'all') {
      const now = Date.now();
      const maxAge = readerTimeFilter === '7d' ? 7 : 30; // days
      list = list.filter(p => {
        const t = new Date(p.createdAt).getTime();
        return (now - t) <= maxAge * 24 * 60 * 60 * 1000;
      });
    }
    // Genre filter - show projects that have at least one selected genre
    if (readerGenreFilters.size > 0) {
      list = list.filter(p => {
        const projectGenres = (p.genres || []) as string[];
        return projectGenres.some(g => readerGenreFilters.has(g));
      });
    }
    return list;
  }, [projects, query, readerModeFilter, readerRankFilter, readerTimeFilter, readerGenreFilters]);

  const startCreate = useCallback(() => {
    setCreateTitle("");
    setCreateDesc("");
    setCreateErr(null);
    setCreateOpen(true);
  }, []);

  const submitCreate = useCallback(async () => {
    if (!createTitle.trim()) {
      setCreateErr("Title is required");
      return;
    }
    try {
      setCreateLoading(true);
      const payload: { title: string; description?: string } = { title: createTitle.trim() };
      const d = createDesc.trim();
      if (d) payload.description = d;
      const res = await api.createProject(payload);
      setCreateOpen(false);
      router.push(`/project/${res.id}/chat`);
    } catch (e: any) {
      setCreateErr(e?.message || 'Failed to create project');
    } finally {
      setCreateLoading(false);
    }
  }, [api, createDesc, createTitle, router]);

  const handleOpenProject = useCallback((id: string) => {
    if (!id) return;
    router.push(`/project/${id}/chat`);
  }, [router]);

  const handleBranch = useCallback((id: string) => {
    void id; /* placeholder */
  }, []);

  const handleExport = useCallback((id: string) => {
    const project = projects.find(p => p.id === id);
    if (project) {
      setExportDialog({ projectId: id, title: project.title });
    }
  }, [projects]);

  const performExport = useCallback(async (format: 'json' | 'markdown' | 'text') => {
    if (!exportDialog) return;
    try {
      setExportLoading(true);
      const content = await api.exportProject(exportDialog.projectId, format);
      
      // Determine file extension and MIME type
      const extensions: Record<string, { ext: string; type: string }> = {
        json: { ext: 'json', type: 'application/json' },
        markdown: { ext: 'md', type: 'text/markdown' },
        text: { ext: 'txt', type: 'text/plain' },
      };
      const { ext, type } = extensions[format];
      const filename = `${exportDialog.title}.${ext}`;
      
      // Create blob and download
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setExportDialog(null);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export project');
    } finally {
      setExportLoading(false);
    }
  }, [api, exportDialog]);

  const performExportAll = useCallback(async (format: 'json' | 'markdown' | 'text') => {
    try {
      setExportAllLoading(true);
      
      // Export all projects and create a zip-like structure
      const allContent: Record<string, string> = {};
      
      for (const project of projects) {
        const content = await api.exportProject(project.id, format);
        const ext = format === 'json' ? 'json' : format === 'markdown' ? 'md' : 'txt';
        allContent[`${project.title}.${ext}`] = content;
      }
      
      // Create a combined file with all projects
      let combinedContent = '';
      
      if (format === 'json') {
        // For JSON, create an array of all projects
        const allProjects = Object.entries(allContent).map(([filename, content]) => ({
          filename,
          data: JSON.parse(content),
        }));
        combinedContent = JSON.stringify(allProjects, null, 2);
      } else {
        // For markdown and text, concatenate all with separators
        const separator = format === 'markdown' ? '\n\n---\n\n' : '\n\n' + '='.repeat(80) + '\n\n';
        combinedContent = Object.entries(allContent)
          .map(([filename, content]) => {
            const header = format === 'markdown' ? `# ${filename}\n\n` : `${filename}\n${'-'.repeat(filename.length)}\n\n`;
            return header + content;
          })
          .join(separator);
      }
      
      // Download combined file
      const ext = format === 'json' ? 'json' : format === 'markdown' ? 'md' : 'txt';
      const filename = `InkVerse-Export-${new Date().toISOString().split('T')[0]}.${ext}`;
      const type = format === 'json' ? 'application/json' : format === 'markdown' ? 'text/markdown' : 'text/plain';
      
      const blob = new Blob([combinedContent], { type });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setExportAllDialog(false);
    } catch (err) {
      console.error('Export all failed:', err);
      alert('Failed to export all projects');
    } finally {
      setExportAllLoading(false);
    }
  }, [api, projects]);

  const handleRead = useCallback((id: string, m?: ProjectItem["mode"]) => {
    setReaderOpen({ projectId: id, mode: m === "manhwa" ? "manhwa" : "novel" });
  }, []);

  if (!authChecked) return null;

  return (
    <div className="relative h-screen overflow-hidden text-text-primary animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-gradient-to-b from-bg-primary to-bg-elevated" />
      {overlay && (
        <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: `linear-gradient(rgba(0,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,255,0.06) 1px, transparent 1px)`, backgroundSize: "32px 32px" }} />
      )}
      <div className="relative">
        <TopBar mode={mode} onModeChange={setMode} userInitial={userInitial} onSignOut={onSignOut} userStats={userStats} />
        {mode === "CREATE" ? (
          <MainLayout>
            <LeftStats projectsCount={projects.length} stats={userStats} />
            <CenterProjects
              items={filtered}
              loading={loading}
              error={error}
              onOpen={handleOpenProject}
              onBranch={handleBranch}
              onExport={handleExport}
              onCreate={startCreate}
              onDelete={async (id: string) => {
                // eslint-disable-next-line no-alert
                if (!confirm('Delete this project permanently?')) return;
                try {
                  await api.deleteProject(id);
                  setProjects((prev) => prev.filter((p) => p.id !== id));
                } catch (e: any) {
                  setError(e?.message || 'Failed to delete project');
                }
              }}
            />
            <RightActions
              query={query}
              onQuery={setQuery}
              onCreate={startCreate}
              onExportAll={() => setExportAllDialog(true)}
              overlay={overlay}
              onToggleOverlay={() => setOverlay(v => !v)}
            />
          </MainLayout>
        ) : (
          <MainLayout>
            <LeftLibrary
              modeFilter={readerModeFilter}
              onModeFilter={setReaderModeFilter}
              rankFilter={readerRankFilter}
              onRankFilter={setReaderRankFilter}
              timeFilter={readerTimeFilter}
              onTimeFilter={setReaderTimeFilter}
              genreFilters={readerGenreFilters}
              onGenreFiltersChange={setReaderGenreFilters}
              projects={projects}
            />
            <ReaderCenterVault
              items={readerFiltered}
              sort={readerSort}
              view={readerView}
              onRead={handleRead}
              shareLoadingId={readerShareLoadingId}
              onSetVisibility={handleReaderSetVisibility}
            />
            <RightControls
              sort={readerSort}
              onSort={setReaderSort}
              view={readerView}
              onView={setReaderView}
            />
          </MainLayout>
        )}
        {readerOpen && (
          <ReaderCanvasOverlay
            projectId={readerOpen.projectId}
            initialMode={readerOpen.mode}
            onClose={() => setReaderOpen(null)}
          />
        )}
        {createOpen && (
          <CreateProjectModal
            title={createTitle}
            description={createDesc}
            error={createErr}
            loading={createLoading}
            onChangeTitle={setCreateTitle}
            onChangeDescription={setCreateDesc}
            onClose={() => !createLoading && setCreateOpen(false)}
            onSubmit={submitCreate}
          />
        )}
        {exportDialog && (
          <ExportDialog
            projectTitle={exportDialog.title}
            loading={exportLoading}
            onExport={performExport}
            onClose={() => !exportLoading && setExportDialog(null)}
          />
        )}
        {exportAllDialog && (
          <ExportAllDialog
            projectCount={projects.length}
            loading={exportAllLoading}
            onExport={performExportAll}
            onClose={() => !exportAllLoading && setExportAllDialog(false)}
          />
        )}
      </div>
    </div>
  );
}

function ExportDialog({ projectTitle, loading, onExport, onClose }: { projectTitle: string; loading: boolean; onExport: (format: 'json' | 'markdown' | 'text') => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="rounded-lg border border-border-default bg-bg-elevated p-6 shadow-lg max-w-sm w-full mx-4">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Export "{projectTitle}"</h2>
        <p className="text-sm text-text-secondary mb-6">Choose export format:</p>
        
        <div className="space-y-3 mb-6">
          <button
            onClick={() => onExport('markdown')}
            disabled={loading}
            className="w-full rounded-md border border-border-default bg-bg-primary px-4 py-3 text-sm text-text-primary hover:bg-bg-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left font-medium"
          >
            📝 Markdown (.md)
            <div className="text-xs text-text-tertiary mt-1">Formatted text with sections</div>
          </button>
          
          <button
            onClick={() => onExport('json')}
            disabled={loading}
            className="w-full rounded-md border border-border-default bg-bg-primary px-4 py-3 text-sm text-text-primary hover:bg-bg-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left font-medium"
          >
            {} JSON (.json)
            <div className="text-xs text-text-tertiary mt-1">Structured data format</div>
          </button>
          
          <button
            onClick={() => onExport('text')}
            disabled={loading}
            className="w-full rounded-md border border-border-default bg-bg-primary px-4 py-3 text-sm text-text-primary hover:bg-bg-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left font-medium"
          >
            📄 Plain Text (.txt)
            <div className="text-xs text-text-tertiary mt-1">Universal text format</div>
          </button>
        </div>
        
        <button
          onClick={onClose}
          disabled={loading}
          className="w-full rounded-md border border-border-default px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ExportAllDialog({ projectCount, loading, onExport, onClose }: { projectCount: number; loading: boolean; onExport: (format: 'json' | 'markdown' | 'text') => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="rounded-lg border border-border-default bg-bg-elevated p-6 shadow-lg max-w-sm w-full mx-4">
        <h2 className="text-lg font-semibold text-text-primary mb-2">Export All Projects</h2>
        <p className="text-sm text-text-tertiary mb-6">{projectCount} project{projectCount !== 1 ? 's' : ''} will be exported</p>
        <p className="text-sm text-text-secondary mb-6">Choose export format:</p>
        
        <div className="space-y-3 mb-6">
          <button
            onClick={() => onExport('markdown')}
            disabled={loading}
            className="w-full rounded-md border border-border-default bg-bg-primary px-4 py-3 text-sm text-text-primary hover:bg-bg-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left font-medium"
          >
            📝 Markdown (.md)
            <div className="text-xs text-text-tertiary mt-1">Single file with all projects</div>
          </button>
          
          <button
            onClick={() => onExport('json')}
            disabled={loading}
            className="w-full rounded-md border border-border-default bg-bg-primary px-4 py-3 text-sm text-text-primary hover:bg-bg-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left font-medium"
          >
            {} JSON (.json)
            <div className="text-xs text-text-tertiary mt-1">Structured data format</div>
          </button>
          
          <button
            onClick={() => onExport('text')}
            disabled={loading}
            className="w-full rounded-md border border-border-default bg-bg-primary px-4 py-3 text-sm text-text-primary hover:bg-bg-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left font-medium"
          >
            📄 Plain Text (.txt)
            <div className="text-xs text-text-tertiary mt-1">Universal text format</div>
          </button>
        </div>
        
        <button
          onClick={onClose}
          disabled={loading}
          className="w-full rounded-md border border-border-default px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function TopBar({ mode, onModeChange, userInitial, onSignOut, userStats }: { mode: Mode; onModeChange: (m: Mode) => void; userInitial: string; onSignOut: () => void; userStats?: any }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const level = userStats?.level || 1;
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  return (
    <div className="fixed top-0 inset-x-0 h-14 border-b border-border-default/80 backdrop-blur-soft bg-bg-primary/60 z-10">
      <div className="mx-auto max-w-7xl h-full flex items-center justify-between px-4">
        <div className="font-semibold tracking-wide">InkVerse</div>
        <div className="bg-bg-hover/60 rounded-full p-1 flex text-xs">
          <button
            className={`px-4 py-1.5 rounded-full transition-micro ${mode === "CREATE" ? "bg-accent text-black font-semibold" : "text-text-secondary hover:text-text-primary"}`}
            onClick={() => onModeChange("CREATE")}
          >CREATE</button>
          <button
            className={`px-4 py-1.5 rounded-full transition-micro ${mode === "READER" ? "bg-accent text-black font-semibold" : "text-text-secondary hover:text-text-primary"}`}
            onClick={() => onModeChange("READER")}
          >READER</button>
        </div>
        <div className="relative flex items-center gap-3" ref={menuRef}>
          <div className="text-xs text-text-tertiary">Level {level}</div>
          <button className="size-8 rounded-full bg-accent text-black grid place-items-center font-semibold hover:bg-accent-hover transition-micro" onClick={() => setOpen(v => !v)} aria-haspopup="menu" aria-expanded={open}>
            {userInitial}
          </button>
          {open && (
            <div role="menu" className="absolute right-0 top-10 w-40 rounded-md border border-border-default bg-bg-elevated shadow-elevation text-sm">
              <button className="w-full text-left px-3 py-2 hover:bg-bg-hover text-text-secondary transition-micro" onClick={() => { setOpen(false); /* placeholder */ }}>Profile</button>
              <button className="w-full text-left px-3 py-2 hover:bg-bg-hover text-text-secondary transition-micro" onClick={() => { setOpen(false); /* placeholder */ }}>Settings</button>
              <div className="border-t border-border-default" />
              <button className="w-full text-left px-3 py-2 hover:bg-bg-hover text-red-400 transition-micro" onClick={() => { setOpen(false); onSignOut(); }}>Sign out</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-14">
      <div className="mx-auto max-w-7xl flex flex-col md:flex-row gap-6 px-6 py-8">
        {children}
      </div>
    </div>
  );
}

function LeftStats({ projectsCount, stats }: { projectsCount: number; stats: any }) {
  const level = stats?.level || 1;
  const currentExp = stats?.currentLevelExp || 0;
  const nextExp = stats?.nextLevelExp || 100;
  const progressPercent = stats?.progressPercent || 0;
  const chaptersCount = stats?.chaptersCreated || 0;
  const wordsCount = stats?.totalWordsWritten || 0;

  return (
    <aside className="md:basis-1/5 bg-bg-elevated border border-border-default rounded-xl p-6 h-fit shadow-elevation">
      <div className="text-sm font-semibold mb-4 tracking-elegant">STATS</div>
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between"><span className="text-text-secondary">Level</span><span className="text-text-primary">{level}</span></div>
        <div className="flex items-center justify-between"><span className="text-text-secondary">EXP</span><span className="text-text-primary">{currentExp}/{nextExp}</span></div>
        <div className="mt-2">
          <div className="h-2.5 w-full bg-bg-hover rounded-full overflow-hidden relative">
            <div className="h-full bg-accent transition-all duration-300 relative overflow-hidden" style={{ width: `${progressPercent}%` }}>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between"><span className="text-text-secondary">Projects</span><span className="text-text-primary">{projectsCount}</span></div>
        <div className="flex items-center justify-between"><span className="text-text-secondary">Chapters</span><span className="text-text-primary">{chaptersCount}</span></div>
        <div className="flex items-center justify-between"><span className="text-text-secondary">Words</span><span className="text-text-primary">{wordsCount}</span></div>
      </div>
    </aside>
  );
}

function CenterProjects({ items, loading, error, onOpen, onBranch, onExport, onCreate, onDelete }: { items: ProjectItem[]; loading: boolean; error: string | null; onOpen: (id: string) => void; onBranch: (id: string) => void; onExport: (id: string) => void; onCreate: () => void; onDelete: (id: string) => void; }) {
  return (
    <section className="md:basis-3/5 flex-1 overflow-hidden">
      <div className="mb-3">
        <div className="text-sm font-semibold tracking-elegant">PROJECT FORGE</div>
      </div>
      <div className="h-[calc(100vh-14rem)] md:h-[calc(100vh-12rem)] overflow-y-auto pr-1 md:pr-2 space-y-4">
        {error && <div className="text-sm text-red-400 p-4 rounded-lg bg-red-950/20 border border-red-500/20">{error}</div>}
        {loading && !items.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 border-4 border-accent/30 border-t-accent rounded-full animate-spin mb-4" />
            <div className="text-sm text-text-secondary">Loading projects…</div>
          </div>
        ) : (
          items.map((p) => (
            <ProjectCard key={p.id} item={p} onOpen={onOpen} onBranch={onBranch} onExport={onExport} onDelete={onDelete} />
          ))
        )}
        {!loading && !items.length && !error && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mb-4">
              <Plus className="w-10 h-10 text-accent" />
            </div>
            <div className="text-base font-semibold text-text-primary mb-2">No Projects Yet</div>
            <div className="text-sm text-text-secondary max-w-xs">Begin your creative journey by awakening your first story below.</div>
          </div>
        )}
      </div>
      <button
        className="mt-4 w-full rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 text-accent hover:bg-accent/20 hover:scale-[1.02] transition-all duration-micro inline-flex items-center justify-center gap-2"
        onClick={onCreate}
        title="Awaken New Story"
      >
        <Plus className="w-4 h-4" aria-hidden="true" />
        <span>Awaken New Story</span>
      </button>
    </section>
  );
}

const ProjectCard = memo(function ProjectCard({ item, onOpen, onBranch, onExport, onDelete }: { item: ProjectItem; onOpen: (id: string) => void; onBranch: (id: string) => void; onExport: (id: string) => void; onDelete: (id: string) => void; }) {
  const rel = useMemo(() => relTime(item.createdAt), [item.createdAt]);
  const meta = `${labelMode(item.mode)} • ${"—"} Chapters • ${rel}`;
  return (
    <div className="rounded-xl border border-border-default bg-bg-elevated p-6 hover:shadow-elevation hover:scale-[1.01] transition-all duration-micro">
      <div className="text-base font-semibold text-text-primary mb-1">{item.title}</div>
      <div className="text-xs text-text-tertiary">{meta}</div>
      <div className="mt-6 grid grid-cols-[minmax(160px,200px)_1fr] gap-6 items-start">
        <div className="relative w-full pt-[133%] overflow-hidden rounded-lg border border-border-default bg-bg-primary group-hover:border-accent/30 transition-colors">
          {item.coverImage ? (
            <img src={item.coverImage} alt={item.title} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <BookOpen className="w-12 h-12 text-text-tertiary/30" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => onOpen(item.id)} className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-black hover:bg-accent-hover hover:scale-105 transition-all duration-micro inline-flex items-center gap-1" title="Open">
            <FolderOpen className="w-4 h-4" aria-hidden="true" />
            <span className="sr-only">Open</span>
          </button>
          <button onClick={() => onBranch(item.id)} className="rounded-md border border-border-default px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:scale-105 transition-all duration-micro inline-flex items-center gap-1" disabled title="Branch (coming soon)">
            <GitBranch className="w-4 h-4" aria-hidden="true" />
            <span className="sr-only">Branch</span>
          </button>
          <button onClick={() => onExport(item.id)} className="rounded-md border border-border-default px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:scale-105 transition-all duration-micro inline-flex items-center gap-1" title="Export as Markdown">
            <Download className="w-4 h-4" aria-hidden="true" />
            <span className="sr-only">Export</span>
          </button>
          <button onClick={() => onDelete(item.id)} className="rounded-md border border-red-500/40 text-red-400 hover:bg-red-950/30 hover:scale-105 transition-all duration-micro px-3 py-2 text-sm inline-flex items-center gap-1" title="Delete">
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            <span className="sr-only">Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
});

const RightActions = memo(function RightActions({ query, onQuery, onCreate, onExportAll, overlay, onToggleOverlay }: { query: string; onQuery: (v: string) => void; onCreate: () => void; onExportAll: () => void; overlay: boolean; onToggleOverlay: () => void; }) {
  const [local, setLocal] = useState(query);
  useEffect(() => { setLocal(query); }, [query]);
  useEffect(() => {
    const id = setTimeout(() => onQuery(local), 250);
    return () => clearTimeout(id);
  }, [local, onQuery]);
  return (
    <aside className="md:basis-1/5 bg-bg-elevated border border-border-default rounded-xl p-6 h-fit space-y-4 shadow-elevation">
      <div className="text-sm font-semibold tracking-elegant">QUICK ACTIONS</div>
      <button className="w-full rounded-md bg-accent px-3 py-2 text-sm font-semibold text-black hover:bg-accent-hover hover:scale-[1.02] transition-all duration-micro inline-flex items-center justify-center gap-2" onClick={onCreate} title="New">
        <Plus className="w-4 h-4" aria-hidden="true" />
        <span>New</span>
      </button>
      <input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder="Search"
        className="w-full rounded-md bg-bg-primary border border-border-default px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent transition-colors duration-micro"
      />
      <button className="w-full rounded-md border border-border-default px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:scale-[1.02] transition-all duration-micro inline-flex items-center justify-center gap-2" onClick={onExportAll} title="Export all projects">
        <Download className="w-4 h-4" aria-hidden="true" />
        <span>Export All</span>
      </button>
      <label className="flex items-center gap-2 text-xs text-text-secondary pt-1">
        <input type="checkbox" checked={overlay} onChange={onToggleOverlay} className="accent-accent" />
        Cyan grid overlay
      </label>
    </aside>
  );
});


function LeftLibrary({ modeFilter, onModeFilter, rankFilter, onRankFilter, timeFilter, onTimeFilter, genreFilters, onGenreFiltersChange, projects }: {
  modeFilter: 'all' | 'novel' | 'manhwa';
  onModeFilter: (m: 'all' | 'novel' | 'manhwa') => void;
  rankFilter: 'all' | 'S' | 'A' | 'B' | 'C';
  onRankFilter: (r: 'all' | 'S' | 'A' | 'B' | 'C') => void;
  timeFilter: 'all' | '7d' | '30d';
  onTimeFilter: (t: 'all' | '7d' | '30d') => void;
  genreFilters: Set<string>;
  onGenreFiltersChange: (filters: Set<string>) => void;
  projects: ProjectItem[];
}) {
  const [genreExpanded, setGenreExpanded] = useState(false);

  // Extract all unique genres from all projects
  const allAvailableGenres = useMemo(() => {
    const genreSet = new Set<string>();
    projects.forEach(p => {
      const projectGenres = (p.genres || []) as string[];
      projectGenres.forEach(g => {
        // Add the genre as-is (already individual from backend)
        genreSet.add(g);
      });
    });
    return Array.from(genreSet).sort();
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
    <aside className="md:basis-1/5 bg-bg-elevated border border-border-default rounded-xl p-6 h-fit space-y-4 shadow-elevation max-h-[calc(100vh-6rem)] overflow-y-auto">
      <div className="text-sm font-semibold tracking-elegant">FILTERS</div>
      
      <div className="text-xs text-text-tertiary">Mode</div>
      <select value={modeFilter} onChange={(e) => onModeFilter(e.target.value as any)} className="w-full rounded-md bg-bg-primary border border-border-default px-3 py-2 text-sm text-text-primary focus:border-accent transition-colors duration-micro">
        <option value="all">All Modes</option>
        <option value="novel">Novel</option>
        <option value="manhwa">Manhwa</option>
      </select>
      
      <div className="text-xs text-text-tertiary">Rank</div>
      <select value={rankFilter} onChange={(e) => onRankFilter(e.target.value as any)} className="w-full rounded-md bg-bg-primary border border-border-default px-3 py-2 text-sm text-text-primary focus:border-accent transition-colors duration-micro">
        <option value="all">All Ranks</option>
        <option value="S">S</option>
        <option value="A">A</option>
        <option value="B">B</option>
        <option value="C">C</option>
      </select>
      
      <div className="text-xs text-text-tertiary">Time</div>
      <select value={timeFilter} onChange={(e) => onTimeFilter(e.target.value as any)} className="w-full rounded-md bg-bg-primary border border-border-default px-3 py-2 text-sm text-text-primary focus:border-accent transition-colors duration-micro">
        <option value="all">All Time</option>
        <option value="7d">Last 7 days</option>
        <option value="30d">Last 30 days</option>
      </select>

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
                      className="accent-accent rounded"
                    />
                    <span className="text-text-secondary">{genre}</span>
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

function ReaderCenterVault({ items, sort, view, onRead, shareLoadingId, onSetVisibility }: { items: ProjectItem[]; sort: "recent" | "rank"; view: "list" | "gallery"; onRead: (id: string, mode?: ProjectItem["mode"]) => void; shareLoadingId: string | null; onSetVisibility: (id: string, vis: 'private'|'public') => void; }) {
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

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      setVisible((v: number) => Math.min(v + 10, sorted.length));
    }
  };

  return (
    <section className="md:basis-3/5 flex-1 overflow-hidden">
      <div className="mb-3">
        <div className="text-sm font-semibold tracking-elegant">STORY VAULT</div>
      </div>
      <div onScroll={onScroll} className="h-[calc(100vh-14rem)] md:h-[calc(100vh-12rem)] overflow-y-auto pr-1 md:pr-2">
        <div className={view === 'gallery' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}>
          {sorted.slice(0, visible).map((p) => (
            <ReaderCard
              key={p.id}
              item={p}
              onRead={onRead}
              view={view}
              shareLoading={shareLoadingId === p.id}
              onSetVisibility={onSetVisibility}
            />
          ))}
        </div>
        {visible < sorted.length && (
          <div className="py-4 text-center text-sm text-text-secondary">Loading more…</div>
        )}
        {!sorted.length && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mb-4">
              <BookOpen className="w-10 h-10 text-accent" />
            </div>
            <div className="text-base font-semibold text-text-primary mb-2">Library Empty</div>
            <div className="text-sm text-text-secondary max-w-xs">Your story vault awaits. Switch to CREATE mode to begin writing.</div>
          </div>
        )}
      </div>
    </section>
  );
}

const ReaderCard = memo(function ReaderCard({ item, onRead, view, shareLoading, onSetVisibility }: { item: ProjectItem; onRead: (id: string, mode?: ProjectItem["mode"]) => void; view: "list" | "gallery"; shareLoading: boolean; onSetVisibility: (id: string, vis: 'private'|'public') => void; }) {
  const supabase = useSupabase();
  const api = useMemo(() => createApi(supabase), [supabase]);
  const [chaptersCount, setChaptersCount] = useState<number | null>(null);
  const [snippet, setSnippet] = useState<string>("");
  const [visible, setVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        setVisible(true);
        io.disconnect();
      }
    }, { root: null, rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!visible) return;
        const sum = await api.getChapterSummary(item.id);
        if (!mounted) return;
        setChaptersCount(typeof sum?.count === 'number' ? sum.count : null);
        const snap = (sum?.snippet || "").trim();
        setSnippet(snap ? clipWords(snap, 100) : "");
      } catch {}
    })();
    return () => { mounted = false; };
  }, [api, item.id, visible]);

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
            <span className={`px-2 py-0.5 rounded text-xs font-bold flex-shrink-0 ${rankColors[rank]}`}>{rank}</span>
          </div>
          <div className="text-xs text-text-secondary">{chaptersCount !== null ? `${chaptersCount} Chapters` : "—"}</div>
          <button onClick={() => onRead(item.id, item.mode)} className="w-full rounded-md bg-accent px-3 py-2 text-xs font-semibold text-black hover:bg-accent-hover transition-all duration-micro inline-flex items-center justify-center gap-1 mt-auto">
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
      <div className="text-xs text-text-tertiary">{labelMode(item.mode)} • {chaptersCount !== null ? `${chaptersCount} Chapters` : "Chapters —"}</div>
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
          <div className="text-sm text-text-secondary leading-relaxed">{snippet || "No preview available."}</div>
          <div className="flex items-center gap-3 relative">
            <button onClick={() => onRead(item.id, item.mode)} className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-black hover:bg-accent-hover hover:scale-105 transition-all duration-micro inline-flex items-center gap-1" title="Read Full">
              <BookOpen className="w-4 h-4" aria-hidden="true" />
              <span className="sr-only">Read Full</span>
            </button>
            <ShareMenu
              visibility={item.visibility === 'public' ? 'public' : 'private'}
              busy={shareLoading}
              onSelect={(vis) => onSetVisibility(item.id, vis)}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

function ShareMenu({ visibility, busy, onSelect }: { visibility: 'private'|'public'; busy: boolean; onSelect: (v: 'private'|'public') => void; }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)} disabled={busy} className="rounded-md border border-border-default px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:scale-105 transition-all duration-micro inline-flex items-center gap-2" title="Share & Visibility">
        {busy ? (
          <span className="inline-block w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" aria-hidden="true" />
        ) : (
          <Share2 className="w-4 h-4" aria-hidden="true" />
        )}
        <span className="text-xs uppercase">{visibility}</span>
      </button>
      {open && (
        <div className="absolute z-10 mt-2 w-44 rounded-md border border-border-default bg-bg-elevated shadow-elevation text-sm">
          <div className="px-3 py-2 text-text-tertiary">Visibility: {visibility}</div>
          <button className="w-full text-left px-3 py-2 hover:bg-bg-hover text-text-secondary transition-micro" disabled={busy} onClick={() => { setOpen(false); onSelect('public'); }}>Public</button>
          <button className="w-full text-left px-3 py-2 hover:bg-bg-hover text-text-secondary transition-micro" disabled={busy} onClick={() => { setOpen(false); onSelect('private'); }}>Private</button>
        </div>
      )}
    </div>
  );
}

function RightControls({ sort, onSort, view, onView }: { sort: "recent" | "rank"; onSort: (s: "recent" | "rank") => void; view: "list" | "gallery"; onView: (v: "list" | "gallery") => void; }) {
  return (
    <aside className="md:basis-1/5 bg-bg-elevated border border-border-default rounded-xl p-6 h-fit space-y-4 shadow-elevation">
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
      {/* Dark mode toggle removed */}
    </aside>
  );
}

function ReaderCanvasOverlay({ projectId, initialMode, onClose }: { projectId: string; initialMode: "novel" | "manhwa"; onClose: () => void; }) {
  const supabase = useSupabase();
  const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
  const [mode, setMode] = useState<"novel" | "manhwa">(initialMode);
  const [chapters, setChapters] = useState<Array<{ id: string; title: string }>>([]);
  const [activeCh, setActiveCh] = useState<string | null>(null);
  const [targetCh, setTargetCh] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [fs, setFs] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [panelIdx, setPanelIdx] = useState(0);
  const [panelTotal, setPanelTotal] = useState(0);
  const [chapterIdx, setChapterIdx] = useState(0);
  const [targetPanelIdx, setTargetPanelIdx] = useState<number | null>(null);
  const [bookmarks, setBookmarks] = useState<Array<{ id: string; name: string; description?: string; progress: number; updatedAt: string }>>([]);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [editingBookmarkId, setEditingBookmarkId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingBookmarkId, setSavingBookmarkId] = useState<string | null>(null);
  const [deletingBookmarkId, setDeletingBookmarkId] = useState<string | null>(null);
  const [targetScrollPct, setTargetScrollPct] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Load full chapter list in ascending order
        const api = createApi(supabase);
        const first = await api.listChaptersPaginated(projectId, 0, 100);
        if (!mounted) return;
        let all = first.items as Array<{ id: string; title: string }>;
        const total = typeof first.total === 'number' ? first.total : all.length;
        let page = 1;
        while (all.length < total) {
          const next = await api.listChaptersPaginated(projectId, page, 100);
          all = all.concat(next.items as Array<{ id: string; title: string }>);
          page += 1;
          if (!mounted) return;
        }
        setChapters(all.map((c: any) => ({ id: c.id, title: c.title })));
        setActiveCh(all[0]?.id || null);
        // Load bookmarks
        try {
          const bms = await api.listBookmarks(projectId);
          if (mounted) setBookmarks(bms);
        } catch {}
      } catch {}
    })();
    return () => { mounted = false; };
  }, [projectId, supabase]);

  const toggleFs = async () => {
    try {
      if (!document.fullscreenElement) {
        await wrapRef.current?.requestFullscreen?.();
        setFs(true);
      } else {
        await document.exitFullscreen();
        setFs(false);
      }
    } catch {}
  };

  return (
    <div ref={wrapRef} className="fixed inset-0 z-30 bg-bg-primary/95 backdrop-blur-soft">
      <div className="h-12 border-b border-border-default px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-sm text-text-primary">Mode</div>
          <div className="bg-bg-hover/60 rounded-full p-1 flex text-xs">
            <button className={`px-3 py-1 rounded-full transition-micro ${mode === 'novel' ? 'bg-accent text-black font-semibold' : 'text-text-secondary hover:text-text-primary'}`} onClick={() => setMode('novel')}>Novel</button>
            <button className={`px-3 py-1 rounded-full transition-micro ${mode === 'manhwa' ? 'bg-accent text-black font-semibold' : 'text-text-secondary hover:text-text-primary'}`} onClick={() => setMode('manhwa')}>Manhwa</button>
          </div>
          <div className="ml-2 flex items-center gap-2 text-xs">
            <button onClick={() => setLeftCollapsed(v => !v)} className="rounded-md border border-border-default px-2 py-1 text-text-secondary hover:bg-bg-hover transition-micro">{leftCollapsed ? 'Show Left' : 'Hide Left'}</button>
            <button onClick={() => setRightCollapsed(v => !v)} className="rounded-md border border-border-default px-2 py-1 text-text-secondary hover:bg-bg-hover transition-micro">{rightCollapsed ? 'Show Right' : 'Hide Right'}</button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleFs} className="rounded-md border border-border-default px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover transition-micro">{fs ? 'Exit Full' : 'Full-Screen'}</button>
          <button className="rounded-md border border-border-default px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover transition-micro" disabled>Settings</button>
          <button onClick={onClose} className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-black hover:bg-accent-hover transition-micro">Exit Reader</button>
        </div>
      </div>
      <div className="grid grid-rows-[1fr_auto] h-[calc(100%-3rem)] min-h-0">
        <div
          className={
            `grid h-full min-h-0 ` +
            (
              leftCollapsed && rightCollapsed ? 'md:grid-cols-[1fr]' :
              leftCollapsed && !rightCollapsed ? 'md:grid-cols-[1fr_260px]' :
              !leftCollapsed && rightCollapsed ? 'md:grid-cols-[260px_1fr]' :
              'md:grid-cols-[260px_1fr_260px]'
            )
          }
        >
          {!leftCollapsed && (
          <aside className="border-r border-border-default overflow-y-auto p-3 hidden md:block bg-bg-elevated">
            <div className="text-xs text-text-tertiary mb-2">Chapter List</div>
            <div className="flex flex-col gap-1">
              {chapters.map((c) => (
                <button key={c.id} onClick={() => { setActiveCh(c.id); setTargetCh(c.id); }} className={`text-left px-2 py-1 rounded transition-micro ${activeCh === c.id ? 'bg-bg-hover text-text-primary' : 'text-text-secondary hover:bg-bg-hover/50'}`}>{c.title}</button>
              ))}
            </div>
          </aside>
          )}
          <main className="overflow-hidden min-h-0">
            <div className="h-full">
              <ReaderView
                projectId={projectId}
                mode={mode}
                targetChapterId={targetCh}
                onChapterInView={(id) => setActiveCh(id)}
                targetPanelIndex={targetPanelIdx}
                targetScrollPercent={targetScrollPct}
                onProgress={(pct, meta) => {
                  setProgress(Math.max(0, Math.min(100, pct || 0)));
                  if (mode === 'manhwa') {
                    setPanelIdx(meta?.index ?? 0);
                    setPanelTotal(meta?.total ?? 0);
                  } else {
                    setChapterIdx(meta?.index ?? (activeCh ? chapters.findIndex(c => c.id === activeCh) : 0));
                  }
                }}
              />
            </div>
          </main>
          {!rightCollapsed && (
          <aside className="border-l border-border-default overflow-hidden hidden md:flex flex-col bg-bg-elevated">
            <div className="flex-1 overflow-y-auto">
              {editingBookmarkId ? (
                <div className="p-4 space-y-3 border-b border-border-default">
                  <h3 className="text-sm font-semibold text-text-primary">Edit Bookmark</h3>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Bookmark name"
                    className="w-full px-2 py-1.5 text-xs bg-bg-primary border border-border-default rounded text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent"
                  />
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Description (optional)"
                    className="w-full px-2 py-1.5 text-xs bg-bg-primary border border-border-default rounded text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent resize-none h-20"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        setSavingBookmarkId(editingBookmarkId);
                        try {
                          const api = createApi(supabase);
                          const result = await api.updateBookmark(projectId, editingBookmarkId, editName, editDescription);
                          const updated = bookmarks.map((b) =>
                            b.id === editingBookmarkId ? { ...b, name: editName, description: editDescription, ...result } : b
                          );
                          setBookmarks(updated);
                          setEditingBookmarkId(null);
                        } catch (e) {
                          console.error('Update error:', e);
                        } finally {
                          setSavingBookmarkId(null);
                        }
                      }}
                      disabled={savingBookmarkId === editingBookmarkId}
                      className="flex-1 px-2 py-1 text-xs bg-accent text-white rounded hover:bg-accent/90 transition-micro disabled:opacity-70 flex items-center justify-center gap-1"
                    >
                      {savingBookmarkId === editingBookmarkId ? (
                        <>
                          <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
                            <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Saving…
                        </>
                      ) : (
                        'Save'
                      )}
                    </button>
                    <button
                      onClick={() => setEditingBookmarkId(null)}
                      className="flex-1 px-2 py-1 text-xs bg-bg-hover text-text-secondary rounded hover:bg-border-default transition-micro"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {bookmarks.length === 0 ? (
                    <div className="text-xs text-text-tertiary p-3 text-center">No bookmarks yet</div>
                  ) : (
                    bookmarks.map((bm) => (
                      <div key={bm.id} className="flex items-center gap-2 p-2 rounded hover:bg-bg-hover group transition-micro cursor-pointer" onClick={() => {
                        // Update UI bar immediately
                        setProgress(bm.progress);
                        // Ask ReaderView to programmatically scroll to this percent
                        setTargetScrollPct((prev) => (prev === bm.progress ? bm.progress + 0.0001 : bm.progress));
                      }}>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-text-primary truncate">{bm.name}</div>
                          <div className="text-xs text-text-tertiary">{bm.progress}% progress</div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingBookmarkId(bm.id);
                            setEditName(bm.name);
                            setEditDescription(bm.description || '');
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-text-secondary hover:text-accent transition-micro"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            setDeletingBookmarkId(bm.id);
                            try {
                              const api = createApi(supabase);
                              await api.deleteBookmark(projectId, bm.id);
                              setBookmarks(bookmarks.filter((b) => b.id !== bm.id));
                            } catch (e) {
                              console.error('Delete error:', e);
                            } finally {
                              setDeletingBookmarkId(null);
                            }
                          }}
                          disabled={deletingBookmarkId === bm.id}
                          className="opacity-0 group-hover:opacity-100 p-1 text-text-secondary hover:text-red-500 transition-micro disabled:opacity-50"
                          title="Delete"
                        >
                          {deletingBookmarkId === bm.id ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
                              <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </aside>
          )}
        </div>
        <div className="h-14 border-t border-border-default px-4 flex items-center gap-3 bg-bg-elevated">
          <div className="text-xs text-text-tertiary">Progress</div>
          <div className="flex-1 h-2 bg-bg-hover rounded-full overflow-hidden">
            <div className="h-full bg-accent transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <div className="text-xs text-text-secondary w-12 text-right">{progress}%</div>
          <button
            className="rounded-md border border-border-default px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover transition-micro disabled:opacity-50"
            onClick={() => {
              if (mode === 'manhwa') {
                if (panelIdx > 0) setTargetPanelIdx(panelIdx - 1);
              } else {
                if (!activeCh) return;
                const idx = chapters.findIndex(c => c.id === activeCh);
                if (idx > 0) { const prevId = chapters[idx - 1].id; setTargetCh(prevId); setActiveCh(prevId); }
              }
            }}
            disabled={mode === 'manhwa' ? panelIdx <= 0 : (chapters.length === 0 || chapters.findIndex(c => c.id === activeCh) <= 0)}
          >Prev</button>
          <button
            className="rounded-md border border-border-default px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover transition-micro disabled:opacity-50"
            onClick={() => {
              if (mode === 'manhwa') {
                if (panelIdx < Math.max(0, panelTotal - 1)) setTargetPanelIdx(panelIdx + 1);
              } else {
                if (!activeCh) return;
                const idx = chapters.findIndex(c => c.id === activeCh);
                if (idx >= 0 && idx < chapters.length - 1) { const nextId = chapters[idx + 1].id; setTargetCh(nextId); setActiveCh(nextId); }
              }
            }}
            disabled={mode === 'manhwa' ? (panelTotal <= 0 || panelIdx >= panelTotal - 1) : (chapters.length === 0 || chapters.findIndex(c => c.id === activeCh) >= chapters.length - 1)}
          >Next</button>
          <button
            className="rounded-md border border-accent bg-accent/20 px-3 py-1.5 text-xs text-accent hover:bg-accent/30 transition-micro disabled:opacity-50"
            onClick={async () => {
              setBookmarkLoading(true);
              try {
                const api = createApi(supabase);
                const bm = await api.createBookmark(projectId, progress);
                setBookmarks([bm, ...bookmarks]);
              } catch (e) {
                console.error('Bookmark error:', e);
              } finally {
                setBookmarkLoading(false);
              }
            }}
            disabled={bookmarkLoading}
          >
            {bookmarkLoading ? 'Creating…' : '+ Bookmark'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateProjectModal({ title, description, error, loading, onChangeTitle, onChangeDescription, onClose, onSubmit }: {
  title: string;
  description: string;
  error: string | null;
  loading: boolean;
  onChangeTitle: (v: string) => void;
  onChangeDescription: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center backdrop-blur-sm">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border-default bg-bg-elevated p-5 shadow-elevation">
        <div className="text-sm font-semibold mb-3 tracking-elegant text-text-primary">Awaken New Story</div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-text-tertiary mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => onChangeTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }}
              placeholder="Shadow Empress"
              className="w-full rounded-md bg-bg-primary border border-border-default px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent transition-colors duration-micro"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-text-tertiary mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => onChangeDescription(e.target.value)}
              placeholder="A dark fantasy about..."
              className="w-full min-h-[96px] rounded-md bg-bg-primary border border-border-default px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent transition-colors duration-micro"
            />
          </div>
          {error && <div className="text-xs text-red-400">{error}</div>}
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button className="rounded-md border border-border-default px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover transition-micro" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-black hover:bg-accent-hover hover:scale-105 transition-all duration-micro disabled:opacity-50" onClick={onSubmit} disabled={loading}>{loading ? 'Creating…' : 'Create'}</button>
        </div>
      </div>
    </div>
  );
}

function rankForProject(id: string) {
  let x = 0;
  for (let i = 0; i < id.length; i++) x = (x * 31 + id.charCodeAt(i)) >>> 0;
  const r = ["S", "A", "B", "C"][x % 4];
  return r;
}

function clipWords(text: string, maxWords: number) {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ") + "…";
}

function labelMode(mode?: ProjectItem["mode"]) {
  if (mode === "manhwa") return "Manhwa";
  if (mode === "novel") return "Novel";
  return "Story";
}

function relTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 0) return `${day}d ago`;
  if (hr > 0) return `${hr}h ago`;
  if (min > 0) return `${min}m ago`;
  return `just now`;
}
