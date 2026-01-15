"use client";

import type { SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useRef, useState } from 'react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

async function authHeaders(supabase: SupabaseClient) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T = any>(
  supabase: SupabaseClient,
  input: string,
  init: RequestInit = {}
): Promise<T> {
  const hasBody = init.body !== undefined && init.body !== null;
  const baseHeaders = {
    ...(await authHeaders(supabase)),
    ...(init.headers || {}),
  } as Record<string, string>;
  const headers = hasBody ? { 'Content-Type': 'application/json', ...baseHeaders } : baseHeaders;

  const res = await fetch(`${API_BASE}${input}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

async function publicApiFetch<T = any>(
  input: string,
  init: RequestInit = {}
): Promise<T> {
  const hasBody = init.body !== undefined && init.body !== null;
  const baseHeaders = init.headers || {};
  const headers = hasBody ? { 'Content-Type': 'application/json', ...baseHeaders } : baseHeaders;

  const res = await fetch(`${API_BASE}${input}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

export function createApi(supabase: SupabaseClient) {
  return {
    // Projects CRUD
    listProjects: () =>
      apiFetch<any[]>(supabase, `/api/project`),
    createProject: (body: { title: string; description?: string }) =>
      apiFetch<{ id: string }>(supabase, `/api/project`, { method: 'POST', body: JSON.stringify(body) }),

    getProject: (id: string) =>
      apiFetch<any>(supabase, `/api/project/${id}`),

    updateProject: (id: string, body: { title?: string; description?: string }) =>
      apiFetch<any>(supabase, `/api/project/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

    deleteProject: (id: string) =>
      apiFetch<void>(supabase, `/api/project/${id}`, { method: 'DELETE' }),

    // Project settings
    updateProjectSettings: (
      id: string,
      body: { title?: string; description?: string; coverImage?: string; genres?: string[]; coreConflict?: string; settingsJson?: any; mode?: 'novel' | 'manhwa' | 'convert' }
    ) => apiFetch<any>(supabase, `/api/project/${id}/settings`, { method: 'PATCH', body: JSON.stringify(body) }),

    // Sharing
    publishProject: (id: string) =>
      apiFetch<{ id: string; visibility: 'public'|'private'; publicSlug?: string|null; publishedAt?: string|null }>(supabase, `/api/project/${id}/share/publish`, { method: 'POST' }),
    unpublishProject: (id: string) =>
      apiFetch<{ id: string; visibility: 'public'|'private'; publicSlug?: string|null; publishedAt?: string|null }>(supabase, `/api/project/${id}/share/unpublish`, { method: 'POST' }),

    // Public read APIs (no auth required, but sends token if available for ownership/unlock checks)
    getPublicProject: (slug: string) =>
      apiFetch<any>(supabase, `/api/public/project/${encodeURIComponent(slug)}`),
    getPublicChapters: (slug: string, page: number, limit: number) =>
      apiFetch<{ items: any[]; total: number }>(supabase, `/api/public/project/${encodeURIComponent(slug)}/chapters?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`),
    getPublicProjects: (page: number, limit: number, q?: string) =>
      apiFetch<{ items: any[]; total: number }>(
        supabase,
        `/api/public/projects?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}${q ? `&q=${encodeURIComponent(q)}` : ''}`
      ),

    // Chat
    // Legacy (per-project) - will be replaced by chatId-based endpoints
    getChatMessages: (projectId: string) =>
      apiFetch<any[]>(supabase, `/api/project/${projectId}/chat/messages`),

    // Chats (per project)
    listChats: (projectId: string) =>
      apiFetch<any[]>(supabase, `/api/project/${projectId}/chats`),
    createChat: (projectId: string, body: { type: 'plot'|'character'|'world'; title?: string }) =>
      apiFetch<any>(supabase, `/api/project/${projectId}/chats`, { method: 'POST', body: JSON.stringify(body) }),
    renameChat: (projectId: string, chatId: string, title: string) =>
      apiFetch<any>(supabase, `/api/project/${projectId}/chats/${chatId}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
    deleteChat: (projectId: string, chatId: string) =>
      apiFetch<void>(supabase, `/api/project/${projectId}/chats/${chatId}`, { method: 'DELETE' }),

    // Chat messages by chatId
    getChatMessagesByChatId: (chatId: string) =>
      apiFetch<any[]>(supabase, `/api/chat/${chatId}/messages`),

    // Chapters
    createChapter: (projectId: string, payload: { title: string; content?: string; panel_script?: any; branchId?: string; isCanon?: boolean }) =>
      apiFetch<{ id: string; title: string }>(supabase, `/api/project/${projectId}/chapter`, { method: 'POST', body: JSON.stringify(payload) }),

    // Chapter previews
    getChapterSummary: (projectId: string) =>
      apiFetch<{ count: number; snippet: string }>(supabase, `/api/project/${projectId}/chapters/summary`),

    // Paginated chapters for reader
    listChaptersPaginated: (projectId: string, page: number, limit: number) =>
      apiFetch<{ items: any[]; total: number }>(supabase, `/api/project/${projectId}/chapters?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`),

    // Update chapter
    updateChapter: (
      projectId: string,
      chapterId: string,
      payload: { title?: string; content?: string; panel_script?: any; price?: number }
    ) => apiFetch<any>(supabase, `/api/project/${projectId}/chapter/${chapterId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

    // Delete chapter
    deleteChapter: (
      projectId: string,
      chapterId: string,
    ) => apiFetch<void>(supabase, `/api/project/${projectId}/chapter/${chapterId}`, { method: 'DELETE' }),

    // Characters
    listCharacters: (projectId: string) =>
      apiFetch<any[]>(supabase, `/api/project/${projectId}/characters`),
    createCharacter: (
      projectId: string,
      body: { name: string; role?: string; summary?: string; images?: string[]; traits?: any; traitsOps?: Array<{ op: 'set'|'delete'; path: string[]; value?: any }> }
    ) => apiFetch<any>(supabase, `/api/project/${projectId}/characters`, { method: 'POST', body: JSON.stringify(body) }),
    updateCharacter: (
      projectId: string,
      charId: string,
      body: { name?: string; role?: string; summary?: string; images?: string[]; traits?: any; traitsOps?: Array<{ op: 'set'|'delete'; path: string[]; value?: any }> }
    ) => apiFetch<any>(supabase, `/api/project/${projectId}/characters/${charId}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deleteCharacter: (
      projectId: string,
      charId: string,
    ) => apiFetch<void>(supabase, `/api/project/${projectId}/characters/${charId}`, { method: 'DELETE' }),

    // World Settings
    listWorldSettings: (projectId: string) =>
      apiFetch<any[]>(supabase, `/api/project/${projectId}/world`),
    createWorldSetting: (
      projectId: string,
      body: { name: string; summary?: string; traits?: any; images?: string[]; traitsOps?: Array<{ op: 'set'|'delete'; path: string[]; value?: any }> }
    ) => apiFetch<any>(supabase, `/api/project/${projectId}/world`, { method: 'POST', body: JSON.stringify(body) }),
    updateWorldSetting: (
      projectId: string,
      wsId: string,
      body: { name?: string; summary?: string; traits?: any; images?: string[]; traitsOps?: Array<{ op: 'set'|'delete'; path: string[]; value?: any }> }
    ) => apiFetch<any>(supabase, `/api/project/${projectId}/world/${wsId}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deleteWorldSetting: (
      projectId: string,
      wsId: string,
    ) => apiFetch<void>(supabase, `/api/project/${projectId}/world/${wsId}`, { method: 'DELETE' }),

    // Chat (SSE should be used via useSSE below)
    // Streaming chat by chatId (SSE)
    postChat: async (
      chatId: string,
      body: { message: string; regeneratePanelId?: string; clientMode?: 'chat'|'action'; mentions?: any },
      onEvent: (evt: any) => void
    ) => {
      const headers = {
        'Content-Type': 'application/json',
        ...(await authHeaders(supabase)),
      } as Record<string, string>;

      const res = await fetch(`${API_BASE}/api/chat/${chatId}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '');
        throw new Error(`Chat stream error ${res.status}: ${text}`);
      }

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
            try { onEvent(JSON.parse(data)); } catch {}
          }
        }
      } finally {
        reader.releaseLock();
      }
    },

    // Text generation (SSE)
    generateTextStream: async (
      body: { prompt: string; projectId: string },
      onEvent: (evt: any) => void
    ) => {
      const headers = {
        'Content-Type': 'application/json',
        ...(await authHeaders(supabase)),
      } as Record<string, string>;

      const res = await fetch(`${API_BASE}/api/generate/text`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '');
        throw new Error(`Text stream error ${res.status}: ${text}`);
      }
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
            try { onEvent(JSON.parse(data)); } catch {}
          }
        }
      } finally {
        reader.releaseLock();
      }
    },

    // Image generation (queued or direct fallback)
    generateImage: (body: { description: string; style?: string; projectId?: string }) =>
      apiFetch<{ jobId: string; url?: string; queued?: boolean; cached?: boolean }>(supabase, `/api/generate/image`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    // User Stats
    getUserStats: () =>
      apiFetch<{
        id: string;
        userId: string;
        level: number;
        totalExp: number;
        currentLevelExp: number;
        nextLevelExp: number;
        progressPercent: number;
        chaptersCreated: number;
        charactersCreated: number;
        worldSettingsCreated: number;
        projectsCreated: number;
        totalWordsWritten: number;
      }>(supabase, `/api/user/stats`),

    awardExp: (body: { action: string; amount?: number }) =>
      apiFetch<{
        success: boolean;
        expAwarded: number;
        leveledUp: boolean;
        newLevel: number;
        totalExp: number;
        currentLevelExp: number;
        nextLevelExp: number;
        progressPercent: number;
      }>(supabase, `/api/user/stats/award`, { method: 'POST', body: JSON.stringify(body) }),

    incrementStat: (body: { field: string; amount?: number }) =>
      apiFetch<{ success: boolean; field: string; newValue: number }>(supabase, `/api/user/stats/increment`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),

    syncUserStats: () =>
      apiFetch<{
        success: boolean;
        message: string;
        level: number;
        totalExp: number;
        currentLevelExp: number;
        nextLevelExp: number;
        progressPercent: number;
        projectsCreated: number;
        chaptersCreated: number;
        charactersCreated: number;
        worldSettingsCreated: number;
        totalWordsWritten: number;
      }>(supabase, `/api/user/stats/sync`, { method: 'POST' }),

    // Export project - returns raw file content
    exportProject: async (projectId: string, format: 'json' | 'markdown' | 'text' = 'json') => {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/project/${projectId}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ format }),
      });
      if (!response.ok) throw new Error(`Export failed: ${response.statusText}`);
      return response.text(); // Return as text, not JSON
    },

    // Bookmarks
    createBookmark: (projectId: string, progress: number, name?: string, description?: string) =>
      apiFetch<any>(supabase, `/api/project/${projectId}/bookmarks`, {
        method: 'POST',
        body: JSON.stringify({ progress, name, description }),
      }),

    listBookmarks: (projectId: string) =>
      apiFetch<any[]>(supabase, `/api/project/${projectId}/bookmarks`),

    updateBookmark: (projectId: string, bookmarkId: string, name?: string, description?: string) =>
      apiFetch<any>(supabase, `/api/project/${projectId}/bookmarks/${bookmarkId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, description }),
      }),

    deleteBookmark: (projectId: string, bookmarkId: string) =>
      apiFetch<void>(supabase, `/api/project/${projectId}/bookmarks/${bookmarkId}`, { method: 'DELETE' }),

    // User Profile
    getUserProfile: () =>
      apiFetch<{ userId: string; email: string; username: string | null }>(supabase, `/api/user/profile`),

    checkUsernameAvailability: (username: string) =>
      apiFetch<{ available: boolean; username: string }>(supabase, `/api/user/check-username`, {
        method: 'POST',
        body: JSON.stringify({ username }),
      }),

    updateUserProfile: (body: { username: string }) =>
      apiFetch<{ success: boolean; userId: string; email: string; username: string | null; message: string }>(
        supabase,
        `/api/user/profile`,
        { method: 'PATCH', body: JSON.stringify(body) }
      ),

    // Generic GET/POST/PATCH/DELETE for flexibility
    get: (path: string) => apiFetch<any>(supabase, path),
    post: (path: string, body: any) =>
      apiFetch<any>(supabase, path, { method: 'POST', body: JSON.stringify(body) }),
    patch: (path: string, body: any) =>
      apiFetch<any>(supabase, path, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (path: string) => apiFetch<any>(supabase, path, { method: 'DELETE' }),

    // Feedback System
    listFeedbacks: (filter?: 'all' | 'feature' | 'bug' | 'general' | 'content' | 'docs', sort?: 'newest' | 'votes') => {
      // We will perform client-side filtering/sorting for simplicity as we are fetching directly from supabase table via simple RLS
      // Actually, let's use the supabase client directly in the component for reading?
      // No, let's keep consistency and use apiFetch wrappers if we had a dedicated API endpoint. 
      // But for this task, since we modify schema directly, we can just use supabase client in the component for GETs.
      // However, to abstract it cleanly in api.ts as requested:
      let query = supabase.from('feedbacks').select('*, feedback_votes(user_id)'); 
      // Note: feedback_votes(user_id) allows us to check if current user voted.
      
      if (filter && filter !== 'all') query = query.eq('category', filter);
      if (sort === 'votes') query = query.order('votes', { ascending: false });
      else query = query.order('created_at', { ascending: false });
      
      return query;
    },
    createFeedback: (body: { title: string; description: string; category: string; user_id: string }) =>
      supabase.from('feedbacks').insert(body).select().single(),
    
    // Vote: toggle
    voteFeedback: async (feedbackId: string, currentVote: boolean) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      if (currentVote) {
        // Remove vote
        return supabase.from('feedback_votes').delete().match({ feedback_id: feedbackId, user_id: user.id });
      } else {
        // Add vote
        return supabase.from('feedback_votes').insert({ feedback_id: feedbackId, user_id: user.id });
      }
    },

    // Payment
    createCheckoutSession: (priceId: string, successUrl: string, cancelUrl: string) =>
      apiFetch<{ url: string }>(supabase, `/api/payment/create-checkout-session`, {
        method: 'POST',
        body: JSON.stringify({ priceId, successUrl, cancelUrl })
      }),
    
    getWalletBalance: () =>
      apiFetch<{ paidCoins: number; bonusCoins: number; total: number }>(supabase, `/api/payment/balance`),
      
    unlockChapter: (chapterId: string, cost: number) =>
      apiFetch<{ success: boolean; message: string }>(supabase, `/api/payment/unlock-chapter`, {
        method: 'POST',
        body: JSON.stringify({ chapterId, cost })
      }),
  };
}

export type SSEStartOptions = {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  onEvent: (evt: any) => void;
  onDone?: () => void;
  onError?: (err: Error) => void;
};

// Generic SSE hook for any endpoint that streams Server-Sent Events (data: {json})
export function useSSE() {
  const controllerRef = useRef<AbortController | null>(null);
  const [streaming, setStreaming] = useState(false);

  const stop = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setStreaming(false);
  }, []);

  const start = useCallback(async (opts: SSEStartOptions) => {
    const ctl = new AbortController();
    controllerRef.current = ctl;
    setStreaming(true);

    try {
      const res = await fetch(opts.url, {
        method: opts.method || 'POST',
        headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: ctl.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '');
        throw new Error(`SSE ${res.status}: ${text}`);
      }

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
            try { opts.onEvent(JSON.parse(data)); } catch {}
          }
        }
        opts.onDone?.();
      } finally {
        reader.releaseLock();
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') opts.onError?.(e);
    } finally {
      setStreaming(false);
    }
  }, []);

  return { start, stop, streaming } as const;
}
