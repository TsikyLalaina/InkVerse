"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { createApi } from "@/lib/api";
import { Chat } from "@/components/chat/Chat";
import { CharacterManager } from "@/components/workspace/CharacterManager";
import { WorldSettingsManager } from "@/components/workspace/WorldSettingsManager";
import { Settings as IconSettings, ChevronLeft, ChevronRight, Plus, Trash2, Loader2, ChevronDown, Lock, LockOpen } from "lucide-react";

type ChapterItem = {
  id: string;
  title: string;
  content?: string | null;
  panelScript?: any | null;
  price?: number;
  createdAt?: string;
};

export function Workspace({ projectId }: { projectId: string }) {
  const supabase = useSupabase();
  const api = useMemo(() => createApi(supabase), [supabase]);

  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [loadingCh, setLoadingCh] = useState(true);
  const [errorCh, setErrorCh] = useState<string | null>(null);

  const [tabs, setTabs] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<string>("");

  const placeCaretAtEnd = (el: HTMLElement) => {
    try {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      if (!sel) return;
      sel.removeAllRanges();
      sel.addRange(range);
    } catch {}
  };
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [aiMuseOpen, setAiMuseOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creatingChapter, setCreatingChapter] = useState(false);
  const [projectTitle, setProjectTitle] = useState<string>("");
  const [projectDescription, setProjectDescription] = useState<string>("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState("");
  const [renameDesc, setRenameDesc] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [projMode, setProjMode] = useState<'novel' | 'manhwa' | ''>('');
  const [projGenres, setProjGenres] = useState<string[]>([]);
  // Removed worldName field from Project
  const [projCoreConflict, setProjCoreConflict] = useState<string>("");
  const [projSettingsJson, setProjSettingsJson] = useState<string>("");
  const [projCoverImage, setProjCoverImage] = useState<string>("");
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadStatusCover, setUploadStatusCover] = useState<'idle'|'uploading'|'uploaded'|'error'>('idle');
  const [toastMsg, setToastMsg] = useState<string>("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coverDropRef = useRef<HTMLDivElement | null>(null);

  const SETTINGS_TAB_ID = '__settings__';
  const CHARACTERS_TAB_ID = '__characters__';
  const WORLD_TAB_ID = '__world__';

  // Chats sidebar (right)
  const [rightOpen, setRightOpen] = useState(true);
  const chatsCacheKey = useMemo(() => `inkverse_project_${projectId}_chats`, [projectId]);
  const chatsActiveKey = useMemo(() => `inkverse_project_${projectId}_active_chat`, [projectId]);
  const chaptersCacheKey = useMemo(() => `inkverse_project_${projectId}_chapters`, [projectId]);
  const tabsCacheKey = useMemo(() => `inkverse_project_${projectId}_open_tabs`, [projectId]);
  const activeTabKey = useMemo(() => `inkverse_project_${projectId}_active_tab`, [projectId]);
  const leftCollapsedKey = useMemo(() => `inkverse_project_${projectId}_left_collapsed`, [projectId]);
  const rightOpenKey = useMemo(() => `inkverse_project_${projectId}_right_open`, [projectId]);
  const leftWidthKey = useMemo(() => `inkverse_project_${projectId}_left_width`, [projectId]);
  const rightWidthKey = useMemo(() => `inkverse_project_${projectId}_right_width`, [projectId]);
  const [chats, setChats] = useState<Array<{ id: string; type: 'plot'|'character'|'world'; title: string }>>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [hasChatsCache, setHasChatsCache] = useState<boolean>(false);
  const chatsRef = useRef(chats);
  const [newChatType, setNewChatType] = useState<'plot'|'character'|'world'>('plot');
  const [newChatTitle, setNewChatTitle] = useState('');
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);
  const [createChatError, setCreateChatError] = useState<string | null>(null);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [hasChaptersCache, setHasChaptersCache] = useState<boolean>(false);
  const [leftWidth, setLeftWidth] = useState<number>(260);
  const [rightWidth, setRightWidth] = useState<number>(260);
  const [isMobile, setIsMobile] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Hydrate chats from localStorage after mount (prevents SSR/client mismatch)
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const s = window.localStorage.getItem(chatsCacheKey);
        if (s) {
          const arr = JSON.parse(s);
          if (Array.isArray(arr)) {
            setChats(arr as any);
            setHasChatsCache((arr as any[]).length > 0);
          }
        }
        const v = window.localStorage.getItem(chatsActiveKey);
        if (v) setActiveChatId(v);
        // Hydrate chapters
        const chs = window.localStorage.getItem(chaptersCacheKey);
        if (chs) {
          const arr = JSON.parse(chs);
          if (Array.isArray(arr)) {
            setChapters(arr as any);
            const valid = (arr as any[]).length > 0;
            setHasChaptersCache(valid);
            if (valid) setLoadingCh(false);
          }
        }
        // Hydrate tabs and active tab
        const t = window.localStorage.getItem(tabsCacheKey);
        if (t) {
          const arr = JSON.parse(t);
          if (Array.isArray(arr)) setTabs(arr as any);
        }
        const at = window.localStorage.getItem(activeTabKey);
        if (at) setActiveId(at);
        // Hydrate UI toggles
        const lc = window.localStorage.getItem(leftCollapsedKey);
        if (lc !== null) setLeftCollapsed(lc === '1');
        const ro = window.localStorage.getItem(rightOpenKey);
        if (ro !== null) setRightOpen(ro === '1');
        const lw = window.localStorage.getItem(leftWidthKey);
        if (lw) {
          const n = parseInt(lw, 10);
          if (!Number.isNaN(n)) setLeftWidth(Math.max(200, Math.min(600, n)));
        }
        const rw = window.localStorage.getItem(rightWidthKey);
        if (rw) {
          const n = parseInt(rw, 10);
          if (!Number.isNaN(n)) setRightWidth(Math.max(220, Math.min(600, n)));
        }
      }
    } catch {}
  }, [chatsCacheKey, chatsActiveKey, chaptersCacheKey, tabsCacheKey, activeTabKey, leftCollapsedKey, rightOpenKey]);

  // Helper: sort chapters by createdAt asc (fallback by title)
  const sortChapters = useCallback((arr: ChapterItem[]) => {
    return [...arr].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (ta !== tb) return ta - tb;
      return (a.title || '').localeCompare(b.title || '');
    });
  }, []);

  // Load chapters for tree
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (hasChaptersCache) { return; }
      try {
        setLoadingCh(true);
        const { items } = await api.listChaptersPaginated(projectId, 0, 100);
        if (!mounted) return;
        setChapters(sortChapters(items as ChapterItem[]));
      } catch (e: any) {
        if (mounted) setErrorCh(e?.message || "Failed to load chapters");
      } finally {
        if (mounted) setLoadingCh(false);
      }
    })();
    return () => { mounted = false; };
  }, [api, projectId, sortChapters, hasChaptersCache]);

  // Reflect settings updates triggered from Chat or elsewhere immediately
  useEffect(() => {
    const onSettings = (e: any) => {
      const detail = e?.detail || {};
      const changes = detail.changes || {};
      if (changes.title !== undefined) setProjectTitle(changes.title || '');
      if (changes.description !== undefined) setProjectDescription(changes.description || '');
      if (changes.mode) setProjMode(changes.mode);
      if (Array.isArray(changes.genres)) setProjGenres(changes.genres);
      if (changes.coreConflict !== undefined) setProjCoreConflict(changes.coreConflict || '');
      if (changes.settingsJson !== undefined) {
        try { setProjSettingsJson(typeof changes.settingsJson === 'string' ? changes.settingsJson : JSON.stringify(changes.settingsJson)); } catch { setProjSettingsJson(''); }
      }
    };
    const onMode = (e: any) => {
      const m = e?.detail?.mode;
      if (m === 'novel' || m === 'manhwa') setProjMode(m);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('project:settings-updated', onSettings as any);
      window.addEventListener('project:mode-updated', onMode as any);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('project:settings-updated', onSettings as any);
        window.removeEventListener('project:mode-updated', onMode as any);
      }
    };
  }, []);

  // Listen for chat actions to create/open chapters in editor
  useEffect(() => {
    const handler = async (e: any) => {
      try {
        const detail = e?.detail || {};
        const t = String(detail.title || 'Untitled Chapter');
        const c = detail.content !== undefined ? String(detail.content) : '';
        const panel_script = detail.panel_script ?? undefined;
        const res = await api.createChapter(projectId, panel_script ? { title: t, panel_script } : { title: t, content: c });
        const newId = (res as any).id as string;
        const createdAt = (res as any).createdAt as string | undefined;
        setChapters((prev) => sortChapters([...prev, { id: newId, title: (res as any).title, content: panel_script ? '' : c, createdAt }]));
        setTabs((prev) => (prev.includes(newId) ? prev : [...prev, newId]));
        setActiveId(newId);
        setTitle((res as any).title);
        setContent(panel_script ? '' : c);
      } catch {}
    };
    if (typeof window !== 'undefined') window.addEventListener('workspace:create-draft', handler as any);
    return () => { if (typeof window !== 'undefined') window.removeEventListener('workspace:create-draft', handler as any); };
  }, [api, projectId, sortChapters]);

  // Listen for chat-driven chapter updates (rewrite)
  useEffect(() => {
    const handler = async (e: any) => {
      const detail = e?.detail || {};
      const content = String(detail.content || '');
      let targetId: string | null = detail.id || null;
      if (!targetId) {
        // Resolve by chapter_number (1-based) against sorted order
        if (detail.chapter_number && Number.isInteger(detail.chapter_number)) {
          const sorted = sortChapters(chapters);
          const idx = Math.max(0, Math.min(sorted.length - 1, detail.chapter_number - 1));
          targetId = sorted[idx]?.id || null;
        } else if (detail.title) {
          const match = chapters.find((c) => (c.title || '').toLowerCase() === String(detail.title).toLowerCase());
          targetId = match?.id || null;
        }
      }
      if (!targetId) return;
      try {
        const updated = await api.updateChapter(projectId, targetId, { content });
        setChapters((prev) => prev.map((c) => c.id === targetId ? { ...c, content } : c));
        // Open or refresh active tab
        if (!tabs.includes(targetId)) setTabs((prev) => [...prev, targetId!]);
        setActiveId(targetId);
        if (activeId === targetId) {
          setContent(content);
          contentRef.current = content;
          try { if (editorRef.current) { editorRef.current.textContent = content; placeCaretAtEnd(editorRef.current); } } catch {}
        }
      } catch {}
    };
    if (typeof window !== 'undefined') window.addEventListener('workspace:update-chapter', handler as any);
    return () => { if (typeof window !== 'undefined') window.removeEventListener('workspace:update-chapter', handler as any); };
  }, [api, projectId, chapters, tabs, activeId, sortChapters]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const p = await api.getProject(projectId);
        if (!mounted) return;
        setProjectTitle(p?.title || "");
        setProjectDescription(p?.description || "");
        try {
          if (p?.mode && (p.mode === 'novel' || p.mode === 'manhwa')) setProjMode(p.mode);
          if (Array.isArray(p?.genres)) setProjGenres(p.genres);
          if (typeof p?.coreConflict === 'string') setProjCoreConflict(p.coreConflict);
          if (p?.settingsJson !== undefined) {
            setProjSettingsJson(typeof p.settingsJson === 'string' ? p.settingsJson : JSON.stringify(p.settingsJson));
          }
          if (typeof p?.coverImage === 'string') setProjCoverImage(p.coverImage);
          else if (typeof (p as any)?.cover_image === 'string') setProjCoverImage((p as any).cover_image);
        } catch {}
      } catch {}
    })();
    return () => { mounted = false; };
  }, [api, projectId]);

  // Initialize Project Settings form fields when the tab opens or project fields hydrate
  useEffect(() => {
    if (activeId === SETTINGS_TAB_ID) {
      if (!renameTitle && projectTitle) setRenameTitle(projectTitle);
      if (!renameDesc && (projectDescription !== undefined)) setRenameDesc(projectDescription);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, projectTitle, projectDescription]);

  // Upload cover image handler
  const onUploadCoverImage = useCallback(async (files: File[]) => {
    if (!files || files.length === 0) return;
    setUploadingCover(true);
    setUploadStatusCover('uploading');
    try {
      const bucket = process.env.NEXT_PUBLIC_SUPABASE_COVER_BUCKET
        || process.env.NEXT_PUBLIC_SUPABASE_IMAGE_BUCKET
        || process.env.NEXT_PUBLIC_SUPABASE_BUCKET
        || "projectcoverimage";
      const file = files[0]; // Only use first file for cover
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${projectId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      try { console.debug('Supabase cover upload start', { bucket, path, file: { name: file.name, type: file.type, size: file.size } }); } catch {}
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      const url = data.publicUrl;
      setProjCoverImage(url);
      try { console.debug('Supabase cover upload done', { url }); } catch {}
      
      // Persist to database
      try {
        await api.updateProjectSettings(projectId, { coverImage: url });
        try { console.debug('Cover image persisted', { projectId }); } catch {}
      } catch (e: any) {
        console.error('Failed to persist cover image:', e);
        setToastMsg('Image uploaded but failed to save');
      }
      
      setToastMsg('Cover image uploaded');
      setUploadStatusCover('uploaded');
      setTimeout(() => { try { setUploadStatusCover('idle'); } catch {} }, 2000);
    } catch (e: any) {
      console.error('Cover upload failed:', e);
      setToastMsg(e?.message || 'Upload failed');
      setUploadStatusCover('error');
    } finally {
      setUploadingCover(false);
    }
  }, [projectId, supabase, api]);

  // Load chats (hydrate from cache first, then revalidate)
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (hasChatsCache) { return; }
      try {
        const xs = await api.listChats(projectId);
        if (!mounted) return;
        const next = xs || [];
        try {
          if (hasChatsCache && JSON.stringify(next) === JSON.stringify(chatsRef.current)) {
            return;
          }
        } catch {}
        setChats(next);
        if (!activeChatId) {
          if (next && next.length) setActiveChatId(next[0].id);
          else {
            // ensure at least one plot chat exists
            const created = await api.createChat(projectId, { type: 'plot' });
            setChats([created]);
            setActiveChatId(created.id);
          }
        }
      } catch {}
    })();
    return () => { mounted = false; };
  }, [api, projectId, hasChatsCache, activeChatId]);

  useEffect(() => { chatsRef.current = chats; }, [chats]);
  useEffect(() => {
    try { if (typeof window !== 'undefined') window.localStorage.setItem(chatsCacheKey, JSON.stringify(chats)); } catch {}
    setHasChatsCache(Array.isArray(chats) && chats.length > 0);
  }, [chats, chatsCacheKey]);
  useEffect(() => {
    try { if (typeof window !== 'undefined' && activeChatId) window.localStorage.setItem(chatsActiveKey, activeChatId); } catch {}
  }, [activeChatId, chatsActiveKey]);
  // Persist chapters cache
  useEffect(() => {
    try { if (typeof window !== 'undefined') window.localStorage.setItem(chaptersCacheKey, JSON.stringify(chapters)); } catch {}
    setHasChaptersCache(Array.isArray(chapters) && chapters.length > 0);
  }, [chapters, chaptersCacheKey]);
  // Persist tabs and active tab
  useEffect(() => {
    try { if (typeof window !== 'undefined') window.localStorage.setItem(tabsCacheKey, JSON.stringify(tabs)); } catch {}
  }, [tabs, tabsCacheKey]);
  useEffect(() => {
    try { if (typeof window !== 'undefined' && activeId) window.localStorage.setItem(activeTabKey, activeId); } catch {}
  }, [activeId, activeTabKey]);
  // Persist UI toggles
  useEffect(() => {
    try { if (typeof window !== 'undefined') window.localStorage.setItem(leftCollapsedKey, leftCollapsed ? '1' : '0'); } catch {}
  }, [leftCollapsed, leftCollapsedKey]);
  useEffect(() => {
    try { if (typeof window !== 'undefined') window.localStorage.setItem(rightOpenKey, rightOpen ? '1' : '0'); } catch {}
  }, [rightOpen, rightOpenKey]);
  useEffect(() => {
    try { if (typeof window !== 'undefined') window.localStorage.setItem(leftWidthKey, String(leftWidth)); } catch {}
  }, [leftWidth, leftWidthKey]);
  useEffect(() => {
    try { if (typeof window !== 'undefined') window.localStorage.setItem(rightWidthKey, String(rightWidth)); } catch {}
  }, [rightWidth, rightWidthKey]);

  const openTab = useCallback((id: string) => {
    setTabs((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setActiveId(id);
    const ch = chapters.find((c) => c.id === id);
    setTitle(ch?.title || "");
    setContent((ch?.content || "") as string);
    setPrice(ch?.price || 0);
    contentRef.current = (ch?.content || "") as string;
    try { if (editorRef.current) { editorRef.current.textContent = (ch?.content || "") as string; placeCaretAtEnd(editorRef.current); } } catch {}
  }, [chapters]);

  const closeTab = useCallback((id: string) => {
    setTabs((prev) => prev.filter((t) => t !== id));
    setActiveId((curr) => {
      if (curr !== id) return curr;
      const idx = tabs.indexOf(id);
      const next = tabs[idx + 1] || tabs[idx - 1] || null;
      return next || null;
    });
  }, [tabs]);

  // Hydrate editor fields when activeId and chapters are restored from cache
  const chaptersRef = useRef(chapters);
  useEffect(() => { chaptersRef.current = chapters; }, [chapters]);

  useEffect(() => {
    if (!activeId) return;
    if (activeId === SETTINGS_TAB_ID || activeId === CHARACTERS_TAB_ID || activeId === WORLD_TAB_ID) return;
    const ch = chaptersRef.current.find((c) => c.id === activeId);
    if (!ch) return;
    setTitle(ch.title || "");
    setContent((ch.content || "") as string);
    setPrice(ch.price || 0);
    contentRef.current = (ch.content || "") as string;
    try { if (editorRef.current) { editorRef.current.textContent = (ch.content || "") as string; placeCaretAtEnd(editorRef.current); } } catch {}
  }, [activeId]);

  const onDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    e.dataTransfer.setData("text/tab", id);
  };
  const onDrop = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
    const srcId = e.dataTransfer.getData("text/tab");
    if (!srcId || srcId === targetId) return;
    setTabs((prev) => {
      const arr = [...prev];
      const si = arr.indexOf(srcId);
      const ti = arr.indexOf(targetId);
      if (si < 0 || ti < 0) return prev;
      arr.splice(ti, 0, arr.splice(si, 1)[0]);
      return arr;
    });
  };

  const startLeftResize = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = leftWidth;
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const next = Math.max(200, Math.min(600, startW + dx));
      setLeftWidth(next);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [leftWidth]);

  const startRightResize = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = rightWidth;
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const next = Math.max(220, Math.min(600, startW - dx));
      setRightWidth(next);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [rightWidth]);

  // Persist edits (debounced)
  const scheduleSave = useCallback((id: string, t: string, c: string, p: number) => {
    if (!id) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await api.updateChapter(projectId, id, { title: t, content: c, price: p });
        setChapters((prev) => prev.map((ch) => ch.id === id ? { ...ch, title: t, content: c, price: p } : ch));
      } finally {
        setSaving(false);
      }
    }, 500);
  }, [api, projectId]);

  // Active change handlers
  const onTitleChange = (v: string) => {
    if (!activeId) return;
    setTitle(v);
    const live = editorRef.current?.textContent || content;
    scheduleSave(activeId, v, live, price);
  };
  const onContentChange = (v: string) => {
    if (!activeId) return;
    contentRef.current = v;
    scheduleSave(activeId, title, v, price);
    // Ensure any inserted elements retain LTR direction
    try {
      const el = editorRef.current;
      if (el) {
        el.dir = 'ltr';
        (el.style as any).direction = 'ltr';
        (el.style as any).textAlign = 'left';
        for (let i = 0; i < el.childNodes.length; i++) {
          const n = el.childNodes[i] as HTMLElement;
          if (n && n.nodeType === 1) {
            (n as HTMLElement).setAttribute('dir','ltr');
            (n as HTMLElement).style.direction = 'ltr';
            (n as HTMLElement).style.textAlign = 'left';
          }
        }
      }
    } catch {}
    // Removed placeCaretAtEnd call - cursor should stay at current position during editing
  };

  const onPriceChange = (v: string) => {
    if (!activeId) return;
    const p = parseInt(v) || 0;
    setPrice(p);
    const live = editorRef.current?.textContent || content;
    scheduleSave(activeId, title, live, p);
  };

  const onNewChapter = async () => {
    try {
      setCreatingChapter(true);
      const res = await api.createChapter(projectId, { title: "Untitled Chapter" });
      const createdAt = (res as any).createdAt as string | undefined;
      setChapters((prev) => sortChapters([...prev, { id: (res as any).id, title: (res as any).title, content: "", createdAt }]));
      openTab((res as any).id);
    } catch {}
    finally { setCreatingChapter(false); }
  };

  const onDeleteChapter = useCallback(async (id: string) => {
    try {
      // eslint-disable-next-line no-alert
      if (!confirm('Delete this chapter permanently?')) return;
      setDeletingId(id);
      await api.deleteChapter(projectId, id);
      setChapters((prev) => prev.filter((c) => c.id !== id));
      setTabs((prev) => prev.filter((t) => t !== id));
      setActiveId((curr) => (curr === id ? null : curr));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete';
      setErrorCh(msg);
    } finally {
      setDeletingId(null);
    }
  }, [api, projectId]);

  const activeChapter = chapters.find((c) => c.id === activeId) || null;

  const gridCols = useMemo(() => {
    // On mobile, sidebars are overlays, so grid is just the main content
    if (isMobile) return '1fr';
    
    const cols: string[] = [];
    if (!leftCollapsed) { cols.push(`${leftWidth}px`); cols.push('4px'); }
    cols.push('1fr');
    if (rightOpen) { cols.push('4px'); cols.push(`${rightWidth}px`); }
    return cols.join(' ');
  }, [leftCollapsed, rightOpen, leftWidth, rightWidth, isMobile]);

  return (
    <div className="h-screen w-screen bg-bg-primary text-text-primary grid grid-rows-[auto_1fr] relative">
      {/* Top Tabs Bar */}
      <div className="h-12 border-b border-border-default bg-bg-primary flex items-center relative">
        {/* Tabs - hidden on mobile */}
        {!isMobile && (
          <div className="flex-1 min-w-0 flex items-stretch gap-1 px-2 overflow-x-auto">
            {tabs.map((id) => {
              const ch = chapters.find((c) => c.id === id);
              const active = id === activeId;
              const label = id === SETTINGS_TAB_ID ? 'Settings' : (id === CHARACTERS_TAB_ID ? 'Characters' : (ch?.title || 'Untitled'));
              return (
                <div
                  key={id}
                  draggable
                  onDragStart={(e) => onDragStart(e, id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => onDrop(e, id)}
                  onMouseDown={(e) => { if (e.button === 1) { e.preventDefault(); closeTab(id); } }}
                  className={`group flex items-center gap-2 px-4 h-10 rounded-t-md transition-all duration-150 ${active ? 'bg-bg-elevated text-text-primary' : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'}`}
                  onClick={() => setActiveId(id)}
                >
                  <span className="text-sm truncate max-w-[160px]">{label}</span>
                  <button className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity duration-150" onClick={(e) => { e.stopPropagation(); closeTab(id); }}>×</button>
                </div>
              );
            })}
          </div>
        )}
        {/* Project Title - centered on desktop, left-aligned on mobile */}
        <div className={`${isMobile ? 'flex-1 px-4' : 'absolute inset-0 flex items-center justify-center pointer-events-none'}`}>
          <div className="text-sm font-semibold text-text-primary truncate max-w-[60%] tracking-elegant">{projectTitle || 'Project'}</div>
        </div>
        {/* Settings button - always visible */}
        <div className={`${isMobile ? 'flex items-center gap-2' : 'absolute right-2 top-1 z-10 flex items-center gap-2'}`}>
          <button
            className="text-xs px-3 py-1.5 rounded-md border border-border-default bg-bg-elevated text-text-secondary hover:text-accent hover:border-accent transition-all duration-150"
            onClick={() => setSettingsMenuOpen((v) => !v)}
          >
            <span className="sr-only">Settings</span>
            <IconSettings className="w-4 h-4" aria-hidden="true" />
          </button>
          {settingsMenuOpen && (
            <div className="absolute right-0 top-10 z-20 w-48 rounded-lg border border-border-default bg-bg-elevated shadow-elevation">
              <button
                className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-all duration-150"
                onClick={() => {
                  setSettingsMenuOpen(false);
                  // Open settings as a central tab
                  if (!tabs.includes(SETTINGS_TAB_ID)) setTabs((prev) => [...prev, SETTINGS_TAB_ID]);
                  setActiveId(SETTINGS_TAB_ID);
                  setRenameTitle(projectTitle || '');
                  setRenameDesc(projectDescription || '');
                  setRenameError(null);
                }}
              >Project Settings</button>
              <button
                className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-all duration-150"
                onClick={() => {
                  setSettingsMenuOpen(false);
                  if (!tabs.includes(WORLD_TAB_ID)) setTabs((prev) => [...prev, WORLD_TAB_ID]);
                  setActiveId(WORLD_TAB_ID);
                }}
              >World Settings</button>
              <button
                className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-all duration-150"
                onClick={() => {
                  setSettingsMenuOpen(false);
                  if (!tabs.includes(CHARACTERS_TAB_ID)) setTabs((prev) => [...prev, CHARACTERS_TAB_ID]);
                  setActiveId(CHARACTERS_TAB_ID);
                }}
              >Characters</button>
            </div>
          )}
        </div>
      </div>

      {leftCollapsed && (
        <button
          className="absolute left-2 top-14 z-10 px-2 py-2 rounded-md border border-border-default bg-bg-elevated text-text-secondary hover:text-accent hover:border-accent transition-all duration-150 flex items-center justify-center shadow-elevation"
          onClick={() => setLeftCollapsed(false)}
          title="Open Chapters"
        >
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
          <span className="sr-only">Open Chapters</span>
        </button>
      )}

      {/* Layout: Left sidebar + Main editor + Right sidebar */}
      <div className="grid min-h-0" style={{ gridTemplateColumns: gridCols }}>
        {!leftCollapsed && !isMobile && (
        <aside className="bg-bg-primary min-h-0 flex flex-col">
          <div className="px-5 py-4 text-xs font-semibold tracking-[0.05em] uppercase flex items-center justify-between text-text-secondary">
            <span>CHAPTERS</span>
            <button className="text-text-tertiary hover:text-accent rounded p-1 hover:bg-bg-hover transition-all duration-150" onClick={() => setLeftCollapsed(true)}>
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              <span className="sr-only">Collapse</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4">
            {loadingCh && <div className="text-xs text-text-secondary px-2 py-2">Loading…</div>}
            {errorCh && <div className="text-xs text-red-400 px-2 py-2 bg-red-950/20 rounded-md border border-red-500/20">{errorCh}</div>}
            {chapters.map((c, idx) => {
              const wordCount = c.content ? c.content.trim().split(/\s+/).filter(Boolean).length : 0;
              return (
              <div key={c.id} className={`group w-full flex items-start justify-between gap-2 px-3 py-3 rounded-lg mb-2 transition-all duration-150 ${activeId === c.id ? 'bg-bg-elevated border-l-3 border-accent' : 'hover:bg-bg-hover'}`}>
                <button
                  className="flex-1 text-left"
                  onClick={() => openTab(c.id)}
                >
                  <div className="text-xs uppercase text-text-tertiary mb-1">Chapter {idx + 1}</div>
                  <div className={`text-sm font-medium mb-1 ${activeId === c.id ? 'text-text-primary' : 'text-text-secondary'}`}>{c.title || 'Untitled'}</div>
                  <div className="text-xs text-text-tertiary">{wordCount} words</div>
                </button>
                <button
                  className={`${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-150 ${deletingId === c.id ? 'text-red-400 opacity-60 cursor-not-allowed' : 'text-text-tertiary hover:text-red-400'}`}
                  onClick={(e) => { e.stopPropagation(); if (deletingId) return; void onDeleteChapter(c.id); }}
                  title="Delete chapter"
                  disabled={deletingId === c.id}
                >
                  {deletingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Trash2 className="w-4 h-4" aria-hidden="true" />}
                  <span className="sr-only">Delete</span>
                </button>
              </div>
            );})}
          </div>
          <div className="p-4 border-t border-border-default">
            <button className="w-full rounded-lg bg-bg-elevated border border-border-default hover:border-accent hover:bg-bg-hover text-text-secondary hover:text-text-primary text-sm px-4 py-3 flex items-center justify-center gap-2 transition-all duration-150 hover:-translate-y-0.5 disabled:opacity-50" onClick={onNewChapter} disabled={creatingChapter}>
              {creatingChapter ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Plus className="w-4 h-4" aria-hidden="true" />}
              <span>{creatingChapter ? 'Creating…' : 'New Chapter'}</span>
            </button>
          </div>
        </aside>
        )}
        {!leftCollapsed && !isMobile && (
          <div
            role="separator"
            aria-orientation="vertical"
            onMouseDown={startLeftResize}
            className="cursor-col-resize w-1 bg-transparent hover:bg-bg-hover"
            style={{ userSelect: 'none' }}
          />
        )}

        {/* Center: Editor */}
        <main className="min-h-0 overflow-hidden bg-bg-primary flex flex-col">
          {activeId === SETTINGS_TAB_ID ? (
            <div className="h-full grid grid-rows-[auto_1fr_auto] bg-bg-elevated">
              <div className="border-b border-border-default px-6 py-4">
                <div className="text-base font-semibold text-text-primary tracking-elegant">Project Settings</div>
              </div>
              <div className="min-h-0 overflow-y-auto px-6 py-6">
                <div className="grid gap-4 max-w-2xl">
                  <div ref={coverDropRef} className="flex flex-col items-start mb-2 p-4 rounded-xl border border-border-default bg-bg-primary w-full">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs text-text-tertiary uppercase tracking-wide">Cover Image</span>
                      <label className="px-3 py-2 rounded-md border border-border-default bg-bg-elevated text-text-secondary hover:text-text-primary inline-flex items-center gap-2 cursor-pointer">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Upload Image
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const files = Array.from(e.target.files || []); if (files.length) { (async () => { await onUploadCoverImage(files as File[]); })(); } }} />
                      </label>
                      {uploadingCover && <div className="text-xs text-text-tertiary inline-flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Uploading…</div>}
                      {uploadStatusCover === 'uploaded' && !uploadingCover && <div className="text-xs text-green-400">Uploaded</div>}
                      {uploadStatusCover === 'error' && !uploadingCover && <div className="text-xs text-red-400">Upload failed</div>}
                    </div>
                    {projCoverImage && (
                      <div className="relative border border-border-default rounded-md overflow-hidden bg-bg-primary w-full max-w-xs h-40">
                        <img src={projCoverImage} alt="cover" className="w-full h-full object-cover" />
                      </div>
                    )}
                    {!projCoverImage && (
                      <div className="text-xs text-text-tertiary">No cover image yet. Upload or drop here.</div>
                    )}
                  </div>
                  <label className="grid gap-2 text-sm">
                    <span className="text-xs text-text-tertiary uppercase tracking-wide">Title</span>
                    <input
                      value={renameTitle}
                      onChange={(e) => setRenameTitle(e.target.value)}
                      className="w-full bg-bg-primary border border-border-default rounded-md px-4 py-2.5 text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent transition-colors duration-150"
                    />
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="text-xs text-text-tertiary uppercase tracking-wide">Description</span>
                    <textarea
                      value={renameDesc}
                      onChange={(e) => setRenameDesc(e.target.value)}
                      rows={3}
                      className="w-full bg-bg-primary border border-border-default rounded-md px-4 py-2.5 text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent transition-colors duration-150 text-sm"
                    />
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="text-xs text-text-tertiary uppercase tracking-wide">Mode</span>
                    <select
                      value={projMode}
                      onChange={(e) => setProjMode(e.target.value as any)}
                      className="w-full bg-bg-primary border border-border-default rounded-md px-4 py-2.5 text-text-primary outline-none focus:border-accent transition-colors duration-150"
                    >
                      <option value="">Select…</option>
                      <option value="novel">Novel</option>
                      <option value="manhwa">Manhwa</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="text-xs text-text-tertiary uppercase tracking-wide">Genres (comma-separated)</span>
                    <input
                      value={projGenres.join(', ')}
                      onChange={(e) => setProjGenres(e.target.value.split(',').map(g => g.trim()).filter(g => g))}
                      placeholder="e.g., Fantasy, Adventure"
                      className="w-full bg-bg-primary border border-border-default rounded-md px-4 py-2.5 text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent transition-colors duration-150"
                    />
                  </label>
                  {/* World Name removed */}
                  <label className="grid gap-2 text-sm">
                    <span className="text-xs text-text-tertiary uppercase tracking-wide">Core Conflict</span>
                    <input
                      value={projCoreConflict}
                      onChange={(e) => setProjCoreConflict(e.target.value)}
                      className="w-full bg-bg-primary border border-border-default rounded-md px-4 py-2.5 text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent transition-colors duration-150"
                    />
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="text-xs text-text-tertiary uppercase tracking-wide">Settings JSON</span>
                    <textarea
                      value={projSettingsJson}
                      onChange={(e) => setProjSettingsJson(e.target.value)}
                      rows={10}
                      className="w-full bg-bg-primary border border-border-default rounded-md px-4 py-2.5 text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent transition-colors duration-150 font-mono text-xs"
                    />
                  </label>
                  {renameError && <div className="text-sm text-red-400 p-3 rounded-lg bg-red-950/20 border border-red-500/20">{renameError}</div>}
                </div>
              </div>
              <div className="h-14 px-6 flex items-center justify-end gap-3 border-t border-border-default bg-bg-primary">
                <button onClick={() => setActiveId(null)} className="px-4 py-2 rounded-md border border-border-default text-text-secondary hover:bg-bg-hover transition-all duration-150">Close</button>
                <button
                  disabled={savingRename}
                  onClick={async () => {
                    setSavingRename(true);
                    setRenameError(null);
                    try {
                      const updateBody: any = {};
                      const t = renameTitle.trim();
                      if (t && t !== projectTitle) updateBody.title = t;
                      if (renameDesc !== projectDescription) updateBody.description = renameDesc;
                      if (Object.keys(updateBody).length > 0) {
                        const updated = await api.updateProject(projectId, updateBody);
                        setProjectTitle(updated?.title || t || projectTitle);
                        setProjectDescription(updated?.description ?? renameDesc ?? projectDescription);
                      }
                      const changes: any = {};
                      if (projMode) changes.mode = projMode;
                      if (projGenres.length > 0) changes.genres = projGenres;
                      if (projCoreConflict) changes.coreConflict = projCoreConflict;
                      if (projSettingsJson) {
                        try { changes.settingsJson = JSON.parse(projSettingsJson); } catch { changes.settingsJson = projSettingsJson; }
                      }
                      if (Object.keys(changes).length > 0) {
                        await api.updateProjectSettings(projectId, changes);
                        if (typeof window !== 'undefined') {
                          window.dispatchEvent(new CustomEvent('project:settings-updated', { detail: { projectId, changes } }));
                        }
                        // Toast: Settings saved
                        if (toastTimer.current) clearTimeout(toastTimer.current);
                        setToastMsg('Settings saved');
                        toastTimer.current = setTimeout(() => setToastMsg(''), 3000);
                      }
                    } catch (e: any) {
                      setRenameError(e?.message || 'Failed to save');
                    } finally {
                      setSavingRename(false);
                    }
                  }}
                  className="px-4 py-2 rounded-md bg-accent hover:bg-accent-hover disabled:opacity-50 text-white transition-all duration-150"
                >
                  {savingRename ? 'Saving…' : 'Save Settings'}
                </button>
              </div>
            </div>
          ) : activeId === CHARACTERS_TAB_ID ? (
            <div className="h-full bg-bg-elevated">
              <CharacterManager projectId={projectId} requireImage={projMode === 'manhwa'} />
            </div>
          ) : activeId === WORLD_TAB_ID ? (
            <div className="h-full bg-bg-elevated">
              <WorldSettingsManager projectId={projectId} />
            </div>
          ) : activeId ? (
            <div className="h-full flex flex-col">
              {/* Editor Canvas - Elevated Surface */}
              <div className="flex-1 min-h-0 overflow-y-auto bg-bg-elevated flex justify-center" dir="ltr" style={{ direction: 'ltr' }}>
                <div className="w-full max-w-[800px] px-12 py-16 text-left" dir="ltr" style={{ direction: 'ltr' }}>
                  {/* Chapter Title Input */}
                  <div className="flex items-center gap-4 mb-6">
                    <input
                      value={title}
                      onChange={(e) => onTitleChange(e.target.value)}
                      placeholder="Chapter Title"
                      dir="ltr"
                      className="flex-1 bg-transparent border-none text-[32px] font-bold text-text-primary placeholder:text-text-tertiary outline-none tracking-tight text-left"
                    />
                    
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                           if (price > 0) onPriceChange("0");
                           else onPriceChange("5"); // Default 5 coins
                        }}
                        className={`p-2 rounded-full transition-colors ${price > 0 ? 'bg-yellow-500/10 text-yellow-500' : 'text-text-tertiary hover:bg-bg-hover'}`}
                        title={price > 0 ? "Chapter is Locked (Premium)" : "Chapter is Free"}
                      >
                         {price > 0 ? <Lock size={20} className="fill-current" /> : <LockOpen size={20} />}
                      </button>

                      {price > 0 && (
                        <div className="flex items-center gap-2 bg-bg-primary rounded-lg px-3 py-1.5 border border-yellow-500/30 animate-in fade-in slide-in-from-right-2">
                            <span className="text-xs text-yellow-500 font-bold uppercase tracking-wider">Price</span>
                            <input
                               type="number"
                               min="1"
                               value={price}
                               onChange={(e) => onPriceChange(e.target.value)}
                               className="w-12 bg-transparent border-none text-sm font-semibold text-text-primary outline-none text-right appearance-none"
                            />
                            <span className="text-xs text-text-secondary font-medium">Coins</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Chapter Content - Contenteditable */}
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) => onContentChange(e.currentTarget.textContent || '')}
                    className="w-full min-h-[400px] text-lg leading-[1.8] text-text-primary outline-none text-left"
                    dir="ltr"
                    style={{ whiteSpace: 'pre-wrap', direction: 'ltr', textAlign: 'left', unicodeBidi: 'bidi-override' as any, writingMode: 'horizontal-tb' as any }}
                    ref={editorRef}
                  >
                  </div>
                  {!( (editorRef.current?.textContent ?? content) || '' ).length && (
                    <div className="text-lg text-text-tertiary pointer-events-none -mt-[400px] leading-[1.8]">Start writing your story...</div>
                  )}
                </div>
              </div>
              {/* Status Bar */}
              <div className="h-12 bg-bg-primary border-t border-border-default px-4 flex items-center justify-between text-[12px] text-text-tertiary gap-4 overflow-hidden">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className={`w-1.5 h-1.5 rounded-full ${saving ? 'bg-warning animate-pulse' : 'bg-success'}`} />
                    <span className="whitespace-nowrap">{saving ? 'Saving…' : 'Saved'}</span>
                  </div>
                  <div className="hidden sm:block whitespace-nowrap">{content.trim().split(/\s+/).filter(Boolean).length} words</div>
                  <div className="hidden md:block whitespace-nowrap">{content.length} chars</div>
                  <div className="hidden lg:block whitespace-nowrap">{Math.ceil(content.trim().split(/\s+/).filter(Boolean).length / 200)} min</div>
                </div>
                <div className="hidden sm:block text-right truncate flex-shrink-0">
                  {activeChapter?.createdAt && `${new Date(activeChapter.createdAt).toLocaleDateString()} ${new Date(activeChapter.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full bg-bg-elevated flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="text-base font-semibold text-text-primary mb-2">No Chapter Selected</div>
                <div className="text-sm text-text-secondary">Open a chapter from the left sidebar to start editing.</div>
              </div>
            </div>
          )}
        </main>

        {/* Right: Chats Sidebar */}
        {rightOpen && !isMobile && (
        <div
          role="separator"
          aria-orientation="vertical"
          onMouseDown={startRightResize}
          className="cursor-col-resize w-1 bg-transparent hover:bg-bg-hover"
          style={{ userSelect: 'none' }}
        />
        )}
        {rightOpen && !isMobile && (
        <aside className="relative bg-bg-primary min-h-0 flex flex-col">
          <div className="px-5 py-4 text-xs font-semibold tracking-[0.05em] uppercase flex items-center justify-between text-text-secondary">
            <button className="flex items-center gap-2 text-text-secondary hover:text-text-primary" onClick={() => setChatMenuOpen((v)=>!v)}>
              <span className="truncate max-w-[140px] text-text-primary normal-case text-sm font-medium">{(chats.find(c=>c.id===activeChatId)?.title) || 'Select chat'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${chatMenuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            <div className="flex items-center gap-2">
              <button className="text-text-tertiary hover:text-accent rounded p-1 hover:bg-bg-hover transition-all duration-150" onClick={() => { setNewChatOpen(true); setChatMenuOpen(true); }} title="New Chat">
                <Plus className="w-4 h-4" aria-hidden="true" />
              </button>
              <button className="text-text-tertiary hover:text-accent rounded p-1 hover:bg-bg-hover transition-all duration-150" onClick={() => setRightOpen(false)}>
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
                <span className="sr-only">Collapse</span>
              </button>
            </div>
          </div>
          {chatMenuOpen && (
            <div className="absolute left-3 right-3 top-14 z-20 rounded-lg border border-border-default bg-bg-elevated shadow-elevation">
              <div className="p-3 border-b border-border-default flex items-center justify-between">
                <div className="text-sm font-semibold text-text-primary">Chats</div>
                <button className="text-text-tertiary hover:text-text-primary" onClick={()=> setChatMenuOpen(false)}>✕</button>
              </div>
              <div className="p-3 space-y-3">
                {newChatOpen && (
                  <div className="border border-border-default rounded-lg p-3 bg-bg-primary">
                    <div className="text-xs text-text-tertiary mb-2">Create a new chat</div>
                    <div className="flex items-center gap-2 mb-2">
                      {(['plot','character','world'] as const).map((t)=> (
                        <label key={t} className={`text-xs px-3 py-1.5 rounded-md border cursor-pointer ${newChatType===t ? 'border-accent text-accent' : 'border-border-default text-text-secondary hover:text-text-primary'}`}>
                          <input type="radio" name="chat-type" className="hidden" checked={newChatType===t} onChange={()=>setNewChatType(t)} />{t}
                        </label>
                      ))}
                    </div>
                    <input value={newChatTitle} onChange={(e)=>setNewChatTitle(e.target.value)} placeholder="Title (optional)" className="w-full bg-bg-elevated border border-border-default rounded-md px-3 py-2 text-text-primary outline-none focus:border-accent text-sm" />
                    {createChatError && <div className="mt-2 text-xs text-red-400">{createChatError}</div>}
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <button className="px-3 py-1.5 rounded-md border border-border-default text-text-secondary hover:bg-bg-hover" onClick={()=>{ setNewChatOpen(false); setNewChatTitle(''); setCreateChatError(null); }}>Cancel</button>
                      <button className="px-3 py-1.5 rounded-md bg-accent hover:bg-accent-hover text-white disabled:opacity-50" disabled={creatingChat} onClick={async ()=>{
                        setCreatingChat(true); setCreateChatError(null);
                        try {
                          const c = await api.createChat(projectId, { type: newChatType, title: newChatTitle || undefined });
                          setChats((prev)=>[...prev, c]);
                          setActiveChatId(c.id);
                          setNewChatOpen(false);
                          setNewChatTitle('');
                          setChatMenuOpen(false);
                        } catch (e: any) {
                          setCreateChatError(e?.message || 'Failed to create chat');
                        } finally { setCreatingChat(false); }
                      }}>{creatingChat ? 'Creating…' : 'Create'}</button>
                    </div>
                  </div>
                )}
                <div className="max-h-64 overflow-y-auto pr-1">
                  {!chats.length && !newChatOpen && (
                    <div className="text-xs text-text-tertiary px-2 py-2">No chats yet. <button className="underline" onClick={()=>{ setNewChatType('plot'); setNewChatOpen(true); }}>Create your first chat</button>.</div>
                  )}
                  {chats.map((c) => (
                    <div key={c.id} className={`group w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md mb-1 transition-all duration-150 ${activeChatId===c.id ? 'bg-bg-hover' : 'hover:bg-bg-hover'}`}>
                      <button className="flex-1 text-left" onClick={() => { setChatLoading(true); setActiveChatId(c.id); setChatMenuOpen(false); }}>
                        <div className="text-[10px] uppercase text-text-tertiary mb-0.5">{c.type}</div>
                        <div className={`text-sm font-medium ${activeChatId===c.id ? 'text-text-primary' : 'text-text-secondary'}`}>{c.title}</div>
                      </button>
                      <button
                        className={`${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-150 text-text-tertiary hover:text-red-400`}
                        onClick={async (e) => { e.stopPropagation(); if (!confirm('Delete this chat?')) return; try { await api.deleteChat(projectId, c.id); setChats((prev)=>prev.filter(x=>x.id!==c.id)); if (activeChatId===c.id) setActiveChatId(chats.find(x=>x.id!==c.id)?.id || null); } catch {} }}
                        title="Delete chat"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                        <span className="sr-only">Delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {/* Chat view fills the sidebar */}
          <div className="relative flex-1 overflow-hidden border-t border-border-default flex flex-col">
            {activeChatId ? (
              <Chat
                key={activeChatId || 'none'}
                chatId={activeChatId}
                projectId={projectId}
                chatType={(chats.find(c => c.id === activeChatId)?.type) || 'plot'}
                onLoadingChange={(v) => setChatLoading(Boolean(v))}
              />
            ) : (
              <div className="flex-1 grid place-items-center text-xs text-text-tertiary">Open the chat menu to create or select a chat.</div>
            )}
            {/* loading overlay hidden on mobile */}
          </div>
        </aside>
        )}
      </div>

      {/* Mobile Left Sidebar Overlay */}
      {isMobile && !leftCollapsed && (
        <aside className="fixed left-0 top-0 bottom-0 z-40 w-64 shadow-elevation bg-bg-primary min-h-0 flex flex-col">
          <div className="px-5 py-4 text-xs font-semibold tracking-[0.05em] uppercase flex items-center justify-between text-text-secondary">
            <span>CHAPTERS</span>
            <button className="text-text-tertiary hover:text-accent rounded p-1 hover:bg-bg-hover transition-all duration-150" onClick={() => setLeftCollapsed(true)}>
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              <span className="sr-only">Collapse</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4">
            {loadingCh && <div className="text-xs text-text-secondary px-2 py-2">Loading…</div>}
            {errorCh && <div className="text-xs text-red-400 px-2 py-2 bg-red-950/20 rounded-md border border-red-500/20">{errorCh}</div>}
            {chapters.map((c, idx) => {
              const wordCount = c.content ? c.content.trim().split(/\s+/).filter(Boolean).length : 0;
              return (
              <div key={c.id} className={`group w-full flex items-start justify-between gap-2 px-3 py-3 rounded-lg mb-2 transition-all duration-150 ${activeId === c.id ? 'bg-bg-elevated border-l-3 border-accent' : 'hover:bg-bg-hover'}`}>
                <button
                  className="flex-1 text-left"
                  onClick={() => openTab(c.id)}
                >
                  <div className="text-xs uppercase text-text-tertiary mb-1">Chapter {idx + 1}</div>
                  <div className={`text-sm font-medium mb-1 ${activeId === c.id ? 'text-text-primary' : 'text-text-secondary'}`}>{c.title || 'Untitled'}</div>
                  <div className="text-xs text-text-tertiary">{wordCount} words</div>
                </button>
                <button
                  className={`${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-150 ${deletingId === c.id ? 'text-red-400 opacity-60 cursor-not-allowed' : 'text-text-tertiary hover:text-red-400'}`}
                  onClick={(e) => { e.stopPropagation(); if (deletingId) return; void onDeleteChapter(c.id); }}
                  title="Delete chapter"
                  disabled={deletingId === c.id}
                >
                  {deletingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Trash2 className="w-4 h-4" aria-hidden="true" />}
                  <span className="sr-only">Delete</span>
                </button>
              </div>
            );})}
          </div>
          <div className="p-4 border-t border-border-default">
            <button className="w-full rounded-lg bg-bg-elevated border border-border-default hover:border-accent hover:bg-bg-hover text-text-secondary hover:text-text-primary text-sm px-4 py-3 flex items-center justify-center gap-2 transition-all duration-150 hover:-translate-y-0.5 disabled:opacity-50" onClick={onNewChapter} disabled={creatingChapter}>
              {creatingChapter ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Plus className="w-4 h-4" aria-hidden="true" />}
              <span>{creatingChapter ? 'Creating…' : 'New Chapter'}</span>
            </button>
          </div>
        </aside>
      )}

      {/* Mobile Right Sidebar Overlay */}
      {isMobile && rightOpen && (
        <aside className="fixed right-0 top-0 bottom-0 z-40 w-64 shadow-elevation bg-bg-primary flex flex-col">
          <div className="px-5 py-4 text-xs font-semibold tracking-[0.05em] uppercase flex items-center justify-between text-text-secondary">
            <button className="flex items-center gap-2 text-text-secondary hover:text-text-primary" onClick={() => setChatMenuOpen((v)=>!v)}>
              <span className="truncate max-w-[140px] text-text-primary normal-case text-sm font-medium">{(chats.find(c=>c.id===activeChatId)?.title) || 'Select chat'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${chatMenuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            <div className="flex items-center gap-2">
              <button className="text-text-tertiary hover:text-accent rounded p-1 hover:bg-bg-hover transition-all duration-150" onClick={() => { setNewChatOpen(true); setChatMenuOpen(true); }} title="New Chat">
                <Plus className="w-4 h-4" aria-hidden="true" />
              </button>
              <button className="text-text-tertiary hover:text-accent rounded p-1 hover:bg-bg-hover transition-all duration-150" onClick={() => setRightOpen(false)}>
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
                <span className="sr-only">Collapse</span>
              </button>
            </div>
          </div>
          {chatMenuOpen && (
            <div className="absolute left-3 right-3 top-14 z-20 rounded-lg border border-border-default bg-bg-elevated shadow-elevation">
              <div className="p-3 border-b border-border-default flex items-center justify-between">
                <div className="text-sm font-semibold text-text-primary">Chats</div>
                <button className="text-text-tertiary hover:text-text-primary" onClick={()=> setChatMenuOpen(false)}>✕</button>
              </div>
              <div className="p-3 space-y-3">
                {newChatOpen && (
                  <div className="border border-border-default rounded-lg p-3 bg-bg-primary">
                    <div className="text-xs text-text-tertiary mb-2">Create a new chat</div>
                    <div className="flex items-center gap-2 mb-2">
                      {(['plot','character','world'] as const).map((t)=> (
                        <label key={t} className={`text-xs px-3 py-1.5 rounded-md border cursor-pointer ${newChatType===t ? 'border-accent text-accent' : 'border-border-default text-text-secondary hover:text-text-primary'}`}>
                          <input type="radio" name="chat-type" className="hidden" checked={newChatType===t} onChange={()=>setNewChatType(t)} />{t}
                        </label>
                      ))}
                    </div>
                    <input value={newChatTitle} onChange={(e)=>setNewChatTitle(e.target.value)} placeholder="Title (optional)" className="w-full bg-bg-elevated border border-border-default rounded-md px-3 py-2 text-text-primary outline-none focus:border-accent text-sm" />
                    {createChatError && <div className="mt-2 text-xs text-red-400">{createChatError}</div>}
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <button className="px-3 py-1.5 rounded-md border border-border-default text-text-secondary hover:bg-bg-hover" onClick={()=>{ setNewChatOpen(false); setNewChatTitle(''); setCreateChatError(null); }}>Cancel</button>
                      <button className="px-3 py-1.5 rounded-md bg-accent hover:bg-accent-hover text-white disabled:opacity-50" disabled={creatingChat} onClick={async ()=>{
                        setCreatingChat(true); setCreateChatError(null);
                        try {
                          const c = await api.createChat(projectId, { type: newChatType, title: newChatTitle || undefined });
                          setChats((prev)=>[...prev, c]);
                          setActiveChatId(c.id);
                          setNewChatOpen(false);
                          setNewChatTitle('');
                          setChatMenuOpen(false);
                        } catch (e: any) {
                          setCreateChatError(e?.message || 'Failed to create chat');
                        } finally { setCreatingChat(false); }
                      }}>{creatingChat ? 'Creating…' : 'Create'}</button>
                    </div>
                  </div>
                )}
                <div className="max-h-64 overflow-y-auto pr-1">
                  {!chats.length && !newChatOpen && (
                    <div className="text-xs text-text-tertiary px-2 py-2">No chats yet. <button className="underline" onClick={()=>{ setNewChatType('plot'); setNewChatOpen(true); }}>Create your first chat</button>.</div>
                  )}
                  {chats.map((c) => (
                    <div key={c.id} className={`group w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md mb-1 transition-all duration-150 ${activeChatId===c.id ? 'bg-bg-hover' : 'hover:bg-bg-hover'}`}>
                      <button className="flex-1 text-left" onClick={() => { setChatLoading(true); setActiveChatId(c.id); setChatMenuOpen(false); }}>
                        <div className="text-[10px] uppercase text-text-tertiary mb-0.5">{c.type}</div>
                        <div className={`text-sm font-medium ${activeChatId===c.id ? 'text-text-primary' : 'text-text-secondary'}`}>{c.title}</div>
                      </button>
                      <button
                        className={`${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-150 text-text-tertiary hover:text-red-400`}
                        onClick={async (e) => { e.stopPropagation(); if (!confirm('Delete this chat?')) return; try { await api.deleteChat(projectId, c.id); setChats((prev)=>prev.filter(x=>x.id!==c.id)); if (activeChatId===c.id) setActiveChatId(chats.find(x=>x.id!==c.id)?.id || null); } catch {} }}
                        title="Delete chat"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                        <span className="sr-only">Delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {/* Chat view fills the sidebar */}
          <div className="relative flex-1 overflow-hidden border-t border-border-default flex flex-col">
            {activeChatId ? (
              <Chat
                key={activeChatId || 'none'}
                chatId={activeChatId}
                projectId={projectId}
                chatType={(chats.find(c => c.id === activeChatId)?.type) || 'plot'}
                onLoadingChange={(v) => setChatLoading(Boolean(v))}
              />
            ) : (
              <div className="flex-1 grid place-items-center text-xs text-text-tertiary">Open the chat menu to create or select a chat.</div>
            )}
            {/* loading overlay removed */}
          </div>
        </aside>
      )}

      {!rightOpen && (
        <button className="absolute right-2 top-14 z-10 px-2 py-2 rounded-md border border-border-default bg-bg-elevated text-text-secondary hover:text-accent hover:border-accent transition-all duration-150 flex items-center justify-center shadow-elevation" onClick={() => setRightOpen(true)} title="Open Chats">
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          <span className="sr-only">Open Chats</span>
        </button>
      )}

      {/* No modal: dropdown is anchored to header inside the sidebar */}

      {settingsOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-bg-elevated border border-border-default rounded-xl p-6 shadow-elevation">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text-primary">Project Settings</h3>
              <button onClick={() => setSettingsOpen(false)} className="text-text-tertiary hover:text-text-primary transition-colors duration-150">✕</button>
            </div>
            <div className="grid gap-3">
              <label className="grid gap-1 text-sm">
                <span className="text-xs text-text-tertiary">Title</span>
                <input
                  value={renameTitle}
                  onChange={(e) => setRenameTitle(e.target.value)}
                  className="bg-bg-primary border border-border-default rounded-md px-3 py-2 text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent transition-colors duration-150"
                />
              </label>
              {renameError && <div className="text-sm text-red-400 p-3 rounded-lg bg-red-950/20 border border-red-500/20">{renameError}</div>}
              <div className="flex items-center justify-end gap-2 mt-4">
                <button onClick={() => setSettingsOpen(false)} className="px-4 py-2 rounded-md border border-border-default text-text-secondary hover:bg-bg-hover transition-all duration-150">Cancel</button>
                <button
                  disabled={savingRename || !renameTitle.trim()}
                  onClick={async () => {
                    setSavingRename(true);
                    setRenameError(null);
                    try {
                      const updated = await api.updateProject(projectId, { title: renameTitle.trim() });
                      setProjectTitle(updated?.title || renameTitle.trim());
                      setSettingsOpen(false);
                    } catch (e: any) {
                      setRenameError(e?.message || 'Failed to save');
                    } finally {
                      setSavingRename(false);
                    }
                  }}
                  className="px-4 py-2 rounded-md bg-accent hover:bg-accent-hover disabled:opacity-50 text-white transition-all duration-150"
                >
                  {savingRename ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-200">
          <div className="px-4 py-3 rounded-lg bg-bg-elevated border border-border-default text-text-primary text-sm shadow-elevation">
            {toastMsg}
          </div>
        </div>
      )}
    </div>
  );
}
