import IORedis from 'ioredis';
import Groq from 'groq-sdk';
import { prisma } from '../db/prisma';

const redisUrl = process.env.UPSTASH_REDIS_URL || '';
export const redis = redisUrl ? new IORedis(redisUrl, { tls: redisUrl.startsWith('rediss://') ? {} : undefined }) : null;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

// Redis keys (scoped per chat)
const kWindow = (chatId: string) => `chat:window:${chatId}`; // list of JSON {role, content, ts}
const kSummary = (chatId: string) => `chat:summary:${chatId}`; // string
const kEmb = (chatId: string) => `chat:emb:${chatId}`; // list of JSON {role, content, ts, embedding?}

export async function saveChatMemory(chatId: string, role: 'user' | 'assistant', content: string) {
  // Persist a copy into Supabase (public.chat_embeddings); embedding left NULL for now
  void saveEmbeddingSupabase(chatId, role, content).catch(() => {});

  if (redis) {
    try {
      const item = JSON.stringify({ role, content, ts: Date.now() });
      await redis.rpush(kWindow(chatId), item);
      await redis.ltrim(kWindow(chatId), -500, -1); // keep last 500

      // Update rolling summary if needed
      try {
        const len = await redis.llen(kWindow(chatId));
        if (len > 120) {
          // Summarize last 200 items to keep the summary compact
          const raw = await redis.lrange(kWindow(chatId), Math.max(0, len - 200), -1);
          const text = raw.map((r) => {
            try { const o = JSON.parse(r); return `${o.role}: ${o.content}`; } catch { return ''; }
          }).join('\n');
          const sys = 'Summarize the following chat history into a concise context memo (<300 words). Keep key plot, characters, decisions. Do not include instructions.';
          const resp = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: sys },
              { role: 'user', content: text.slice(0, 12000) },
            ],
            temperature: 0.2,
          } as any);
          const summary = resp?.choices?.[0]?.message?.content || '';
          if (summary) await redis.set(kSummary(chatId), summary);
        }
      } catch {}
    } catch {}
  }
}

async function saveEmbeddingSupabase(chatId: string, role: 'user' | 'assistant', content: string) {
  // Write to public.chat_embeddings (created via SQL migration). Embedding column remains NULL.
  try {
    await prisma.$executeRawUnsafe(
      `insert into public.chat_embeddings (chat_id, role, content) values ($1::uuid, $2, $3)`,
      chatId,
      role,
      content.slice(0, 8000)
    );
  } catch {
    // best-effort
  }
  // Keep a lightweight copy in Redis to allow fast window retrieval if desired
  if (redis) {
    await redis.rpush(kEmb(chatId), JSON.stringify({ role, ts: Date.now(), content: content.slice(0, 2000) }));
    await redis.ltrim(kEmb(chatId), -2000, -1);
  }
}

export async function getSummary(chatId: string): Promise<string | null> {
  if (!redis) return null;
  return (await redis.get(kSummary(chatId))) || null;
}

// Retrieve relevant past turns. If vector embeddings are present and query embedding is provided (future work),
// use pgvector similarity. For now, fall back to simple keyword search.
export async function retrieveRelevant(chatId: string, query: string, limit = 5): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  const q = (query || '').trim();
  const terms = q.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 4).slice(0, 6);
  // Fallback: simple ILIKE OR on up to 6 terms, newest first
  try {
    if (terms.length === 0) {
      const rows: any[] = await prisma.$queryRawUnsafe(
        `select role, content from public.chat_embeddings where chat_id = $1::uuid order by created_at desc limit $2::int`,
        chatId,
        Math.max(3, limit)
      );
      return rows.map((r) => ({ role: r.role === 'assistant' ? 'assistant' : 'user', content: r.content }));
    }
    const likes = terms.map((_, i) => `content ilike $${i + 3}`).join(' or ');
    const params: any[] = [chatId, Math.max(3, limit), ...terms.map((t) => `%${t}%`)];
    const rows: any[] = await prisma.$queryRawUnsafe(
      `select role, content from public.chat_embeddings where chat_id = $1::uuid and (${likes}) order by created_at desc limit $2::int`,
      ...params
    );
    return rows.map((r) => ({ role: r.role === 'assistant' ? 'assistant' : 'user', content: r.content }));
  } catch {
    return [];
  }
}

export async function getLastAssistantDraft(chatId: string): Promise<string | null> {
  try {
    if (redis) {
      const len = await redis.llen(kWindow(chatId));
      const raw = await redis.lrange(kWindow(chatId), Math.max(0, len - 200), -1);
      const items = raw.map((r) => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean).reverse();
      for (const it of items as any[]) {
        if (!it || it.role !== 'assistant') continue;
        const t = String(it.content || '');
        if (t.length >= 500 && !/^\[[^\]]+\]/.test(t)) return t.slice(0, 20000);
      }
    }
  } catch {}
  try {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `select content from public.chat_embeddings where chat_id = $1::uuid and role = 'assistant' order by created_at desc limit 50`,
      chatId
    );
    for (const r of rows) {
      const t = String((r as any).content || '');
      if (t.length >= 500 && !/^\[[^\]]+\]/.test(t)) return t.slice(0, 20000);
    }
  } catch {}
  return null;
}
