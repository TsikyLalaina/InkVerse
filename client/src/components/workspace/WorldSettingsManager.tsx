"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { createApi } from "@/lib/api";
import { Loader2, Plus, Search, Trash2, Upload, X } from "lucide-react";

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type WorldItem = {
  id?: string;
  name: string;
  summary?: string | null;
  traits?: any | null;
  images?: string[] | null;
  createdAt?: string;
  updatedAt?: string;
};

function parseSupabasePublicUrl(url: string): { bucket: string; path: string } | null {
  try {
    const idx = url.indexOf('/storage/v1/object/public/');
    if (idx === -1) return null;
    const rest = url.slice(idx + '/storage/v1/object/public/'.length);
    const firstSlash = rest.indexOf('/');
    if (firstSlash === -1) return null;
    const bucket = rest.slice(0, firstSlash);
    const path = rest.slice(firstSlash + 1);
    if (!bucket || !path) return null;
    return { bucket, path };
  } catch {
    return null;
  }
}

export function WorldSettingsManager({ projectId }: { projectId: string }) {
  const supabase = useSupabase();
  const api = useMemo(() => createApi(supabase), [supabase]);

  const [items, setItems] = useState<WorldItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [activeId, setActiveId] = useState<string | "__new__" | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState<WorldItem>({ name: "" });
  const [traits, setTraits] = useState<any>({});
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle'|'uploading'|'uploaded'|'error'>('idle');
  const dropRef = useRef<HTMLDivElement | null>(null);

  const cacheKey = useMemo(() => `inkverse_project_${projectId}_world`, [projectId]);
  const activeKey = useMemo(() => `inkverse_project_${projectId}_world_active`, [projectId]);
  const [hasCache, setHasCache] = useState(false);
  const itemsRef = useRef<WorldItem[]>(items);

  useEffect(() => {
    try {
      const s = typeof window !== 'undefined' ? window.localStorage.getItem(cacheKey) : null;
      if (s) {
        const arr = JSON.parse(s);
        if (Array.isArray(arr)) {
          setItems(arr as WorldItem[]);
          const valid = (arr as any[]).length > 0;
          setHasCache(valid);
          if (valid) setLoading(false);
        }
      }
    } catch {}
  }, [cacheKey]);

  const notify = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(""), 2500);
  };

  const onUploadFiles = useCallback(async (files: File[]) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadStatus('uploading');
    const startImages = (form.images || []) as string[];
    const newUrls: string[] = [];
    try {
      const bucket = process.env.NEXT_PUBLIC_SUPABASE_WORLD_BUCKET
        || process.env.NEXT_PUBLIC_SUPABASE_IMAGE_BUCKET
        || process.env.NEXT_PUBLIC_SUPABASE_BUCKET
        || "world-images";
      for (const file of files) {
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `${projectId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        try { console.debug('Supabase world upload start', { bucket, path, file: { name: file.name, type: file.type, size: file.size } }); } catch {}
        const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        const url = data.publicUrl;
        newUrls.push(url);
        setForm((f) => ({ ...f, images: [ ...(f.images || []), url ] }));
        try { console.debug('Supabase world upload done', { url }); } catch {}
      }

      const nextImages = [...startImages, ...newUrls];
      if (activeId === "__new__") {
        try {
          const name = (form.name && form.name.trim()) || 'Untitled World';
          const payload = { name, summary: form.summary || undefined, traits, images: nextImages } as any;
          try { console.debug('Auto-creating world after batch upload', { name, imagesCount: nextImages.length }); } catch {}
          const created = await api.createWorldSetting(projectId, payload);
          setItems((prev) => [...prev, created]);
          setActiveId(created.id);
          try { console.debug('Auto-created world', { id: created.id }); } catch {}
        } catch (e: any) {
          notify(e?.message || 'Failed to create world entry');
          try { console.error('Auto-create world failed', e); } catch {}
        }
      } else if (activeId) {
        try {
          try { console.debug('Persisting world images (batch)', { wsId: activeId, count: nextImages.length }); } catch {}
          const res = await api.updateWorldSetting(projectId, activeId, { images: nextImages });
          setItems((prev) => prev.map((x) => (x.id === res.id ? res : x)));
          try { console.debug('Persisted world images ok', { id: res.id }); } catch {}
        } catch (e: any) {
          notify(e?.message || 'Failed to persist images');
          try { console.error('Persisting world images failed', e); } catch {}
        }
      }
      notify('Image(s) uploaded');
      setUploadStatus('uploaded');
      setTimeout(() => { try { setUploadStatus('idle'); } catch {} }, 2000);
    } catch (e: any) {
      notify(e?.message || 'Upload failed');
      try { console.error('World upload failed', e); } catch {}
      setUploadStatus('error');
    } finally {
      setUploading(false);
    }
  }, [projectId, supabase, activeId, api, form, traits]);

  // Drag & drop handlers
  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length) { (async () => { await onUploadFiles(files as File[]); })(); }
      el.classList.remove("ring-2", "ring-blue-500");
    };
    const onDrag = (e: DragEvent) => {
      e.preventDefault();
      el.classList.add("ring-2", "ring-blue-500");
    };
    const onLeave = (e: DragEvent) => {
      e.preventDefault();
      el.classList.remove("ring-2", "ring-blue-500");
    };
    el.addEventListener("drop", onDrop as any);
    el.addEventListener("dragover", onDrag as any);
    el.addEventListener("dragleave", onLeave as any);
    return () => {
      el.removeEventListener("drop", onDrop as any);
      el.removeEventListener("dragover", onDrag as any);
      el.removeEventListener("dragleave", onLeave as any);
    };
  }, [onUploadFiles]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (hasCache) { return; }
      try {
        if (!hasCache) setLoading(true);
        const res = await api.listWorldSettings(projectId);
        if (!mounted) return;
        const next = res || [];
        try {
          if (hasCache && JSON.stringify(next) === JSON.stringify(itemsRef.current)) {
            return;
          }
        } catch {}
        setItems(next);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load world settings");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [api, projectId, hasCache]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(cacheKey, JSON.stringify(items));
    } catch {}
  }, [items, cacheKey]);

  useEffect(() => { itemsRef.current = items; }, [items]);

  // Restore/persist last active selection
  useEffect(() => {
    try {
      const v = typeof window !== 'undefined' ? window.localStorage.getItem(activeKey) : null;
      if (v) setActiveId(v as any);
    } catch {}
  }, [activeKey]);
  useEffect(() => {
    try {
      if (activeId && typeof window !== 'undefined') window.localStorage.setItem(activeKey, activeId);
    } catch {}
  }, [activeId, activeKey]);

  // Reflect chat-driven upserts instantly
  useEffect(() => {
    function onUpsert(ev: Event) {
      const ce = ev as CustomEvent;
      const item = ce?.detail?.item as any;
      if (!item || !item.id) return;
      setItems((prev) => {
        const idx = prev.findIndex((x) => x.id === item.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...item } as any;
          return next;
        }
        return [...prev, item];
      });
      if (activeId === item.id) {
        setForm({ id: item.id, name: item.name, summary: item.summary || "", traits: item.traits || null, images: (item as any).images || [] });
        setTraits(item.traits || {});
      }
      notify('World entry updated via chat');
    }
    window.addEventListener('workspace:world-upsert', onUpsert as any);
    return () => window.removeEventListener('workspace:world-upsert', onUpsert as any);
  }, [activeId]);

  useEffect(() => {
    if (!activeId) return;
    if (activeId === "__new__") {
      setForm({ name: "", images: [] });
      setTraits({});
      return;
    }
    const it = items.find((x) => x.id === activeId);
    if (!it) return;
    setForm({ id: it.id, name: it.name, summary: it.summary || "", traits: it.traits || null, images: (it as any).images || [] });
    setTraits(it.traits || {});
  }, [activeId, items]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter((x) => (x.name || "").toLowerCase().includes(q));
  }, [items, filter]);

  // notify moved earlier so it's available to uploads

  const onNew = () => {
    setActiveId("__new__");
    setForm({ name: "", images: [] });
    setTraits({});
  };

  // Traits helpers
  const clone = (o: any) => JSON.parse(JSON.stringify(o ?? {}));
  const setVal = (path: Array<string|number>, val: any) => {
    setTraits((curr: any) => {
      const nxt = clone(curr);
      let ref: any = nxt;
      for (let i = 0; i < path.length - 1; i++) ref = ref[path[i]];
      ref[path[path.length - 1]] = val;
      return nxt;
    });
  };
  const delKey = (pathToParent: Array<string|number>, key: string|number) => {
    setTraits((curr: any) => {
      const nxt = clone(curr);
      let ref: any = nxt;
      for (let i = 0; i < pathToParent.length; i++) ref = ref[pathToParent[i]];
      if (Array.isArray(ref) && typeof key === 'number') ref.splice(key, 1);
      else if (ref && typeof ref === 'object') delete ref[key as any];
      return nxt;
    });
  };
  const renameKey = (pathToParent: Array<string|number>, oldKey: string, newKey: string) => {
    if (!newKey) return;
    setTraits((curr: any) => {
      const nxt = clone(curr);
      let ref: any = nxt;
      for (let i = 0; i < pathToParent.length; i++) ref = ref[pathToParent[i]];
      if (!ref || typeof ref !== 'object' || Array.isArray(ref)) return nxt;
      if (oldKey === newKey) return nxt;
      const val = ref[oldKey];
      delete ref[oldKey];
      ref[newKey] = val;
      return nxt;
    });
  };
  const addChild = (pathToObj: Array<string|number>, depth: number) => {
    if (depth >= 5) return;
    setTraits((curr: any) => {
      const nxt = clone(curr);
      let ref: any = nxt;
      for (let i = 0; i < pathToObj.length; i++) ref = ref[pathToObj[i]];
      if (!ref || typeof ref !== 'object' || Array.isArray(ref)) return nxt;
      let base = 'key'; let i2 = 1; let key = base;
      while (Object.prototype.hasOwnProperty.call(ref, key)) { key = `${base}-${i2++}`; }
      ref[key] = "";
      return nxt;
    });
  };
  const addRootKey = () => {
    setTraits((curr: any) => {
      const nxt = clone(curr);
      let base = 'key'; let i = 1; let k = base;
      while (Object.prototype.hasOwnProperty.call(nxt, k)) { k = `${base}-${i++}`; }
      (nxt as any)[k] = "";
      return nxt;
    });
  };
  const convertType = (path: Array<string|number>, parentPath: Array<string|number>, key: string, nextType: 'string'|'object'|'array', depth: number) => {
    setTraits((curr: any) => {
      const nxt = clone(curr);
      let ref: any = nxt;
      for (let i = 0; i < parentPath.length; i++) ref = ref[parentPath[i]];
      if (!ref || typeof ref !== 'object' || Array.isArray(ref)) return nxt;
      if (nextType === 'string') ref[key] = "";
      else if (nextType === 'object') ref[key] = depth >= 5 ? "" : {};
      else if (nextType === 'array') ref[key] = [] as string[];
      return nxt;
    });
  };
  const addArrayItem = (pathToArr: Array<string|number>) => {
    setTraits((curr: any) => {
      const nxt = clone(curr);
      let ref: any = nxt;
      for (let i = 0; i < pathToArr.length; i++) ref = ref[pathToArr[i]];
      if (Array.isArray(ref)) ref.push("");
      return nxt;
    });
  };

  (TraitObject as any)._parent = {
    setVal, delKey, renameKey, addChild, convertType, addArrayItem,
  } as TraitCtx;

  const onSave = async () => {
    if (!form.name.trim()) {
      notify("Name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), summary: form.summary || undefined, traits, images: form.images || [] };
      if (activeId === "__new__") {
        const res = await api.createWorldSetting(projectId, payload);
        setItems((prev) => [...prev, res]);
        setActiveId(res.id);
      } else if (activeId) {
        const res = await api.updateWorldSetting(projectId, activeId, payload);
        setItems((prev) => prev.map((x) => (x.id === res.id ? res : x)));
      }
      notify("Saved");
    } catch (e: any) {
      notify(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!activeId || activeId === "__new__") return;
    // eslint-disable-next-line no-alert
    if (!confirm("Delete this world entry?")) return;
    setDeleting(true);
    try {
      await api.deleteWorldSetting(projectId, activeId);
      setItems((prev) => prev.filter((x) => x.id !== activeId));
      setActiveId(null);
      setForm({ name: "", images: [] });
      setTraits({});
      notify("Deleted");
    } catch (e: any) {
      notify(e?.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const count = items.length;

  return (
    <div className="h-full grid grid-rows-[auto_1fr]">
      <div className="border-b border-border-default px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-base font-semibold text-text-primary">World Settings</div>
          <div className="text-xs px-2 py-1 rounded-md border border-border-default text-text-secondary">{count} Items</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onNew} className="rounded-lg bg-bg-elevated border border-border-default hover:border-accent hover:bg-bg-hover text-text-secondary hover:text-text-primary text-sm px-4 py-3 inline-flex items-center justify-center gap-2 transition-all duration-150 hover:-translate-y-0.5">
            <Plus className="w-4 h-4" />
            New Entry
          </button>
        </div>
      </div>

      <div className="min-h-0 grid" style={{ gridTemplateColumns: "35% 65%" }}>
        <aside className="border-r border-border-default min-h-0 flex flex-col">
          <div className="p-3">
            <div className="relative">
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search world settings" className="w-full bg-bg-primary border border-border-default rounded-md pl-9 pr-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent" />
              <Search className="w-4 h-4 absolute left-3 top-3 text-text-tertiary" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {loading && <div className="text-xs text-text-secondary px-2 py-2">Loading…</div>}
            {error && <div className="text-xs text-red-400 px-2 py-2 bg-red-950/20 rounded-md border border-red-500/20">{error}</div>}
            {!loading && !filtered.length && (
              <div className="mt-10 text-center text-text-tertiary text-sm">No world settings yet. Create your first entry!</div>
            )}
            {filtered.map((w) => (
              <button key={w.id} onClick={() => setActiveId(w.id!)} className={classNames("w-full text-left px-3 py-3 rounded-md mb-2 transition-all", activeId===w.id ? "border-l-2 border-blue-500 bg-bg-elevated" : "hover:bg-bg-hover") }>
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-primary truncate">{w.name}</div>
                    <div className="text-xs text-text-tertiary truncate">{w.summary || ""}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto p-6" aria-label="World details">
          {activeId ? (
            <div className="max-w-2xl mx-auto">
              <div className="grid gap-4">
                <div ref={dropRef} className="flex flex-col items-start mb-2 p-3 rounded-xl border border-border-default bg-bg-elevated w-full">
                  <div className="text-xs text-text-tertiary mb-2">World Images</div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="px-3 py-2 rounded-md border border-border-default bg-bg-primary text-text-secondary hover:text-text-primary inline-flex items-center gap-2 cursor-pointer">
                      <Upload className="w-4 h-4" />
                      Upload Image
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const files = Array.from(e.target.files || []); if (files.length) { (async () => { await onUploadFiles(files as File[]); })(); } }} />
                    </label>
                    {uploading && <div className="text-xs text-text-tertiary inline-flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Uploading…</div>}
                    {uploadStatus === 'uploaded' && !uploading && <div className="text-xs text-green-400">Uploaded</div>}
                    {uploadStatus === 'error' && !uploading && <div className="text-xs text-red-400">Upload failed</div>}
                  </div>
                  <div className="flex gap-2 overflow-x-auto w-full pb-1">
                    {(form.images || []).map((url, idx) => (
                      <div key={idx} className="relative border border-border-default rounded-md overflow-hidden bg-bg-primary flex-none w-24 h-24">
                        <img src={url} alt="world" className="w-full h-full object-cover" />
                        <button
                          className="absolute top-1 right-1 bg-black/60 text-white rounded p-1"
                          title="Remove"
                          onClick={async () => {
                            const removedUrl = (form.images || [])[idx];
                            const nextImages: string[] = (form.images || []).filter((_,i)=>i!==idx);
                            setForm((f)=> ({ ...f, images: nextImages }));
                            if (activeId && activeId !== "__new__") {
                              try {
                                const res = await api.updateWorldSetting(projectId, activeId, { images: nextImages });
                                setItems((prev) => prev.map((x) => (x.id === res.id ? res : x)));
                                notify('Image removed');
                                try {
                                  const parsed = removedUrl ? parseSupabasePublicUrl(removedUrl) : null;
                                  if (parsed) { await supabase.storage.from(parsed.bucket).remove([parsed.path]); }
                                } catch {}
                              } catch (e: any) {
                                notify(e?.message || 'Failed to persist removal');
                              }
                            }
                          }}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {!(form.images || []).length && (
                      <div className="text-xs text-text-tertiary">No images yet. Upload or drop here.</div>
                    )}
                  </div>
                </div>
                <label className="grid gap-2 text-sm">
                  <span className="text-xs text-text-tertiary uppercase tracking-wide">Name</span>
                  <input value={form.name} onChange={(e)=>setForm((f)=>({ ...f, name: e.target.value }))} className="w-full bg-bg-primary border border-border-default rounded-md px-4 py-2.5 text-text-primary outline-none focus:border-accent" />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="text-xs text-text-tertiary uppercase tracking-wide">Summary</span>
                  <textarea value={form.summary || ""} onChange={(e)=>setForm((f)=>({ ...f, summary: e.target.value }))} rows={5} className="w-full bg-bg-primary border border-border-default rounded-md px-4 py-2.5 text-text-primary outline-none focus:border-accent text-sm" />
                  <span className="text-[11px] text-text-tertiary">{(form.summary || "").length} characters</span>
                </label>

                <div className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-tertiary uppercase tracking-wide">Traits</span>
                    <button onClick={addRootKey} className="px-2 py-1 rounded-md border border-border-default text-text-secondary hover:text-text-primary text-xs inline-flex items-center gap-1"><Plus className="w-3 h-3" /> Add key</button>
                  </div>
                  <div className="mt-1">
                    {Object.keys(traits || {}).length === 0 && (
                      <div className="text-xs text-text-tertiary">No traits yet. Add a key.</div>
                    )}
                    <TraitObject obj={traits} path={[]} depth={1} />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4">
                  <button onClick={onDelete} disabled={!activeId || activeId==="__new__" || deleting} className="text-red-400 hover:text-red-300 inline-flex items-center gap-2 text-sm">
                    <Trash2 className="w-4 h-4" />
                    Delete Entry
                  </button>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setActiveId(null); }} className="px-4 py-2 rounded-md border border-border-default text-text-secondary hover:bg-bg-hover">Cancel</button>
                    <button onClick={onSave} disabled={saving} className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white">
                      {saving ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Saving…</span> : "Save Entry"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-text-tertiary">Select a world entry or create a new one.</div>
          )}
        </section>
      </div>

      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <div className="px-4 py-3 rounded-lg bg-bg-elevated border border-border-default text-text-primary text-sm shadow-elevation">{toast}</div>
        </div>
      )}
    </div>
  );
}

// Nested traits editor (same behavior as CharacterManager)
type TraitCtx = {
  setVal: (p: Array<string|number>, v: any) => void;
  delKey: (pp: Array<string|number>, k: any) => void;
  renameKey: (pp: Array<string|number>, oldK: string, newK: string) => void;
  addChild: (p: Array<string|number>, d: number) => void;
  convertType: (p: Array<string|number>, pp: Array<string|number>, k: string, t: 'string'|'object'|'array', d: number) => void;
  addArrayItem: (p: Array<string|number>) => void;
};

function useWorldCtx(): TraitCtx {
  return {
    setVal: () => {},
    delKey: () => {},
    renameKey: () => {},
    addChild: () => {},
    convertType: () => {},
    addArrayItem: () => {},
  };
}

function TraitObject({ obj, path, depth }: { obj: any; path: Array<string|number>; depth: number }) {
  const parent: TraitCtx | undefined = (TraitObject as any)._parent as TraitCtx | undefined;
  const ctx: TraitCtx = parent || useWorldCtx();
  (TraitObject as any)._parent = ctx;
  const keys = Object.keys(obj || {});
  return (
    <div className="space-y-2">
      {keys.map((k) => (
        <TraitRow key={k} k={k} v={(obj as any)[k]} parentPath={path} depth={depth} ctx={ctx} />
      ))}
    </div>
  );
}

function TraitRow({ k, v, parentPath, depth, ctx }: { k: string; v: any; parentPath: Array<string|number>; depth: number; ctx: TraitCtx }) {
  const isArray = Array.isArray(v);
  const isObject = v && typeof v === 'object' && !isArray;
  const type: 'string'|'object'|'array' = isArray ? 'array' : (isObject ? 'object' : 'string');
  const [name, setName] = useState<string>(k);
  useEffect(() => { setName(k); }, [k]);

  return (
    <div className="border border-border-default rounded-md p-2 bg-bg-elevated">
      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(e)=>setName(e.target.value)}
          onBlur={()=>{ if (name !== k && name.trim()) ctx.renameKey(parentPath, k, name.trim()); }}
          onKeyDown={(e)=>{ if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } }}
          placeholder="key"
          className="flex-none w-48 bg-bg-primary border border-border-default rounded-md px-2 py-1.5 text-text-primary text-sm outline-none focus:border-accent"
        />
        <select value={type} onChange={(e)=>ctx.convertType([...parentPath, k], parentPath, k, e.target.value as any, depth)} className="flex-none w-28 bg-bg-primary border border-border-default rounded-md px-2 py-1.5 text-text-primary text-sm outline-none focus:border-accent">
          <option value="string">String</option>
          <option value="object" disabled={depth>=5}>Object</option>
          <option value="array">Array</option>
        </select>
        {type==='string' && (
          <input value={String(v || '')} onChange={(e)=>ctx.setVal([...parentPath, k], e.target.value)} placeholder="value" className="flex-1 bg-bg-primary border border-border-default rounded-md px-2 py-1.5 text-text-primary text-sm outline-none focus:border-accent" />
        )}
        <button onClick={()=>ctx.delKey(parentPath, k)} className="text-text-tertiary hover:text-red-400 text-sm ml-auto"><X className="w-4 h-4" /></button>
      </div>
      {type==='object' && (
        <div className="mt-2 ml-4">
          <button onClick={()=>ctx.addChild([...parentPath, k], depth+1)} disabled={depth>=5} className="px-2 py-1 rounded-md border border-border-default text-text-secondary hover:text-text-primary text-xs inline-flex items-center gap-1"><Plus className="w-3 h-3" /> Add child</button>
          <TraitObject obj={v} path={[...parentPath, k]} depth={depth+1} />
        </div>
      )}
      {type==='array' && (
        <div className="mt-2 ml-4 space-y-2">
          {(v as string[]).map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-xs text-text-tertiary">[{idx}]</span>
              <input value={item} onChange={(e)=>ctx.setVal([...parentPath, k, idx], e.target.value)} placeholder="value" className="flex-1 bg-bg-primary border border-border-default rounded-md px-2 py-1.5 text-text-primary text-sm outline-none focus:border-accent" />
              <button onClick={()=>ctx.delKey([...parentPath, k], idx)} className="text-text-tertiary hover:text-red-400 text-sm"><X className="w-4 h-4" /></button>
            </div>
          ))}
          <button onClick={()=>ctx.addArrayItem([...parentPath, k])} className="px-2 py-1 rounded-md border border-border-default text-text-secondary hover:text-text-primary text-xs inline-flex items-center gap-1"><Plus className="w-3 h-3" /> Add item</button>
        </div>
      )}
    </div>
  );
}
