"use client";

import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VariableSizeList as RWVariableSizeList } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useSupabase } from '@/components/providers/SupabaseProvider';
import { createApi } from '@/lib/api';

// Chapter shape based on backend response
type Chapter = {
  id: string;
  title: string;
  content: string;
  panelScript?: any | null;
};

export type ReaderMode = 'novel' | 'manhwa';

export function ReaderView({
  projectId,
  mode,
}: {
  projectId: string;
  mode: ReaderMode;
}) {
  const supabase = useSupabase();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState<number | null>(null);

  // Paginated load of chapters
  useEffect(() => {
    let mounted = true;
    const api = createApi(supabase);
    async function loadFirst() {
      try {
        setLoading(true);
        setError(null);
        const { items, total } = await api.listChaptersPaginated(projectId, 0, 20);
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
  }, [projectId, supabase]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading) return;
    if (total !== null && chapters.length >= total) return;
    setLoadingMore(true);
    try {
      const api = createApi(supabase);
      const { items } = await api.listChaptersPaginated(projectId, page, 20);
      setChapters((prev) => [...prev, ...(items as Chapter[])]);
      setPage((p) => p + 1);
    } catch (e: any) {
      setError(e?.message || 'Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  }, [chapters.length, loading, loadingMore, page, projectId, supabase, total]);

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
      } catch {}
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
      return (
        <div style={style}>
          <div ref={wrapperRef} className="px-4 py-6">
            <h3 className="text-xl font-semibold mb-2">{ch?.title}</h3>
            <p className="whitespace-pre-wrap leading-7 text-slate-200">{ch?.content}</p>
          </div>
        </div>
      );
    } else {
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
    const { visibleStopIndex } = info || {};
    if (typeof visibleStopIndex === 'number' && itemCount && visibleStopIndex >= itemCount - 3) {
      void loadMore();
    }
  }, [itemCount, loadMore, mode]);

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

  // Observe scroll container size changes (e.g., layout panels opening) and reset
  useEffect(() => {
    if (!outerRef.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      listRef.current?.resetAfterIndex(0, true);
    });
    ro.observe(outerRef.current);
    return () => ro.disconnect();
  }, [outerRef]);

  if (loading) return <div className="p-4 text-slate-400">Loading…</div>;
  if (error) return <div className="p-4 text-red-400">{error}</div>;

  // Novel mode: simple vertical stack to avoid any absolute positioning overlaps
  if (mode === 'novel') {
    const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
        void loadMore();
      }
    };
    return (
      <div className="w-full h-full overflow-y-auto" role="feed" onScroll={onScroll}>
        <div className="mx-auto max-w-3xl flex flex-col gap-12 px-4 py-6">
          {chapters.map((ch) => (
            <section key={ch.id} className="border-t border-cyan-500/30 pt-8">
              <h3 className="text-xl font-semibold mb-3">{ch.title}</h3>
              <p className="leading-relaxed text-gray-300 whitespace-pre-wrap">{ch.content}</p>
            </section>
          ))}
          {loadingMore && <div className="text-sm text-slate-400">Loading more…</div>}
        </div>
      </div>
    );
  }

  // Manhwa mode: keep virtualization for performance
  return (
    <div className="w-full h-full overflow-hidden" role="feed">
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
    </div>
  );
}
