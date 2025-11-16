"use client";

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
  const [themeDark, setThemeDark] = useState(true);
  const [readerOpen, setReaderOpen] = useState<{ projectId: string; mode: "novel" | "manhwa" } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

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
        const list = await api.listProjects();
        if (!mounted) return;
        setProjects(list as ProjectItem[]);
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
    void id; /* placeholder */
  }, []);

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
        <TopBar mode={mode} onModeChange={setMode} userInitial={userInitial} onSignOut={onSignOut} />
        {mode === "CREATE" ? (
          <MainLayout>
            <LeftStats projectsCount={projects.length} />
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
              onExportAll={() => {}}
              overlay={overlay}
              onToggleOverlay={() => setOverlay(v => !v)}
            />
          </MainLayout>
        ) : (
          <MainLayout>
            <LeftLibrary
              sort={readerSort}
              onSort={setReaderSort}
            />
            <ReaderCenterVault
              items={filtered}
              sort={readerSort}
              onRead={handleRead}
            />
            <RightControls
              sort={readerSort}
              onSort={setReaderSort}
              view={readerView}
              onView={setReaderView}
              dark={themeDark}
              onDark={setThemeDark}
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
      </div>
    </div>
  );
}

function TopBar({ mode, onModeChange, userInitial, onSignOut }: { mode: Mode; onModeChange: (m: Mode) => void; userInitial: string; onSignOut: () => void; }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
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
          <div className="text-xs text-text-tertiary">Level 7</div>
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

function LeftStats({ projectsCount }: { projectsCount: number }) {
  return (
    <aside className="md:basis-1/5 bg-bg-elevated border border-border-default rounded-xl p-6 h-fit shadow-elevation">
      <div className="text-sm font-semibold mb-4 tracking-elegant">STATS</div>
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between"><span className="text-text-secondary">Level</span><span className="text-text-primary">7</span></div>
        <div className="flex items-center justify-between"><span className="text-text-secondary">EXP</span><span className="text-text-primary">420/1k</span></div>
        <div className="mt-2">
          <div className="h-2.5 w-full bg-bg-hover rounded-full overflow-hidden relative">
            <div className="h-full bg-accent transition-all duration-300 relative overflow-hidden" style={{ width: "42%" }}>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between"><span className="text-text-secondary">Projects</span><span className="text-text-primary">{projectsCount}</span></div>
        <div className="flex items-center justify-between"><span className="text-text-secondary">Chapters</span><span className="text-text-primary">—</span></div>
        <div className="flex items-center justify-between"><span className="text-text-secondary">Words</span><span className="text-text-primary">—</span></div>
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
          <div className="absolute inset-0 flex items-center justify-center">
            <BookOpen className="w-12 h-12 text-text-tertiary/30" />
          </div>
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
          <button onClick={() => onExport(item.id)} className="rounded-md border border-border-default px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:scale-105 transition-all duration-micro inline-flex items-center gap-1" disabled title="Export (coming soon)">
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
      <button className="w-full rounded-md border border-border-default px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:scale-[1.02] transition-all duration-micro inline-flex items-center justify-center gap-2" onClick={onExportAll} disabled title="Export All (coming soon)">
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

function LeftLibrary({ sort, onSort }: { sort: "recent" | "rank"; onSort: (s: "recent" | "rank") => void; }) {
  return (
    <aside className="md:basis-1/5 bg-bg-elevated border border-border-default rounded-xl p-6 h-fit space-y-4 shadow-elevation">
      <div className="text-sm font-semibold tracking-elegant">LIBRARY</div>
      <div className="text-xs text-text-tertiary">Filter</div>
      <select className="w-full rounded-md bg-bg-primary border border-border-default px-3 py-2 text-sm text-text-primary focus:border-accent transition-colors duration-micro">
        <option>All</option>
      </select>
      <div className="text-xs text-text-tertiary">Sort</div>
      <select value={sort} onChange={(e) => onSort(e.target.value as any)} className="w-full rounded-md bg-bg-primary border border-border-default px-3 py-2 text-sm text-text-primary focus:border-accent transition-colors duration-micro">
        <option value="recent">Recent</option>
        <option value="rank">Rank</option>
      </select>
    </aside>
  );
}

function ReaderCenterVault({ items, sort, onRead }: { items: ProjectItem[]; sort: "recent" | "rank"; onRead: (id: string, mode?: ProjectItem["mode"]) => void; }) {
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
      <div onScroll={onScroll} className="h-[calc(100vh-14rem)] md:h-[calc(100vh-12rem)] overflow-y-auto pr-1 md:pr-2 space-y-4">
        {sorted.slice(0, visible).map((p) => (
          <ReaderCard key={p.id} item={p} onRead={onRead} />
        ))}
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

const ReaderCard = memo(function ReaderCard({ item, onRead }: { item: ProjectItem; onRead: (id: string, mode?: ProjectItem["mode"]) => void; }) {
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
  return (
    <div ref={cardRef} className="rounded-xl border border-border-default bg-bg-elevated p-6 hover:shadow-elevation hover:scale-[1.01] transition-all duration-micro">
      <div className="flex items-center gap-2 mb-1">
        <div className="text-base font-semibold text-text-primary">{item.title}</div>
        <span className={`px-2 py-0.5 rounded text-xs font-bold ${rankColors[rank]}`}>{rank}</span>
      </div>
      <div className="text-xs text-text-tertiary">{labelMode(item.mode)} • {chaptersCount !== null ? `${chaptersCount} Chapters` : "Chapters —"}</div>
      <div className="mt-6 grid grid-cols-[minmax(160px,200px)_1fr] gap-6 items-start">
        <div className="relative w-full pt-[133%] overflow-hidden rounded-lg border border-border-default bg-bg-primary">
          <div className="absolute inset-0 flex items-center justify-center">
            <BookOpen className="w-12 h-12 text-text-tertiary/30" />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="text-sm text-text-secondary leading-relaxed">{snippet || "No preview available."}</div>
          <div className="flex items-center gap-3">
            <button onClick={() => onRead(item.id, item.mode)} className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-black hover:bg-accent-hover hover:scale-105 transition-all duration-micro inline-flex items-center gap-1" title="Read Full">
              <BookOpen className="w-4 h-4" aria-hidden="true" />
              <span className="sr-only">Read Full</span>
            </button>
            <button className="rounded-md border border-border-default px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:scale-105 transition-all duration-micro inline-flex items-center gap-1" disabled title="Share (coming soon)">
              <Share2 className="w-4 h-4" aria-hidden="true" />
              <span className="sr-only">Share</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

function RightControls({ sort, onSort, view, onView, dark, onDark }: { sort: "recent" | "rank"; onSort: (s: "recent" | "rank") => void; view: "list" | "gallery"; onView: (v: "list" | "gallery") => void; dark: boolean; onDark: (v: boolean) => void; }) {
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
      <label className="flex items-center gap-2 text-xs text-text-secondary pt-1">
        <input type="checkbox" checked={dark} onChange={(e) => onDark(e.target.checked)} className="accent-accent" />
        Dark Mode
      </label>
    </aside>
  );
}

function ReaderCanvasOverlay({ projectId, initialMode, onClose }: { projectId: string; initialMode: "novel" | "manhwa"; onClose: () => void; }) {
  const supabase = useSupabase();
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const [mode, setMode] = useState<"novel" | "manhwa">(initialMode);
  const [chapters, setChapters] = useState<Array<{ id: string; title: string }>>([]);
  const [activeCh, setActiveCh] = useState<string | null>(null);
  const [progress, setProgress] = useState(45);
  const [fs, setFs] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch(`${apiBase}/api/project/${projectId}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
        if (!res.ok) return;
        const data = await res.json();
        const ch = Array.isArray(data?.chapters) ? data.chapters : [];
        if (!mounted) return;
        setChapters(ch.map((c: any) => ({ id: c.id, title: c.title })));
        setActiveCh(ch[0]?.id || null);
      } catch {}
    })();
    return () => { mounted = false; };
  }, [apiBase, projectId, supabase]);

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
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleFs} className="rounded-md border border-border-default px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover transition-micro">{fs ? 'Exit Full' : 'Full-Screen'}</button>
          <button className="rounded-md border border-border-default px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover transition-micro" disabled>Settings</button>
          <button onClick={onClose} className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-black hover:bg-accent-hover transition-micro">Exit Reader</button>
        </div>
      </div>
      <div className="grid grid-rows-[1fr_auto] h-[calc(100%-3rem)] min-h-0">
        <div className="grid md:grid-cols-[260px_1fr_260px] h-full min-h-0">
          <aside className="border-r border-border-default overflow-y-auto p-3 hidden md:block bg-bg-elevated">
            <div className="text-xs text-text-tertiary mb-2">Chapter List</div>
            <div className="flex flex-col gap-1">
              {chapters.map((c) => (
                <button key={c.id} onClick={() => setActiveCh(c.id)} className={`text-left px-2 py-1 rounded transition-micro ${activeCh === c.id ? 'bg-bg-hover text-text-primary' : 'text-text-secondary hover:bg-bg-hover/50'}`}>{c.title}</button>
              ))}
            </div>
          </aside>
          <main className="overflow-hidden min-h-0">
            <div className="h-full">
              <ReaderView projectId={projectId} mode={mode} />
            </div>
          </main>
          <aside className="border-l border-border-default overflow-y-auto p-3 hidden md:block bg-bg-elevated">
            <div className="text-xs text-text-tertiary mb-2">Sidebar</div>
            <div className="space-y-2 text-sm text-text-secondary">
              <div>- TOC</div>
              <div>- Notes</div>
              <div>- Share</div>
            </div>
          </aside>
        </div>
        <div className="h-14 border-t border-border-default px-4 flex items-center gap-3 bg-bg-elevated">
          <div className="text-xs text-text-tertiary">Progress</div>
          <div className="flex-1 h-2 bg-bg-hover rounded-full overflow-hidden">
            <div className="h-full bg-accent transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <div className="text-xs text-text-secondary w-12 text-right">{progress}%</div>
          <button className="rounded-md border border-border-default px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover transition-micro" disabled>Prev</button>
          <button className="rounded-md border border-border-default px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover transition-micro" disabled>Next</button>
          <button className="rounded-md border border-border-default px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover transition-micro" disabled>Bookmark</button>
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
