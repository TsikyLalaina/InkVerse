"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
exports.saveChatMemory = saveChatMemory;
exports.getSummary = getSummary;
exports.retrieveRelevant = retrieveRelevant;
exports.getLastAssistantDraft = getLastAssistantDraft;
const ioredis_1 = __importDefault(require("ioredis"));
const groq_sdk_1 = __importDefault(require("groq-sdk"));
const prisma_1 = require("../db/prisma");
const redisUrl = process.env.UPSTASH_REDIS_URL || '';
exports.redis = redisUrl ? new ioredis_1.default(redisUrl, { tls: redisUrl.startsWith('rediss://') ? {} : undefined }) : null;
const groq = new groq_sdk_1.default({ apiKey: process.env.GROQ_API_KEY || '' });
// Redis keys (scoped per chat)
const kWindow = (chatId) => `chat:window:${chatId}`; // list of JSON {role, content, ts}
const kSummary = (chatId) => `chat:summary:${chatId}`; // string
const kEmb = (chatId) => `chat:emb:${chatId}`; // list of JSON {role, content, ts, embedding?}
async function saveChatMemory(chatId, role, content) {
    // Persist a copy into Supabase (public.chat_embeddings); embedding left NULL for now
    void saveEmbeddingSupabase(chatId, role, content).catch(() => { });
    if (exports.redis) {
        try {
            const item = JSON.stringify({ role, content, ts: Date.now() });
            await exports.redis.rpush(kWindow(chatId), item);
            await exports.redis.ltrim(kWindow(chatId), -500, -1); // keep last 500
            // Update rolling summary if needed
            try {
                const len = await exports.redis.llen(kWindow(chatId));
                if (len > 120) {
                    // Summarize last 200 items to keep the summary compact
                    const raw = await exports.redis.lrange(kWindow(chatId), Math.max(0, len - 200), -1);
                    const text = raw.map((r) => {
                        try {
                            const o = JSON.parse(r);
                            return `${o.role}: ${o.content}`;
                        }
                        catch {
                            return '';
                        }
                    }).join('\n');
                    const sys = 'Summarize the following chat history into a concise context memo (<300 words). Keep key plot, characters, decisions. Do not include instructions.';
                    const resp = await groq.chat.completions.create({
                        model: 'llama-3.3-70b-versatile',
                        messages: [
                            { role: 'system', content: sys },
                            { role: 'user', content: text.slice(0, 12000) },
                        ],
                        temperature: 0.2,
                    });
                    const summary = resp?.choices?.[0]?.message?.content || '';
                    if (summary)
                        await exports.redis.set(kSummary(chatId), summary);
                }
            }
            catch { }
        }
        catch { }
    }
}
async function saveEmbeddingSupabase(chatId, role, content) {
    // Write to public.chat_embeddings (created via SQL migration). Embedding column remains NULL.
    try {
        await prisma_1.prisma.$executeRawUnsafe(`insert into public.chat_embeddings (chat_id, role, content) values ($1::uuid, $2, $3)`, chatId, role, content.slice(0, 8000));
    }
    catch {
        // best-effort
    }
    // Keep a lightweight copy in Redis to allow fast window retrieval if desired
    if (exports.redis) {
        await exports.redis.rpush(kEmb(chatId), JSON.stringify({ role, ts: Date.now(), content: content.slice(0, 2000) }));
        await exports.redis.ltrim(kEmb(chatId), -2000, -1);
    }
}
async function getSummary(chatId) {
    if (!exports.redis)
        return null;
    return (await exports.redis.get(kSummary(chatId))) || null;
}
// Retrieve relevant past turns. If vector embeddings are present and query embedding is provided (future work),
// use pgvector similarity. For now, fall back to simple keyword search.
async function retrieveRelevant(chatId, query, limit = 5) {
    const q = (query || '').trim();
    const terms = q.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 4).slice(0, 6);
    // Fallback: simple ILIKE OR on up to 6 terms, newest first
    try {
        if (terms.length === 0) {
            const rows = await prisma_1.prisma.$queryRawUnsafe(`select role, content from public.chat_embeddings where chat_id = $1::uuid order by created_at desc limit $2::int`, chatId, Math.max(3, limit));
            return rows.map((r) => ({ role: r.role === 'assistant' ? 'assistant' : 'user', content: r.content }));
        }
        const likes = terms.map((_, i) => `content ilike $${i + 3}`).join(' or ');
        const params = [chatId, Math.max(3, limit), ...terms.map((t) => `%${t}%`)];
        const rows = await prisma_1.prisma.$queryRawUnsafe(`select role, content from public.chat_embeddings where chat_id = $1::uuid and (${likes}) order by created_at desc limit $2::int`, ...params);
        return rows.map((r) => ({ role: r.role === 'assistant' ? 'assistant' : 'user', content: r.content }));
    }
    catch {
        return [];
    }
}
async function getLastAssistantDraft(chatId) {
    try {
        if (exports.redis) {
            const len = await exports.redis.llen(kWindow(chatId));
            const raw = await exports.redis.lrange(kWindow(chatId), Math.max(0, len - 200), -1);
            const items = raw.map((r) => { try {
                return JSON.parse(r);
            }
            catch {
                return null;
            } }).filter(Boolean).reverse();
            for (const it of items) {
                if (!it || it.role !== 'assistant')
                    continue;
                const t = String(it.content || '');
                if (t.length >= 500 && !/^\[[^\]]+\]/.test(t))
                    return t.slice(0, 20000);
            }
        }
    }
    catch { }
    try {
        const rows = await prisma_1.prisma.$queryRawUnsafe(`select content from public.chat_embeddings where chat_id = $1::uuid and role = 'assistant' order by created_at desc limit 50`, chatId);
        for (const r of rows) {
            const t = String(r.content || '');
            if (t.length >= 500 && !/^\[[^\]]+\]/.test(t))
                return t.slice(0, 20000);
        }
    }
    catch { }
    return null;
}
//# sourceMappingURL=memory.js.map