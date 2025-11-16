"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useSupabase } from '@/components/providers/SupabaseProvider';
import { ChatBubble } from './ChatBubble';
import { createApi } from '@/lib/api';
import { ArrowUpRight, ChevronDown } from 'lucide-react';

export type ChatMessage = {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  panelId?: string | null;
};

export function Chat({ chatId, initialMessages = [] }: { chatId: string; initialMessages?: ChatMessage[] }) {
  const supabase = useSupabase();
  const api = useMemo(() => createApi(supabase), [supabase]);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const modeMenuListRef = useRef<HTMLDivElement>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [pendingMode, setPendingMode] = useState<'novel' | 'manhwa' | 'convert' | null>(null);
  const [pendingSettings, setPendingSettings] = useState<any | null>(null);
  const [toastMsg, setToastMsg] = useState<string>('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [clientMode, setClientMode] = useState<'chat' | 'action'>('chat');
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [modeMenuIndex, setModeMenuIndex] = useState<number>(0);

  const cacheKey = useMemo(() => `inkverse_chat_${chatId}_messages`, [chatId]);
  const [hasCache, setHasCache] = useState<boolean>(false);
  const messagesRef = useRef<ChatMessage[]>(messages);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    try {
      const s = typeof window !== 'undefined' ? window.localStorage.getItem(cacheKey) : null;
      if (s) {
        const arr = JSON.parse(s);
        if (Array.isArray(arr)) {
          setMessages(arr as ChatMessage[]);
          setHasCache((arr as any[]).length > 0);
        }
      }
    } catch {}
  }, [cacheKey]);

  useEffect(() => {
    // If parent provides messages later, set them only if list is empty
    if (initialMessages.length && messages.length === 0) {
      setMessages(initialMessages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessages]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (hasCache) { return; }
      try {
        if (!hasCache) setLoadingHistory(true);
        const history = await api.getChatMessagesByChatId(chatId);
        if (!mounted) return;
        const next = Array.isArray(history) ? history as any : [];
        // Skip update if no change to avoid flicker
        try {
          if (hasCache && JSON.stringify(next) === JSON.stringify(messagesRef.current)) {
            return;
          }
        } catch {}
        setMessages(next);
      } catch {
        // swallow network errors during initial hydration/revalidation
      } finally {
        if (mounted) setLoadingHistory(false);
      }
    })();
    return () => { mounted = false; };
  }, [api, chatId, hasCache]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(cacheKey, JSON.stringify(messages));
    } catch {}
  }, [messages, cacheKey]);

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Auto-resize textarea height with content, up to a max then scroll
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const max = 256; // px max height before scroll
    const next = Math.min(el.scrollHeight, max);
    el.style.height = `${next}px`;
  }, [input]);

  // Close mode menu on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!modeMenuOpen) return;
      const t = e.target as Node | null;
      if (modeMenuRef.current && t && !modeMenuRef.current.contains(t)) {
        setModeMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [modeMenuOpen]);

  // Keyboard: open/close menu and navigate options
  const onModeButtonKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setModeMenuIndex(clientMode === 'chat' ? 0 : 1);
      setModeMenuOpen(true);
    } else if (e.key === 'Escape') {
      setModeMenuOpen(false);
    }
  };

  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setModeMenuIndex((i) => (i + 1) % 2);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setModeMenuIndex((i) => (i + 1 + 2) % 2);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (modeMenuIndex === 0) setClientMode('chat');
      else setClientMode('action');
      setModeMenuOpen(false);
    } else if (e.key === 'Escape') {
      setModeMenuOpen(false);
    }
  };

  // Shortcut: Ctrl+L focuses input
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Focus menu container when opened for keyboard nav
  useEffect(() => {
    if (modeMenuOpen) {
      setTimeout(() => modeMenuListRef.current?.focus(), 0);
    }
  }, [modeMenuOpen]);

  const send = useCallback(async (opts?: { regeneratePanelId?: string; messageOverride?: string }) => {
    const text = (opts?.messageOverride ?? input).trim();
    if (!text && !opts?.regeneratePanelId) {
      setInputError('Prompt is empty. Try something like: "Write the opening scene of a dark fantasy."');
      return;
    }
    setInputError(null);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;

    const userMessage: ChatMessage = { role: 'user', content: text, panelId: opts?.regeneratePanelId || null };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setStreaming(true);

    // Mentions parsing: @chapter<number> or @"exact title"
    const mNum = /@chapter\s*([0-9]+)/i.exec(text) || /@chapter_?([0-9]+)/i.exec(text);
    const mTitle = /@"([^"]+)"/.exec(text);
    const mentions: any = {};
    if (mNum?.[1]) mentions.chapter_number = parseInt(mNum[1], 10);
    if (mTitle?.[1]) mentions.title = mTitle[1];

    const res = await fetch(`${apiBase}/api/chat/${chatId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: userMessage.content, regeneratePanelId: opts?.regeneratePanelId || undefined, clientMode, mentions }),
    });

    if (!res.body) {
      setStreaming(false);
      return;
    }

    // Push empty assistant message to stream into
    let assistantIndex = -1;
    setMessages((prev) => {
      assistantIndex = prev.length;
      return [...prev, { role: 'assistant', content: '' }];
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (!data) continue;
          try {
            const evt = JSON.parse(data);
            if (evt.type === 'text' && evt.content) {
              setMessages((prev) => {
                const copy = [...prev];
                const msg = copy[assistantIndex];
                copy[assistantIndex] = { ...msg, content: (msg?.content || '') + evt.content };
                return copy;
              });
            } else if (evt.action === 'create_chapter') {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('workspace:create-draft', { detail: { title: evt.title || 'Untitled Chapter', content: evt.content || '' } }));
              }
            } else if (evt.action === 'confirm_mode' && evt.mode) {
              setPendingMode(evt.mode);
              setMessages((prev) => [...prev, { role: 'assistant', content: `Pending mode change to "${evt.mode}". Confirm?` }]);
            } else if (evt.action === 'confirm_settings' && evt.changes) {
              if (clientMode === 'action') {
                setPendingSettings(evt.changes);
                setMessages((prev) => [...prev, { role: 'assistant', content: 'Pending settings update detected. Confirm to apply changes.' }]);
              } // ignore in Chat mode for safety
            } else if (evt.type === 'image_job') {
              // Optionally reflect job queued state
            } else if (evt.action === 'convert_to_manhwa') {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('workspace:create-draft', { detail: { title: 'Converted Panels', panel_script: evt.panel_script } }));
              }
            } else if (evt.action === 'update_chapter') {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('workspace:update-chapter', { detail: { id: evt.id, chapter_number: evt.chapter_number, title: evt.title, content: evt.content } }));
              }
            } else if (evt.action === 'upsert_character' && evt.item) {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('workspace:character-upsert', { detail: { item: evt.item } }));
              }
            } else if (evt.action === 'upsert_world' && evt.item) {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('workspace:world-upsert', { detail: { item: evt.item } }));
              }
            } else if (evt.type === 'error') {
              // Append error to conversation
              setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${evt.message}` }]);
            } else if (evt.type === 'done') {
              setStreaming(false);
            }
          } catch {
            // ignore partial json lines
          }
        }
      }
    } finally {
      setStreaming(false);
      reader.releaseLock();
    }
  }, [apiBase, input, chatId, supabase, clientMode]);

  const onRegenerate = useCallback((panelId: string) => {
    void send({ regeneratePanelId: panelId });
  }, [send]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="h-full flex flex-col bg-bg-elevated">
        {/* Messages Area with Scrollbar */}
        <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto space-y-4 p-4">
          {loadingHistory && (
            <div className="text-sm text-text-secondary">Loading previous messages…</div>
          )}
          {messages.map((m, i) => (
            <ChatBubble
              key={i}
              role={m.role}
              content={m.content}
              panelId={m.panelId}
              onRegenerate={onRegenerate}
              draggable={Boolean(m.panelId)}
            />)
          )}
          {streaming && (
            <div className="text-sm text-text-secondary animate-pulse">AI is typing…</div>
          )}
        </div>

      {toastMsg && (
        <div className="fixed top-3 right-3 z-50">
          <div className="px-3 py-2 rounded bg-slate-950/90 border border-slate-800 text-slate-100 text-sm shadow-lg">
            {toastMsg}
          </div>
        </div>
      )}
        
        {(pendingMode || pendingSettings) && (
          <div className="border-t border-border-default p-3 flex items-center justify-between gap-3 bg-bg-primary">
            <div className="text-sm text-text-primary">
              {pendingMode && `Confirm mode change to "${pendingMode}"?`}
              {pendingSettings && !pendingMode && 'Confirm applying pending settings changes?'}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1.5 rounded-md border border-border-default text-text-secondary hover:bg-bg-hover transition-all duration-150"
                onClick={() => { setPendingMode(null); setPendingSettings(null); }}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1.5 rounded-md bg-accent hover:bg-accent-hover text-white disabled:opacity-50 transition-all duration-150"
                disabled={saving || clientMode !== 'action'}
                onClick={async () => {
                  setSaving(true);
                  setSaveError(null);
                  try {
                    if (pendingMode) {
                      // Mode is project-level; Chat component no longer knows projectId here
                      // This confirm block remains but requires a project-level handler outside
                      // For safety, we just clear pending and show a note.
                      // Notify rest of app (e.g., sidebar) to reflect mode immediately
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('project:mode-updated', { detail: { mode: pendingMode } }));
                      }
                      setMessages((prev) => [...prev, { role: 'assistant', content: `Mode updated to ${pendingMode}.` }]);
                      setPendingMode(null);
                    } else if (pendingSettings) {
                      // Settings are project-level; handle outside. Here we preview-only.
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('project:settings-updated', { detail: { changes: pendingSettings } }));
                      }
                      setMessages((prev) => [...prev, { role: 'assistant', content: 'Settings updated.' }]);
                      setPendingSettings(null);
                      // Toast from chat confirm
                      if (toastTimer.current) clearTimeout(toastTimer.current);
                      setToastMsg('Settings saved');
                      toastTimer.current = setTimeout(() => setToastMsg(''), 3000);
                    }
                  } catch (e: any) {
                    setSaveError(e?.message || 'Failed to save');
                    setMessages((prev) => [...prev, { role: 'assistant', content: `Error persisting changes: ${e?.message || 'Failed to save'}` }]);
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Confirm
              </button>
              {clientMode !== 'action' && (
                <span className="text-[11px] text-text-tertiary">Switch to Action mode to apply</span>
              )}
            </div>
          </div>
        )}
        {/* Input Area - Fixed at Bottom */}
        <div className="border-t border-border-default p-3 bg-bg-primary">
          <div className="flex gap-3 items-end">
            {/* Input Field with Integrated Send Button and Mode Selector inside */}
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Chat with Cascade"
                rows={2}
                className="w-full bg-bg-elevated border border-border-default rounded-2xl pl-12 pr-12 pt-2 pb-10 text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent resize-none min-h-[80px] max-h-72 overflow-y-auto transition-colors duration-150"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              {/* Mode Selector inside input bottom-left */}
              <div className="absolute left-2 bottom-2" ref={modeMenuRef}>
                <button
                  type="button"
                  className={`text-xs px-3 py-2 rounded-lg border border-border-default ${clientMode==='chat' ? 'text-success' : 'text-accent'} bg-bg-elevated hover:bg-bg-hover inline-flex items-center gap-1.5 transition-all duration-150`}
                  onClick={() => { setModeMenuIndex(clientMode==='chat' ? 0 : 1); setModeMenuOpen((v) => !v); }}
                  aria-haspopup="menu"
                  aria-expanded={modeMenuOpen}
                  onKeyDown={onModeButtonKeyDown}
                  title="Mode"
                >
                  {clientMode === 'chat' ? 'Chat' : 'Action'}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {modeMenuOpen && (
                  <div
                    className="absolute bottom-full mb-2 left-0 w-64 rounded-lg border border-border-default bg-bg-elevated shadow-elevation p-1.5 text-xs text-text-primary z-20"
                    role="menu"
                    tabIndex={-1}
                    ref={modeMenuListRef}
                    onKeyDown={onMenuKeyDown}
                  >
                    <button
                      className={`w-full text-left px-3 py-2.5 rounded-md hover:bg-bg-hover transition-all duration-150 ${modeMenuIndex===0 ? 'ring-1 ring-accent' : ''} ${clientMode==='chat' ? 'bg-bg-hover' : ''}`}
                      onClick={() => { setClientMode('chat'); setModeMenuOpen(false); }}
                    >
                      <div className="font-semibold text-text-primary">Chat</div>
                      <div className="text-text-tertiary text-[11px] mt-0.5">Brainstorm, outline, preview. No writes.</div>
                    </button>
                    <button
                      className={`w-full text-left px-3 py-2.5 rounded-md hover:bg-bg-hover transition-all duration-150 mt-1 ${modeMenuIndex===1 ? 'ring-1 ring-accent' : ''} ${clientMode==='action' ? 'bg-bg-hover' : ''}`}
                      onClick={() => { setClientMode('action'); setModeMenuOpen(false); }}
                    >
                      <div className="font-semibold text-text-primary">Action</div>
                      <div className="text-text-tertiary text-[11px] mt-0.5">Enable saving settings and chapters.</div>
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => void send()}
                disabled={streaming || !input.trim()}
                className="absolute right-2 bottom-2 bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white w-8 h-8 rounded-lg inline-flex items-center justify-center transition-all duration-150"
                title="Send"
              >
                <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                <span className="sr-only">Send</span>
              </button>
            </div>
          </div>
          {inputError && <div className="mt-2 text-xs text-red-400 p-2 rounded-lg bg-red-950/20 border border-red-500/20">{inputError}</div>}
        </div>
      </div>

      {/* drafts are routed to center editor via workspace:create-draft */}
    </DndProvider>
  );
}
