"use client";

import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VariableSizeList as RWVariableSizeList } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useSupabase } from '@/components/providers/SupabaseProvider';
import { useTheme } from '@/components/providers/ThemeProvider';
import { createApi } from '@/lib/api';
import UnlockModal from './monetization/UnlockModal';
import { Lock } from 'lucide-react';

// Chapter shape based on backend response
type Chapter = {
  id: string;
  title: string;
  content: string;
  panelScript?: any | null;
};

export type ReaderMode = 'novel' | 'manhwa';

export type ReaderSettings = {
  fontSize: number;
  lineHeight: number;
  paragraphSpacing: number;
  contentWidth: 'narrow' | 'medium' | 'wide';
  contentPadding?: number;
  contentMargin?: number;
  paginate: boolean;
  fontFamily: 'sans' | 'serif' | 'dyslexia';
  letterSpacing: number;
  textAlign: 'left' | 'justify';
  firstLineIndent: number;
  hyphenate: boolean;
  localTheme: 'inherit' | 'light' | 'dark';
  preset: 'none' | 'sepia' | 'dim' | 'high';
  contrast: number;
  pageColor?: string;
};

export function ReaderView({
  projectId,
  mode,
  targetChapterId,
  onChapterInView,
  targetPanelIndex,
  targetScrollPercent,
  onProgress,
  readerSettings,
  branchId,
}: {
  projectId: string;
  mode: ReaderMode;
  targetChapterId?: string | null;
  onChapterInView?: (id: string) => void;
  targetPanelIndex?: number | null;
  targetScrollPercent?: number | null;
  onProgress?: (percent: number, meta?: { index: number; total: number; id?: string }) => void;
  readerSettings?: ReaderSettings;
  branchId?: string;
}) {
  const supabase = useSupabase();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const { isDark } = useTheme();
  const [unlockTarget, setUnlockTarget] = useState<{ id: string; price: number } | null>(null);

  // Paginated load of chapters
  useEffect(() => {
    let mounted = true;
    const api = createApi(supabase);
    async function loadFirst() {
      try {
        setLoading(true);
        setError(null);
        const { items, total } = await api.listChaptersPaginated(projectId, 0, 20, false, branchId);
        if (!mounted) return;
        setChapters(items as Chapter[]);
        setTotal(typeof total === 'number' ? total : null);
        setPage(1);
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Failed to load');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadFirst();
    return () => { mounted = false; };
  }, [projectId, supabase, branchId]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading) return;
    if (total !== null && chapters.length >= total) return;
    setLoadingMore(true);
    try {
      const api = createApi(supabase);
      const { items } = await api.listChaptersPaginated(projectId, page, 20, false, branchId);
      setChapters((prev) => [...prev, ...(items as Chapter[])]);
      setPage((p) => p + 1);
    } catch (e: any) {
      setError(e?.message || 'Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  }, [chapters.length, loading, loadingMore, page, projectId, supabase, total, branchId]);

  // Extract image URLs from panelScript in manhwa mode
  const images = useMemo(() => {
    if (mode !== 'manhwa') return [] as string[];
    const urls: string[] = [];
    for (const ch of chapters) {
      const panels = (ch.panelScript?.panels as any[]) || [];
      for (const p of panels) {
        if (typeof p?.imageUrl === 'string') urls.push(p.imageUrl);
      }
    }
    return urls;
  }, [chapters, mode]);

  // Prefetch images for offline cache via SW (simple <link rel="prefetch"> + Image objects)
  useEffect(() => {
    if (mode !== 'manhwa' || images.length === 0) return;
    images.slice(0, 10).forEach((src) => {
      try {
        const img = new Image();
        img.src = src;
      } catch { }
    });
  }, [images, mode]);

  const itemCount = useMemo(() => (mode === 'novel' ? chapters.length : images.length), [chapters.length, images.length, mode]);
  const chapterIdsSig = useMemo(() => (mode === 'novel' ? chapters.map(c => c.id).join(',') : ''), [chapters, mode]);
  const imageSig = useMemo(() => (mode === 'manhwa' ? images.join(',') : ''), [images, mode]);
  const listKey = useMemo(() => `${mode}-${itemCount}-${chapterIdsSig.length}-${imageSig.length}`, [mode, itemCount, chapterIdsSig.length, imageSig.length]);

  // Dynamic size map for VariableSizeList
  const listRef = useRef<any>(null);
  const outerRef = useRef<HTMLDivElement | null>(null);
  const sizeMap = useRef<Record<number, number>>({});
  const novelContainerRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const lastVisibleIdxRef = useRef(0);
  const getScrollPct = useCallback((el: HTMLElement | null) => {
    if (!el) return 0;
    const max = Math.max(1, el.scrollHeight - el.clientHeight);
    const pct = (el.scrollTop / max) * 100;
    return Math.max(0, Math.min(100, pct));
  }, []);
  const setSize = useCallback((index: number, size: number) => {
    if (sizeMap.current[index] !== size) {
      sizeMap.current[index] = size;
      listRef.current?.resetAfterIndex(index, true);
    }
  }, []);
  const getSize = useCallback((index: number) => sizeMap.current[index] || (mode === 'novel' ? 260 : 700), [mode]);

  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    // Use a measuring wrapper to compute actual height
    const wrapperRef = (el: HTMLDivElement | null) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // Include vertical paddings/margins as needed
      const height = Math.ceil(rect.height);
      setSize(index, height);
    };

    if (mode === 'novel') {
      const ch = chapters[index];
      if (ch.content === 'LOCKED_CONTENT' && (ch as any).price > 0) {
        return (
          <div style={style}>
            <div ref={wrapperRef}>
               <h3 className="px-4 pt-6 text-xl font-semibold mb-2">{ch?.title}</h3>
               <LockedChapterPlaceholder price={(ch as any).price} onUnlock={() => setUnlockTarget({ id: ch.id, price: (ch as any).price })} />
            </div>
          </div>
        );
      }
      return (
        <div style={style}>
          <div ref={wrapperRef} className="px-4 py-6">
            <h3 className="text-xl font-semibold mb-2">{ch?.title}</h3>
            <p className="whitespace-pre-wrap leading-7 text-slate-200">{ch?.content}</p>
          </div>
        </div>
      );
    } else {
      // For Manhwa, we might have multiple images per chapter. 
      // How do we handle locked chapters here? 
      // Since 'images' array is derived from chapters, if a chapter is locked, its images won't be in the list?
      // Wait, 'images' is a flat list of URL strings.
      // If a chapter is locked, the API sends content="LOCKED_CONTENT" and panelScript=null.
      // So 'images' list will be empty for that chapter.
      // We need a way to insert a 'Locked' item into the list.

      // Quick Fix: For Manhwa, ReaderView structure assumes a flat list of images.
      // If we want to support locking, we really need to render 'Chapters' not just 'Images'.
      // But currently Manhwa mode flattens everything.
      
      const src = images[index];
      const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        const natural = img.naturalHeight;
        const scaled = img.getBoundingClientRect().height || natural;
        setSize(index, Math.ceil(scaled) + 16); // padding
      };
      return (
        <div style={style}>
          <div ref={wrapperRef} className="px-2 py-2 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="panel" className="max-w-full h-auto rounded-md shadow-md" loading="lazy" onLoad={onImgLoad} />
          </div>
        </div>
      );
    }
  }, [chapters, images, mode, setSize]);

  const onItemsRendered = useCallback((info: any) => {
    if (mode !== 'manhwa') return;
    const { visibleStartIndex, visibleStopIndex } = info || {};
    if (typeof visibleStopIndex === 'number' && itemCount && visibleStopIndex >= itemCount - 3) {
      void loadMore();
    }
    if (typeof visibleStartIndex === 'number' && images.length > 0) {
      const totalPanels = images.length;
      const idx = Math.max(0, Math.min(visibleStartIndex, totalPanels - 1));
      lastVisibleIdxRef.current = idx;
      const pct = Math.round(((idx + 1) / Math.max(totalPanels, 1)) * 100);
      onProgress?.(pct, { index: idx, total: totalPanels });
    }
  }, [images.length, itemCount, loadMore, mode, onProgress]);

  const itemKey = useCallback(
    (index: number) => (mode === 'novel' ? (chapters[index]?.id || `ch-${index}`) : (images[index] || `img-${index}`)),
    [chapters, images, mode]
  );

  // Reset cached sizes when mode or content signatures change
  useEffect(() => {
    sizeMap.current = {};
    listRef.current?.resetAfterIndex(0, true);
  }, [mode, itemCount, chapterIdsSig, imageSig]);

  // Reset on window resize to recompute dynamic heights
  useEffect(() => {
    const onResize = () => listRef.current?.resetAfterIndex(0, true);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Handle external navigation target (novel mode): ensure present then scroll into view
  useEffect(() => {
    if (mode !== 'novel') return;
    if (!targetChapterId) return;
    let cancelled = false;
    (async () => {
      const api = createApi(supabase);
      // Ensure the chapter is loaded
      let has = chapters.some((c) => c.id === targetChapterId);
      let nextPage = page;
      while (!has && (total === null || chapters.length < total)) {
        try {
          const { items } = await api.listChaptersPaginated(projectId, nextPage, 20, false, branchId);
          if (cancelled) return;
          if (!items || (items as any[]).length === 0) break;
          setChapters((prev) => {
            const appended = [...prev, ...(items as any)];
            has = appended.some((c) => c.id === targetChapterId);
            return appended;
          });
          nextPage += 1;
          setPage(nextPage);
        } catch {
          break;
        }
        if (has) break;
      }
      // Defer scroll to allow refs to mount
      requestAnimationFrame(() => {
        if (cancelled) return;
        const el = sectionRefs.current[targetChapterId!];
        if (el) {
          try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch { }
        }
      });
    })();
    return () => { cancelled = true; };
  }, [mode, targetChapterId, chapters, page, projectId, supabase, total, branchId]);

  // Handle external navigation target for manhwa (panel index)
  useEffect(() => {
    if (mode !== 'manhwa') return;
    if (typeof targetPanelIndex !== 'number' || targetPanelIndex < 0) return;
    try {
      listRef.current?.scrollToItem?.(targetPanelIndex, 'start');
    } catch { }
  }, [mode, targetPanelIndex]);

  // External scroll by percentage for novel mode
  useEffect(() => {
    if (mode !== 'novel') return;
    if (typeof targetScrollPercent !== 'number') return;
    if (!chapters.length) return;
    const el = novelContainerRef.current;
    if (!el) return;
    const pct = Math.max(0, Math.min(100, targetScrollPercent));
    // Ensure layout is ready before scrolling
    requestAnimationFrame(() => {
      const max = Math.max(1, el.scrollHeight - el.clientHeight);
      const top = (pct / 100) * max;
      try { (el as any).scrollTo({ top, behavior: 'smooth' }); } catch { el.scrollTop = top; }
    });
  }, [mode, targetScrollPercent, chapters.length]);

  // External scroll by percentage for manhwa mode
  useEffect(() => {
    if (mode !== 'manhwa') return;
    if (typeof targetScrollPercent !== 'number') return;
    const pct = Math.max(0, Math.min(100, targetScrollPercent));
    const totalPanels = images.length;
    if (!totalPanels) return;
    requestAnimationFrame(() => {
      try {
        const idx = Math.round((pct / 100) * Math.max(0, totalPanels - 1));
        listRef.current?.scrollToItem?.(idx, 'start');
      } catch { }
      // Fallback: direct scroll on outerRef
      const el = outerRef.current;
      if (el) {
        const max = Math.max(1, el.scrollHeight - el.clientHeight);
        const top = (pct / 100) * max;
        try { (el as any).scrollTo({ top, behavior: 'smooth' }); } catch { el.scrollTop = top; }
      }
    });
  }, [mode, targetScrollPercent, images.length]);

  // Initial progress callbacks when content loads
  useEffect(() => {
    if (mode === 'novel' && chapters.length) {
      const firstId = chapters[0].id;
      onChapterInView?.(firstId);
      const tot = total ?? chapters.length;
      const pct = Math.round(getScrollPct(novelContainerRef.current!));
      onProgress?.(pct, { index: 0, total: tot, id: firstId });
    } else if (mode === 'manhwa' && images.length) {
      const pct = Math.round(getScrollPct(outerRef.current!));
      onProgress?.(pct, { index: 0, total: images.length });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, chapterIdsSig, imageSig, total]);

  // Observe scroll container size changes (e.g., layout panels opening) and reset
  useEffect(() => {
    if (!outerRef.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      listRef.current?.resetAfterIndex(0, true);
    });
    ro.observe(outerRef.current);
    return () => ro.disconnect();
  }, [outerRef]);

  // Manhwa: report progress on scroll position precisely
  useEffect(() => {
    if (mode !== 'manhwa') return;
    const el = outerRef.current;
    if (!el) return;
    const onScroll = () => {
      const pct = Math.round(getScrollPct(el));
      onProgress?.(pct, { index: lastVisibleIdxRef.current, total: images.length });
    };
    el.addEventListener('scroll', onScroll, { passive: true } as any);
    // emit once
    onScroll();
    return () => {
      el.removeEventListener('scroll', onScroll as any);
    };
  }, [mode, getScrollPct, images.length, onProgress]);

  if (loading) return <div className="p-4 text-text-secondary">Loading…</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  // Novel mode: simple vertical stack to avoid any absolute positioning overlaps
  if (mode === 'novel') {
    const s = readerSettings;
    const maxWidth = s?.contentWidth === 'narrow' ? '40rem' : s?.contentWidth === 'medium' ? '48rem' : '64rem';
    const fontFamily = s?.fontFamily === 'serif' ? 'ui-serif, Georgia, serif' : s?.fontFamily === 'dyslexia' ? 'OpenDyslexic, Lexend, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif' : 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
    const deriveColors = () => {
      // Base colors
      let bg = undefined as string | undefined;
      let fg = undefined as string | undefined;
      if (s?.localTheme === 'light') { bg = '#ffffff'; fg = '#0f172a'; }
      else if (s?.localTheme === 'dark') { bg = '#0F1117'; fg = '#ffffff'; }
      else if (s?.localTheme === 'inherit') {
        if (isDark) { bg = '#0F1117'; fg = '#ffffff'; }
        else { bg = '#ffffff'; fg = '#0f172a'; }
      }
      if (s?.preset === 'sepia') { bg = '#FDF6E3'; fg = '#3F3A2C'; }
      if (s?.preset === 'dim') { bg = '#111827'; fg = '#E5E7EB'; }
      if (s?.preset === 'high') { bg = '#ffffff'; fg = '#000000'; }
      if (s?.pageColor) bg = s.pageColor;
      return { bg, fg };
    };
    const colors = deriveColors();
    const containerStyle: React.CSSProperties = {
      backgroundColor: colors.bg,
      color: colors.fg,
      filter: s ? `contrast(${s.contrast}%)` : undefined,
      fontFamily,
      hyphens: s?.hyphenate ? 'auto' as any : 'manual',
      WebkitHyphens: s?.hyphenate ? 'auto' as any : 'manual',
      wordBreak: s?.hyphenate ? 'auto-phrase' as any : 'normal',
      scrollSnapType: s?.paginate ? ('y mandatory' as any) : undefined,
    };
    const contentStyle: React.CSSProperties = {
      maxWidth,
      paddingLeft: typeof s?.contentPadding === 'number' ? s.contentPadding : undefined,
      paddingRight: typeof s?.contentPadding === 'number' ? s.contentPadding : undefined,
      marginLeft: typeof s?.contentMargin === 'number' ? s.contentMargin : undefined,
      marginRight: typeof s?.contentMargin === 'number' ? s.contentMargin : undefined,
    };
    const pStyle: React.CSSProperties = s ? {
      fontSize: `${s.fontSize}px`,
      lineHeight: s.lineHeight,
      letterSpacing: `${s.letterSpacing}px`,
      textAlign: s.textAlign,
      textIndent: `${s.firstLineIndent}px`,
      marginBottom: `${s.paragraphSpacing}px`,
    } : {};
    const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
        void loadMore();
      }
      // determine active chapter in view
      try {
        const rectTop = (node: HTMLElement) => {
          const r = node.getBoundingClientRect();
          const root = el.getBoundingClientRect();
          return r.top - root.top;
        };
        let bestId: string | null = null;
        let bestTop = Number.POSITIVE_INFINITY;
        for (const ch of chapters) {
          const sec = sectionRefs.current[ch.id];
          if (!sec) continue;
          const top = rectTop(sec);
          if (top >= -40 && top < bestTop) { bestTop = top; bestId = ch.id; }
        }
        if (!bestId && chapters.length) bestId = chapters[0].id;
        if (bestId) {
          onChapterInView?.(bestId);
          const idx = chapters.findIndex((c) => c.id === bestId);
          const tot = total ?? chapters.length;
          const pct = Math.round(getScrollPct(el));
          onProgress?.(pct, { index: Math.max(0, idx), total: Math.max(1, tot), id: bestId });
        }
      } catch { }
    };
    return (
      <div ref={novelContainerRef} className="w-full h-full overflow-y-auto bg-bg-primary text-text-primary" role="feed" onScroll={onScroll} style={containerStyle}>
        <div className="mx-auto max-w-3xl flex flex-col gap-12 px-4 py-6" style={contentStyle}>
          {chapters.map((ch) => (
            <section
              key={ch.id}
              ref={(el) => { sectionRefs.current[ch.id] = el; }}
              className="border-t border-border-default pt-8"
              style={s?.paginate ? ({ scrollSnapAlign: 'start' } as any) : undefined}
            >
              <h3 className="text-xl font-semibold mb-3 text-text-primary">{ch.title}</h3>
              <div className="text-text-primary">
                {String(ch?.content || '')
                  .split(/\r?\n\r?\n+/)
                  .filter((p) => p.trim() !== '')
                  .map((para: string, idx: number) => (
                    <p key={idx} className="leading-relaxed whitespace-pre-wrap" style={pStyle}>
                      {para}
                    </p>
                  ))}
              </div>
            </section>
          ))}
          {loadingMore && <div className="text-sm text-text-secondary">Loading more…</div>}
        </div>
      </div>
    );
  }

  // Manhwa mode: keep virtualization for performance
  const s = readerSettings;
  const manhwaColors = (() => {
    if (!s) return {} as any;
    let bg: string | undefined;
    if (s.localTheme === 'light') bg = '#ffffff';
    else if (s.localTheme === 'dark') bg = '#0F1117';
    else if (s.localTheme === 'inherit') {
      bg = isDark ? '#0F1117' : '#ffffff';
    }
    if (s.preset === 'sepia') bg = '#FDF6E3';
    if (s.preset === 'dim') bg = '#111827';
    if (s.preset === 'high') bg = '#ffffff';
    if (s.pageColor) bg = s.pageColor;
    return { bg };
  })();
  return (
    <div className="w-full h-full overflow-hidden" role="feed" style={{ backgroundColor: manhwaColors.bg, filter: s ? `contrast(${s.contrast}%)` : undefined }}>
      <div className="h-full">
        <AutoSizer>
          {({ height, width }: { height: number; width: number }) => (
            <RWVariableSizeList
              key={listKey}
              ref={listRef as any}
              height={height}
              width={width}
              itemCount={itemCount}
              itemSize={getSize}
              estimatedItemSize={700}
              onItemsRendered={onItemsRendered}
              outerRef={outerRef as any}
              itemKey={itemKey}
            >
              {Row as any}
            </RWVariableSizeList>
          )}
        </AutoSizer>
      </div>
      {/* Unlock Dialog */}
      {unlockTarget && (
        <UnlockModal
          chapterId={unlockTarget.id}
          cost={unlockTarget.price}
          onUnlock={() => {
            setUnlockTarget(null);
            // Reload to get unmasked content
            window.location.reload(); 
          }}
          onCancel={() => setUnlockTarget(null)}
        />
      )}
    </div>
  );
}

// Helper to render locked state
function LockedChapterPlaceholder({ price, onUnlock }: { price: number; onUnlock: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 bg-slate-900/50 rounded-xl border border-slate-700/50 mx-4 my-8">
      <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 text-cyan-400">
        <Lock size={32} />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">Premium Chapter</h3>
      <p className="text-slate-400 text-center max-w-md mb-6">
        This chapter is locked. Support the author to continue reading.
      </p>
      <button
        onClick={onUnlock}
        className="px-6 py-3 bg-cyan-400 hover:bg-cyan-300 text-black font-bold rounded-lg flex items-center gap-2 transition"
      >
        <Lock size={16} /> Unlock for {price} Coins
      </button>
    </div>
  );
}


