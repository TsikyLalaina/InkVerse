"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { createApi } from "@/lib/api";
import { Loader2, Plus, Search, Trash2, Upload, X } from "lucide-react";

type CharacterItem = {
  id?: string;
  name: string;
  role?: string | null;
  summary?: string | null;
  imageUrl?: string | null;
  traits?: any | null;
  createdAt?: string;
  updatedAt?: string;
};

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function setByPath(base: any, path: string[], value: any) {
  const root = base && typeof base === "object" ? { ...base } : {};
  let curr: any = root;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    if (!curr[k] || typeof curr[k] !== "object") curr[k] = {};
    curr = curr[k];
  }
  curr[path[path.length - 1]] = value;
  return root;
}

function delByPath(base: any, path: string[]) {
  const root = base && typeof base === "object" ? { ...base } : {};
  let curr: any = root;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    if (!curr[k] || typeof curr[k] !== "object") return root;
    curr = curr[k];
  }
  delete curr[path[path.length - 1]];
  return root;
}

function toNestedFromTags(tags: Array<{ key: string; value: string }>) {
  let obj: any = {};
  for (const t of tags) {
    const parts = t.key.split(".").map((s) => s.trim()).filter(Boolean);
    if (!parts.length) continue;
    obj = setByPath(obj, parts, t.value);
  }
  return obj;
}

export function CharacterManager({ projectId, requireImage }: { projectId: string; requireImage: boolean }) {
  const supabase = useSupabase();
  const api = useMemo(() => createApi(supabase), [supabase]);

  const [items, setItems] = useState<CharacterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [activeId, setActiveId] = useState<string | "__new__" | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState<CharacterItem>({ name: "" });
  const [traits, setTraits] = useState<any>({});
  const [uploading, setUploading] = useState(false);
  const dropRef = useRef<HTMLDivElement | null>(null);

  const cacheKey = useMemo(() => `inkverse_project_${projectId}_characters`, [projectId]);
  const activeKey = useMemo(() => `inkverse_project_${projectId}_characters_active`, [projectId]);
  const [hasCache, setHasCache] = useState(false);
  const itemsRef = useRef<CharacterItem[]>(items);

  useEffect(() => {
    try {
      const s = typeof window !== 'undefined' ? window.localStorage.getItem(cacheKey) : null;
      if (s) {
        const arr = JSON.parse(s);
        if (Array.isArray(arr)) {
          setItems(arr as CharacterItem[]);
          const valid = (arr as any[]).length > 0;
          setHasCache(valid);
          if (valid) setLoading(false);
        }
      }
    } catch {}
  }, [cacheKey]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (hasCache) { return; }
      try {
        if (!hasCache) setLoading(true);
        const res = await api.listCharacters(projectId);
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
        setError(e?.message || "Failed to load characters");
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

  // Restore last active selection
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
        setForm({ id: item.id, name: item.name, role: item.role || "", summary: item.summary || "", imageUrl: (item as any).imageUrl || "", traits: item.traits || null });
        setTraits(item.traits || {});
      }
      notify("Character updated via chat");
    }
    window.addEventListener('workspace:character-upsert', onUpsert as any);
    return () => window.removeEventListener('workspace:character-upsert', onUpsert as any);
  }, [activeId]);

  useEffect(() => {
    if (!activeId) return;
    if (activeId === "__new__") {
      setForm({ name: "" });
      setTraits({});
      return;
    }
    const it = items.find((x) => x.id === activeId);
    if (!it) return;
    setForm({ id: it.id, name: it.name, role: it.role || "", summary: it.summary || "", imageUrl: it.imageUrl || "", traits: it.traits || null });
    setTraits(it.traits || {});
  }, [activeId, items]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter((x) => (x.name || "").toLowerCase().includes(q) || (x.role || "").toLowerCase().includes(q));
  }, [items, filter]);

  const onNew = () => {
    setActiveId("__new__");
    setForm({ name: "" });
    setTraits({});
  };

  // Removed brainstorm/refine suggestion logic

  const notify = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(""), 2500);
  };

  const onUploadFile = useCallback(async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const bucket = process.env.NEXT_PUBLIC_SUPABASE_CHAR_BUCKET || "character-images";
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${projectId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      const url = data.publicUrl;
      setForm((f) => ({ ...f, imageUrl: url }));
      notify("Image uploaded");
    } catch (e: any) {
      notify(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [projectId, supabase]);

  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer?.files?.[0];
      if (f) void onUploadFile(f);
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
  }, [onUploadFile]);

  // ----- Traits editor helpers (strings-only values, arrays supported, depth<=5) -----
  const clone = (o: any) => JSON.parse(JSON.stringify(o ?? {}));
  const isObj = (v: any) => v && typeof v === 'object' && !Array.isArray(v);

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
    if (depth >= 5) return; // depth limit
    setTraits((curr: any) => {
      const nxt = clone(curr);
      let ref: any = nxt;
      for (let i = 0; i < pathToObj.length; i++) ref = ref[pathToObj[i]];
      if (!ref || typeof ref !== 'object' || Array.isArray(ref)) return nxt;
      let base = 'key'; let i2 = 1; let key = base;
      while (Object.prototype.hasOwnProperty.call(ref, key)) { key = `${base}-${i2++}`; }
      ref[key] = ""; // default as string leaf
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

  // Expose handlers to nested TraitObject/TraitRow without prop-drilling
  (TraitObject as any)._parent = {
    setVal,
    delKey,
    renameKey,
    addChild,
    convertType,
    addArrayItem,
  } as TraitCtx;

  const onSave = async () => {
    if (!form.name.trim()) {
      notify("Name is required");
      return;
    }
    if (requireImage && !form.imageUrl) {
      notify("Image is required in manhwa mode");
      return;
    }
    setSaving(true);
    try {
      const traitsObj = traits;
      if (activeId === "__new__") {
        const res = await api.createCharacter(projectId, { name: form.name.trim(), role: form.role || undefined, summary: form.summary || undefined, imageUrl: form.imageUrl || undefined, traits: traitsObj });
        setItems((prev) => [...prev, res]);
        setActiveId(res.id);
      } else if (activeId) {
        const res = await api.updateCharacter(projectId, activeId, { name: form.name.trim(), role: form.role || undefined, summary: form.summary || undefined, imageUrl: form.imageUrl || undefined, traits: traitsObj });
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
    if (!confirm("Delete this character?")) return;
    setDeleting(true);
    try {
      await api.deleteCharacter(projectId, activeId);
      setItems((prev) => prev.filter((x) => x.id !== activeId));
      setActiveId(null);
      setForm({ name: "" });
      setTraits({});
      notify("Deleted");
    } catch (e: any) {
      notify(e?.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const count = items.length;
  const active = activeId === "__new__" ? form : items.find((x) => x.id === activeId) || null;

  return (
    <div className="h-full grid grid-rows-[auto_1fr]">
      <div className="border-b border-border-default px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-base font-semibold text-text-primary">Character Management</div>
          <div className="text-xs px-2 py-1 rounded-md border border-border-default text-text-secondary">{count} Characters</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onNew} className="rounded-lg bg-bg-elevated border border-border-default hover:border-accent hover:bg-bg-hover text-text-secondary hover:text-text-primary text-sm px-4 py-3 inline-flex items-center justify-center gap-2 transition-all duration-150 hover:-translate-y-0.5">
            <Plus className="w-4 h-4" />
            New Character
          </button>
        </div>
      </div>

      <div className="min-h-0 grid" style={{ gridTemplateColumns: "35% 65%" }}>
        <aside className="border-r border-border-default min-h-0 flex flex-col">
          <div className="p-3">
            <div className="relative">
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search characters" className="w-full bg-bg-primary border border-border-default rounded-md pl-9 pr-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent" />
              <Search className="w-4 h-4 absolute left-3 top-3 text-text-tertiary" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {loading && <div className="text-xs text-text-secondary px-2 py-2">Loading…</div>}
            {error && <div className="text-xs text-red-400 px-2 py-2 bg-red-950/20 rounded-md border border-red-500/20">{error}</div>}
            {!loading && !filtered.length && (
              <div className="mt-10 text-center text-text-tertiary text-sm">No characters yet. Create your first character!</div>
            )}
            {filtered.map((c) => (
              <button key={c.id} onClick={() => setActiveId(c.id!)} className={classNames("w-full text-left px-3 py-3 rounded-md mb-2 transition-all", activeId===c.id ? "border-l-2 border-blue-500 bg-bg-elevated" : "hover:bg-bg-hover") }>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-bg-primary border border-border-default overflow-hidden flex items-center justify-center">
                    {c.imageUrl ? <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" /> : <div className="text-xs text-text-tertiary">No Img</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-primary truncate">{c.name}</div>
                    <div className="text-xs text-text-tertiary truncate">{c.role || ""}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto p-6" aria-label="Character details">
          {activeId ? (
            <div className="max-w-2xl mx-auto">
              <div ref={dropRef} className="flex flex-col items-center mb-6 p-4 rounded-xl border border-border-default bg-bg-elevated">
                <div className="w-30 h-30 w-[120px] h-[120px] rounded-full overflow-hidden border border-border-default bg-bg-primary flex items-center justify-center">
                  {form.imageUrl ? <img src={form.imageUrl} alt="avatar" className="w-full h-full object-cover" /> : <div className="text-xs text-text-tertiary">No Image</div>}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <label className="px-3 py-2 rounded-md border border-border-default bg-bg-primary text-text-secondary hover:text-text-primary inline-flex items-center gap-2 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    {form.imageUrl ? "Change Image" : "Upload Image"}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onUploadFile(f); }} />
                  </label>
                  {form.imageUrl && (
                    <button onClick={() => setForm((f)=>({ ...f, imageUrl: "" }))} className="text-text-tertiary hover:text-red-400 text-sm inline-flex items-center gap-1">
                      <X className="w-4 h-4" />
                      Remove
                    </button>
                  )}
                </div>
                {uploading && <div className="mt-2 text-xs text-text-tertiary inline-flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Uploading…</div>}
              </div>

              <div className="grid gap-4">
                <label className="grid gap-2 text-sm">
                  <span className="text-xs text-text-tertiary uppercase tracking-wide">Name</span>
                  <input value={form.name} onChange={(e)=>setForm((f)=>({ ...f, name: e.target.value }))} className="w-full bg-bg-primary border border-border-default rounded-md px-4 py-2.5 text-text-primary outline-none focus:border-accent" />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="text-xs text-text-tertiary uppercase tracking-wide">Role</span>
                  <input value={form.role || ""} onChange={(e)=>setForm((f)=>({ ...f, role: e.target.value }))} list="roles" className="w-full bg-bg-primary border border-border-default rounded-md px-4 py-2.5 text-text-primary outline-none focus:border-accent" />
                  <datalist id="roles">
                    <option value="Protagonist" />
                    <option value="Antagonist" />
                    <option value="Supporting" />
                    <option value="Mentor" />
                    <option value="Love Interest" />
                  </datalist>
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
                    Delete Character
                  </button>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setActiveId(null); }} className="px-4 py-2 rounded-md border border-border-default text-text-secondary hover:bg-bg-hover">Cancel</button>
                    <button onClick={onSave} disabled={saving} className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white">
                      {saving ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Saving…</span> : "Save Character"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-text-tertiary">Select a character or create a new one.</div>
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

// --- Nested Traits Editor (strings-only leaves, arrays supported) ---
type TraitCtx = {
  setVal: (p: Array<string|number>, v: any) => void;
  delKey: (pp: Array<string|number>, k: any) => void;
  renameKey: (pp: Array<string|number>, oldK: string, newK: string) => void;
  addChild: (p: Array<string|number>, d: number) => void;
  convertType: (p: Array<string|number>, pp: Array<string|number>, k: string, t: 'string'|'object'|'array', d: number) => void;
  addArrayItem: (p: Array<string|number>) => void;
};
function TraitObject({ obj, path, depth }: { obj: any; path: Array<string|number>; depth: number }) {
  const [_, setTick] = useState(0);
  // Access editor functions from outer scope via window proxy is not ideal; we rely on closures in parent component.
  // This inline component depends on functions bound on window by parent closure.
  // To keep everything in one file and avoid prop-drilling many handlers, we will re-grab them from React context via closures.
  const parent: TraitCtx | undefined = (TraitObject as any)._parent as TraitCtx | undefined;
  const ctx: TraitCtx = parent || useCharacterManagerContext();
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

// Lightweight context via closure binding
function useCharacterManagerContext(): TraitCtx {
  // Find the nearest CharacterManager by walking React closure. In TSX single-file component, we pass handlers by property in TraitObject._parent above.
  // Instead of a real React Context provider (extra boilerplate), expose noop fallbacks; they get overwritten when first TraitObject renders.
  return {
    setVal: (_p: Array<string|number>, _v: any) => {},
    delKey: (_pp: Array<string|number>, _k: any) => {},
    renameKey: (_pp: Array<string|number>, _old: string, _n: string) => {},
    addChild: (_p: Array<string|number>, _d: number) => {},
    convertType: (_p: Array<string|number>, _pp: Array<string|number>, _k: string, _t: 'string'|'object'|'array', _d: number) => {},
    addArrayItem: (_p: Array<string|number>) => {},
  };
}
