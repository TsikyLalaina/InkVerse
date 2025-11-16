import type { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import Groq from 'groq-sdk';
import { buildSystemPromptForChat } from '../services/groq';
import { getSummary, saveChatMemory, retrieveRelevant, getLastAssistantDraft } from '../services/memory';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

const bodySchema = z.object({
  message: z.string().min(1),
  regeneratePanelId: z.string().uuid().optional(),
  clientMode: z.enum(['chat','action']).optional(),
  mentions: z.object({ chapter_number: z.coerce.number().int().min(1).optional(), title: z.string().min(1).optional() }).optional(),
});

const paramsByChat = z.object({ chatId: z.string().uuid() });

const chatRoutes: FastifyPluginCallback = (app, _opts, done) => {
  // List chat messages by chatId (ascending)
  app.get('/chat/:chatId/messages', async (req, reply) => {
    const user = (req as any).user;
    if (!user?.id) return reply.code(401).send({ error: 'Unauthorized' });

    const params = paramsByChat.parse(req.params);
    const chat = await (prisma as any).chat.findFirst({
      where: { id: params.chatId },
      select: { id: true, projectId: true, project: { select: { id: true, userId: true } } },
    } as any);
    if (!chat || (chat as any).project.userId !== user.id) return reply.code(404).send({ error: 'Not found' });

    const messages = await (prisma as any).chatMessage.findMany({
      where: { chatId: params.chatId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, content: true, panelId: true },
    } as any);
    return reply.send(messages);
  });

  // Stream chat by chatId
  app.post('/chat/:chatId', async (req, reply) => {
    const user = (req as any).user;
    if (!user?.id) return reply.code(401).send({ error: 'Unauthorized' });

    const params = paramsByChat.parse(req.params);
    const body = bodySchema.parse(req.body);

    const chatRow = await (prisma as any).chat.findFirst({
      where: { id: params.chatId },
      select: { id: true, type: true, projectId: true, project: { select: { id: true, userId: true, mode: true } } },
    } as any);
    if (!chatRow || (chatRow as any).project.userId !== user.id) return reply.code(404).send({ error: 'Not found' });
    const projectIdStr = (chatRow as any).projectId as string;
    const chatType = ((chatRow as any).type || 'plot') as 'plot' | 'character' | 'world';

    // Because we stream via reply.raw and end manually, Fastify hooks (like CORS) won't add headers.
    // Set essential headers explicitly for CORS + SSE.
    const origin = (req.headers as any).origin || '*';
    reply.raw.setHeader('Access-Control-Allow-Origin', origin);
    reply.raw.setHeader('Vary', 'Origin');
    reply.raw.setHeader('Access-Control-Expose-Headers', '*');
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');

    const send = (data: unknown) => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const userMsg = await (prisma as any).chatMessage.create({
        data: {
          chatId: params.chatId,
          role: 'user',
          content: body.message,
          panelId: body.regeneratePanelId ?? null,
        },
      } as any);
      // Save to long-term memory (best-effort)
      void saveChatMemory(params.chatId, 'user', body.message);

      const persistAssistant = async (text: string) => {
        try {
          const t = (text || '').trim();
          if (!t) return;
          await (prisma as any).chatMessage.create({
            data: { chatId: params.chatId, role: 'assistant', content: t, panelId: null },
          } as any);
          void saveChatMemory(params.chatId, 'assistant', t);
        } catch {}
      };

      const clientMode: 'chat' | 'action' = ((body as any).clientMode === 'action' ? 'action' : 'chat');
      const mentions = ((body as any).mentions || {}) as { chapter_number?: number; title?: string };
      let intent: 'none' | 'set_settings' | 'create_chapter' | 'convert_to_manhwa' | 'update_chapter' = 'none';
      let intentArgs: any = {};

      // --- Character/World helpers (strict JSON) ---
      const isObj = (v: any) => v && typeof v === 'object' && !Array.isArray(v);
      const deepMerge = (base: any, patch: any): any => {
        if (!isObj(base)) base = {};
        if (!isObj(patch)) return base;
        const out: any = Array.isArray(base) ? [...base] : { ...base };
        for (const k of Object.keys(patch)) {
          const pv = (patch as any)[k];
          const bv = (base as any)[k];
          if (Array.isArray(pv)) out[k] = pv.slice();
          else if (isObj(pv)) out[k] = deepMerge(isObj(bv) ? bv : {}, pv);
          else out[k] = pv;
        }
        return out;
      };
      const cleanStr = (v: any): string | undefined => {
        if (typeof v !== 'string') return undefined;
        const t = v.trim();
        return t.length ? t : undefined;
      };
      const deriveCharacterFromConversation = async (): Promise<{ name?: string; role?: string; summary?: string; traits?: any } | null> => {
        const sys = [
          'You are a helper that writes ONLY strict JSON for a Character object.',
          'Return ONLY a single JSON object with optional keys: { name, role, summary, traits }',
          'If the user indicates to "save", "apply", "commit", or "update" (synonyms), include ALL fields from the most recent assistant proposal, especially include full traits JSON. Do not omit traits.',
          'Merge any explicit new values from the user with the last assistant proposal; prefer explicit user changes.',
          'No prose, no code fences.',
        ].join('\n');
        const windowTurns = await (prisma as any).chatMessage.findMany({
          where: { chatId: params.chatId }, orderBy: { createdAt: 'desc' }, take: 40,
          select: { role: true, content: true },
        } as any).catch(() => []) as Array<{ role: string; content?: string }>;
        const recent = (windowTurns || []).reverse().map(t => `${t.role}: ${(t.content || '').slice(0, 400)}`).join('\n').slice(0, 8000);
        const usr = [`Message: ${body.message}`, recent ? `Recent chat:\n${recent}` : ''].filter(Boolean).join('\n');
        const resp = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile', temperature: 0,
          messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }],
        } as any);
        try { const parsed = JSON.parse(resp?.choices?.[0]?.message?.content || '{}'); return parsed && typeof parsed === 'object' ? parsed : null; } catch { return null; }
      };
      const deriveWorldFromConversation = async (): Promise<{ name?: string; summary?: string; traits?: any } | null> => {
        const sys = [
          'You are a helper that writes ONLY strict JSON for a World entry.',
          'Return ONLY a single JSON object with optional keys: { name, summary, traits }',
          'If the user indicates to "save", "apply", "commit", or "update" (synonyms), include ALL fields from the most recent assistant proposal, especially include full traits JSON. Do not omit traits.',
          'Merge any explicit new values from the user with the last assistant proposal; prefer explicit user changes.',
          'No prose, no code fences.',
        ].join('\n');
        const windowTurns = await (prisma as any).chatMessage.findMany({
          where: { chatId: params.chatId }, orderBy: { createdAt: 'desc' }, take: 40,
          select: { role: true, content: true },
        } as any).catch(() => []) as Array<{ role: string; content?: string }>;
        const recent = (windowTurns || []).reverse().map(t => `${t.role}: ${(t.content || '').slice(0, 400)}`).join('\n').slice(0, 8000);
        const usr = [`Message: ${body.message}`, recent ? `Recent chat:\n${recent}` : ''].filter(Boolean).join('\n');
        const resp = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile', temperature: 0,
          messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }],
        } as any);
        try { const parsed = JSON.parse(resp?.choices?.[0]?.message?.content || '{}'); return parsed && typeof parsed === 'object' ? parsed : null; } catch { return null; }
      };

      // Early handle character/world chats: derive + upsert or preview
      if (chatType === 'character') {
        const draft = await deriveCharacterFromConversation();
        if (draft && (draft.name || draft.summary || draft.role || draft.traits)) {
          if (clientMode === 'action') {
            // Upsert by name (case-insensitive)
            const name = (draft.name || mentions.title || '').trim();
            let saved: any = null;
            if (name) {
              const existing = await (prisma as any).character.findFirst({ where: { projectId: projectIdStr, name: { equals: name, mode: 'insensitive' } }, select: { id: true, traits: true } } as any);
              if (existing) {
                const mergedTraits = isObj(draft.traits) ? deepMerge((existing as any).traits || {}, draft.traits) : undefined;
                saved = await (prisma as any).character.update({
                  where: { id: (existing as any).id },
                  data: {
                    name: name || undefined,
                    role: cleanStr(draft.role),
                    summary: cleanStr(draft.summary),
                    traits: mergedTraits,
                  },
                } as any);
              } else {
                saved = await (prisma as any).character.create({
                  data: {
                    projectId: projectIdStr,
                    name: name || 'Unnamed',
                    role: cleanStr(draft.role) ?? null,
                    summary: cleanStr(draft.summary) ?? null,
                    traits: isObj(draft.traits) ? draft.traits : null,
                  },
                } as any);
              }
              send({ action: 'upsert_character', item: { id: saved.id, name: saved.name, role: saved.role, summary: saved.summary, traits: saved.traits } });
              await persistAssistant(`Character updated: ${saved.name}${saved.role ? ` (${saved.role})` : ''}.`);
            } else {
              send({ type: 'text', content: 'Character name is missing. Provide a name or include it in quotes like @"Name".' });
              await persistAssistant('Character name is missing. Provide a name or include it in quotes like @"Name".');
            }
          } else {
            const preview = Object.entries(draft).map(([k,v]) => `- ${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join('\n');
            send({ type: 'text', content: `Preview character (not applied in Chat mode):\n${preview}\n\nSwitch to Action mode to apply.` });
            await persistAssistant(`Preview character (not applied in Chat mode):\n${preview}\n\nSwitch to Action mode to apply.`);
          }
          send({ type: 'done' });
          reply.raw.end();
          return reply;
        }
      }
      if (chatType === 'world') {
        const draft = await deriveWorldFromConversation();
        if (draft && (draft.name || draft.summary || draft.traits)) {
          if (clientMode === 'action') {
            const name = (draft.name || mentions.title || '').trim();
            let saved: any = null;
            if (name) {
              const existing = await (prisma as any).worldSetting.findFirst({ where: { projectId: projectIdStr, name: { equals: name, mode: 'insensitive' } }, select: { id: true, traits: true } } as any);
              if (existing) {
                const mergedTraits = isObj(draft.traits) ? deepMerge((existing as any).traits || {}, draft.traits) : undefined;
                saved = await (prisma as any).worldSetting.update({
                  where: { id: (existing as any).id },
                  data: {
                    name: name || undefined,
                    summary: cleanStr(draft.summary),
                    traits: mergedTraits,
                  },
                } as any);
              } else {
                saved = await (prisma as any).worldSetting.create({
                  data: {
                    projectId: projectIdStr,
                    name: name || 'Untitled',
                    summary: cleanStr(draft.summary) ?? null,
                    traits: isObj(draft.traits) ? draft.traits : null,
                  },
                } as any);
              }
              send({ action: 'upsert_world', item: { id: saved.id, name: saved.name, summary: saved.summary, traits: saved.traits } });
              await persistAssistant(`World entry updated: ${saved.name}.`);
            } else {
              send({ type: 'text', content: 'World entry name is missing. Provide a name or include it in quotes like @"Name".' });
              await persistAssistant('World entry name is missing. Provide a name or include it in quotes like @"Name".');
            }
          } else {
            const preview = Object.entries(draft).map(([k,v]) => `- ${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join('\n');
            send({ type: 'text', content: `Preview world entry (not applied in Chat mode):\n${preview}\n\nSwitch to Action mode to apply.` });
            await persistAssistant(`Preview world entry (not applied in Chat mode):\n${preview}\n\nSwitch to Action mode to apply.`);
          }
          send({ type: 'done' });
          reply.raw.end();
          return reply;
        }
      }

      // Helper: derive settings changes from latest assistant response + recent chat window
      const deriveSettingsFromConversation = async (): Promise<Record<string, any> | null> => {
        // Build a unified system prompt
        const baseSystem = [
          'You are a helper that writes ONLY strict JSON for InkVerse settings.',
          'Output MUST be a single valid JSON object (no prose, no code fences).',
          'CRITICAL: Derive from BOTH the latest assistant response AND the recent chat transcript provided.',
          'Aggregate details across the whole window; ONLY prefer newer details when they conflict with older ones.',
          'Do not ask the user for JSON. Do not invent entities; omit unknowns.',
          'Schema (flexible):',
          '- Top-level keys (optional): "genre", "worldName", "coreConflict", "title", "settingsJson".',
          '- Put ALL additional information under "settingsJson" using nested objects/arrays as needed.',
          '- Examples inside settingsJson can include: "characters", "regions", "cities", "plot", "themes", "magicSystem", "technology".',
        ].join('\n');

        // Prefer the latest full assistant content (skip placeholders like [chapter draft ready])
        let lastAssistantText = '';
        try {
          const lastAList = await (prisma as any).chatMessage.findMany({
            where: { chatId: params.chatId, role: 'assistant' },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: { content: true },
          } as any);
          const pick = (lastAList || [])
            .map((m: { content?: string }) => m.content || '')
            .find((t: string) => t && !/^\s*\[[^\]]+\]/.test(t) && t.length >= 120);
          lastAssistantText = (pick || lastAList?.[0]?.content || '').slice(0, 4000);
        } catch {}

        // Recent chat window (bounded, expanded)
        let recentChat = '';
        try {
          const turns = await (prisma as any).chatMessage.findMany({
            where: { chatId: params.chatId },
            orderBy: { createdAt: 'desc' },
            take: 100,
            select: { role: true, content: true },
          } as any);
          const lines = (turns as Array<{ role: string; content?: string }>)
            .reverse()
            .map((t) => `${t.role}: ${(t.content || '').slice(0, 400)}`);
          recentChat = lines.join('\n').slice(0, 8000);
        } catch {}

        // Rolling summary for long conversations
        const rolling = await getSummary(params.chatId).catch(() => '') as string | '';

        // Retrieve relevant past snippets (keywords for settings)
        const rel = await retrieveRelevant(params.chatId, 'settings world coreConflict genre title characters plot themes magicSystem technology rules city region', 8);
        const relevantSnippets = (rel || []).map(r => `${r.role}: ${(r.content || '').slice(0, 400)}`).join('\n');

        const makeDraftUser = (variantNote: string) => [
          variantNote ? `[INSTRUCTION VARIANT] ${variantNote}` : '',
          `Message: ${body.message}`,
          lastAssistantText ? `Recent assistant preview:\n${lastAssistantText}` : '',
          rolling ? `Context summary:\n${rolling}` : '',
          recentChat ? `Recent chat (window):\n${recentChat}` : '',
          relevantSnippets ? `Relevant past snippets:\n${relevantSnippets}` : '',
        ].filter(Boolean).join('\n');

        const normalize = (proposed: any) => {
          const changes: any = {};
          if (typeof proposed?.genre === 'string') changes.genre = proposed.genre;
          // worldName removed from Project; ignore any proposed world name at project level
          if (typeof proposed?.coreConflict === 'string') changes.coreConflict = proposed.coreConflict;
          if (typeof proposed?.title === 'string') changes.title = proposed.title;
          if (proposed?.settingsJson && typeof proposed.settingsJson === 'object') changes.settingsJson = proposed.settingsJson;
          if (!changes.settingsJson && proposed?.settings && typeof proposed.settings === 'object') changes.settingsJson = proposed.settings;
          const reserved = new Set(['genre','worldName','world','coreConflict','title','settingsJson','settings','mode']);
          for (const k of Object.keys(proposed || {})) {
            if (!reserved.has(k)) {
              (changes.settingsJson ||= {});
              (changes.settingsJson as any)[k] = (proposed as any)[k];
            }
          }
          return Object.keys(changes).length > 0 ? changes : null;
        };

        const parseJsonFromText = (text: string): any => {
          let s = (text || '').trim();
          // Strip markdown code fences if present
          if (s.startsWith('```')) {
            s = s.replace(/^```(?:json)?\s*/i, '');
            const end = s.lastIndexOf('```');
            if (end >= 0) s = s.slice(0, end);
            s = s.trim();
          }
          // Try direct parse
          try { return JSON.parse(s); } catch {}
          // Extract first balanced JSON object
          const extractBalanced = (src: string, openChar: '{', closeChar: '}') => {
            const start = src.indexOf(openChar);
            if (start < 0) return null;
            let depth = 0, inStr = false, esc = false;
            for (let i = start; i < src.length; i++) {
              const ch = src[i];
              if (inStr) {
                if (esc) { esc = false; continue; }
                if (ch === '\\') { esc = true; continue; }
                if (ch === '"') inStr = false;
              } else {
                if (ch === '"') inStr = true;
                else if (ch === openChar) depth++;
                else if (ch === closeChar) {
                  depth--;
                  if (depth === 0) return src.slice(start, i + 1);
                }
              }
            }
            return null;
          };
          const obj = extractBalanced(s, '{', '}');
          if (obj) {
            try { return JSON.parse(obj); } catch {}
          }
          // If response is an array, try to parse first object
          try {
            const arr = JSON.parse(s);
            if (Array.isArray(arr) && arr.length && typeof arr[0] === 'object') return arr[0];
          } catch {}
          return {};
        };

        const attempt = async (system: string, user: string) => {
          const resp = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [ { role: 'system', content: system }, { role: 'user', content: user } ],
            temperature: 0,
          } as any);
          const raw = resp?.choices?.[0]?.message?.content || '{}';
          const proposed: any = parseJsonFromText(raw);
          return normalize(proposed);
        };

        // Try once with base system
        const first = await attempt(baseSystem, makeDraftUser('Use the provided context to produce settings.'));
        if (first) return first;

        // Retry with stricter formatting instruction
        const strictSystem = baseSystem + '\nABSOLUTE REQUIREMENT: Return ONLY a single JSON object. No markdown, no code fences, no commentary.';
        const second = await attempt(strictSystem, makeDraftUser('Return only JSON; aggregate details across all provided context.'));
        if (second) return second;

        // Heuristic fallback: extract from transcript when model fails
        try {
          const transcript = [lastAssistantText, recentChat].filter(Boolean).join('\n\n');
          const lines = transcript.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
          const txt = transcript;
          const changes: any = { };
          const sj: any = {};

          const grab = (re: RegExp) => {
            const m = re.exec(txt);
            return m ? (m[1] || m[0]).trim() : '';
          };
          const grabLine = (label: string) => {
            const re = new RegExp(`^\s*${label}\s*[:\-]\s*(.+)$`, 'im');
            const m = re.exec(txt);
            return m ? m[1].trim() : '';
          };

          // Title
          const title1 = grabLine('Title');
          if (title1) changes.title = title1.replace(/^"|"$/g, '');

          // World / worldName
          const world1 = grabLine('World');
          if (world1) changes.worldName = world1.replace(/^"|"$/g, '');
          if (!changes.worldName) {
            const m = /(world|city|realm)\s+(?:called|named)\s+([A-Z][A-Za-z0-9'\- ]{2,50})/i.exec(txt);
            if (m) changes.worldName = m[2].trim();
          }

          // City
          const city1 = grabLine('City');
          if (city1) sj.city = city1.replace(/^"|"$/g, '');

          // Magic system
          const magic1 = grabLine('Magic system');
          if (magic1) sj.magicSystem = magic1;

          // Creatures
          const creatures1 = grabLine('Creatures');
          if (creatures1) sj.creatures = creatures1;

          // Politics
          const politics1 = grabLine('Politics');
          if (politics1) sj.politics = politics1;

          // Core conflict: look for explicit label, else X vs. Y
          const cc1 = grabLine('Core conflict');
          if (cc1) changes.coreConflict = cc1;
          if (!changes.coreConflict) {
            const m = /([A-Z][A-Za-z'\- ]{2,40})\s+vs\.\s+([A-Z][A-Za-z'\- ]{2,40})([^\n\r]*)/i.exec(txt);
            if (m) changes.coreConflict = `${m[1].trim()} vs. ${m[2].trim()}${m[3] ? m[3].trim() : ''}`.trim();
          }

          // Genre
          const genre1 = grabLine('Genre');
          if (genre1) changes.genre = genre1;

          // Main Character block
          const mcName = grab(/\bName\s*[:\-]\s*([^\n\r*]+)/i);
          const mcAge = grab(/\bAge\s*[:\-]\s*(\d{1,3})/i);
          const mcOcc = grab(/\bOccupation\s*[:\-]\s*([^\n\r*]+)/i);
          if (mcName || mcAge || mcOcc) {
            sj.mainCharacter = {} as any;
            if (mcName) sj.mainCharacter.name = mcName;
            if (mcAge) sj.mainCharacter.age = Number(mcAge);
            if (mcOcc) sj.mainCharacter.occupation = mcOcc;
          }

          if (Object.keys(sj).length) changes.settingsJson = sj;
          return Object.keys(changes).length ? changes : null;
        } catch {
          return null;
        }
      };

      // AI Intent Classification (non-streamed, strict JSON)
      try {
        const summaryForCls = await getSummary(params.chatId);
        const clsSystem = [
          'You are an intent classifier for InkVerse chat. Return ONLY strict JSON.',
          'Schema: { "action": "set_settings|create_chapter|convert_to_manhwa|update_chapter|none", "args": object|null, "confidence": number }',
          'Rules:',
          '- set_settings when user wants to update settings (e.g., genre, coreConflict, settingsJson). Treat synonyms like "save", "apply", "commit", or "update" (even without explicit field names) as set_settings if recent assistant output proposed settings.',
          '- create_chapter when user asks to write/draft/create a chapter.',
          '- update_chapter when user asks to rewrite/revise/edit an existing chapter. args can include { chapter_number?: number, title?: string }',
          '- convert_to_manhwa when user asks to convert text into panel script or generate panels.',
          '- none otherwise.',
          'Return only JSON, no prose.'
        ].join('\n');
        const clsUser = [
          `Message: ${body.message}`,
          summaryForCls ? `Context summary: ${summaryForCls}` : '',
        ].filter(Boolean).join('\n');
        const clsResp = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [ { role: 'system', content: clsSystem }, { role: 'user', content: clsUser } ],
          temperature: 0,
        } as any);
        const raw = clsResp?.choices?.[0]?.message?.content || '{}';
        let parsed: any = {};
        try { parsed = JSON.parse(raw); } catch {}
        const action = String(parsed?.action || 'none');
        const confidence = Number(parsed?.confidence ?? 0);

        if (confidence >= 0.6) {
          if (action === 'set_settings') {
            const changes = await deriveSettingsFromConversation();
            if (changes) {
              if (clientMode === 'action') {
                send({ action: 'confirm_settings', changes });
                const preview = Object.entries(changes).map(([k,v]) => `- ${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join('\n');
                await persistAssistant(`Proposed settings (confirm to apply):\n${preview}`);
              } else {
                const preview = Object.entries(changes).map(([k,v]) => `- ${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join('\n');
                send({ type: 'text', content: `Preview settings (not applied in Chat mode):\n${preview}\n\nSwitch to Action mode to apply.` });
                await persistAssistant(`Preview settings (not applied in Chat mode):\n${preview}\n\nSwitch to Action mode to apply.`);
              }
              send({ type: 'done' });
              reply.raw.end();
              return reply;
            }
          }
          if (action === 'create_chapter') {
            intent = 'create_chapter';
            intentArgs = {};
          }
          if (action === 'convert_to_manhwa') {
            intent = 'convert_to_manhwa';
            intentArgs = {};
          }
          if (action === 'update_chapter') {
            intent = 'update_chapter';
            intentArgs = {};
          }
        }
      } catch {}

      // Save-previous-draft (pre-stream): user switches to Action mode and says "save the chapter"
      try {
        const raw = body.message.trim();
        const lower = raw.toLowerCase();
        const wantsSaveDraft = /(save|persist|apply|commit)\b/.test(lower) && /(chapter|draft|scene|it|this)\b/.test(lower);
        if (wantsSaveDraft) {
          const draft = await getLastAssistantDraft(params.chatId);
          if (!draft) {
            if (((body as any).clientMode === 'action')) {
              send({ type: 'text', content: 'No prior chapter draft found to save.' });
              await persistAssistant('No prior chapter draft found to save.');
            } else {
              const txt = 'No prior chapter draft found. Ask me to write a chapter first in Chat mode, then switch to Action mode and say "save the chapter".';
              send({ type: 'text', content: txt });
              await persistAssistant(txt);
            }
            send({ type: 'done' });
            reply.raw.end();
            return reply;
          }

          let chapterNumber: number | undefined = (typeof mentions.chapter_number === 'number' ? mentions.chapter_number : undefined);
          let chapterTitle: string | undefined = (typeof mentions.title === 'string' ? mentions.title : undefined);

          if (!chapterNumber || !chapterTitle) {
            try {
              const recentUsers = await (prisma as any).chatMessage.findMany({
                where: { chatId: params.chatId, role: 'user' },
                orderBy: { createdAt: 'desc' },
                take: 30,
                select: { content: true },
              } as any);
              for (const u of recentUsers) {
                const src = (u.content || '').trim();
                const m = /(write|draft|create)\s+chapter(?:\s+(\d+))?[:\-\s]*([^\n\r]*)/i.exec(src);
                if (m) {
                  if (!chapterNumber && m[2]) chapterNumber = parseInt(m[2], 10);
                  const t = (m[3] || '').trim().replace(/^"|"$/g, '');
                  if (!chapterTitle && t) chapterTitle = t;
                  break;
                }
              }
            } catch {}
          }

          if (!chapterTitle) {
            const header = draft.split('\n').slice(0, 5).join(' ');
            const h1 = /^#\s+(.+?)\s*$/.exec(draft.split('\n')[0] || '');
            if (h1?.[1]) chapterTitle = h1[1].trim();
            if (!chapterTitle) {
              const ch = /chapter\s+(\d+)[\s:—-]*([^\n\r]*)/i.exec(header);
              if (ch) {
                if (!chapterNumber && ch[1]) chapterNumber = parseInt(ch[1], 10);
                const rest = (ch[2] || '').trim();
                if (rest) chapterTitle = rest.replace(/^"|"$/g, '');
              }
            }
          }

          if (!chapterTitle && chapterNumber) chapterTitle = `Chapter ${chapterNumber}`;
          if (!chapterTitle) chapterTitle = 'Untitled Chapter';

          // Resolve existing chapter by number (index) or exact title match
          let targetId: string | undefined;
          try {
            const chapters = await prisma.chapter.findMany({
              where: { projectId: projectIdStr },
              orderBy: { createdAt: 'asc' },
              select: { id: true, title: true },
            });
            if (typeof chapterNumber === 'number' && chapterNumber >= 1 && chapters[chapterNumber - 1]) {
              targetId = chapters[chapterNumber - 1].id;
            }
            if (!targetId && chapterTitle) {
              const lc = chapterTitle.toLowerCase();
              const m = chapters.find(c => (c.title || '').toLowerCase() === lc);
              if (m) targetId = m.id;
            }
          } catch {}

          const clientMode: 'chat' | 'action' = ((body as any).clientMode === 'action' ? 'action' : 'chat');
          // Try to refine the draft by matching embeddings with chapter number/title
          let matchedDraft = draft;
          try {
            const terms: string[] = [];
            if (typeof chapterNumber === 'number') terms.push(`chapter ${chapterNumber}`);
            if (chapterTitle) terms.push(chapterTitle);
            if (terms.length) {
                  const likeConds = terms.map((_, i) => `content ilike $${i + 3}`).join(' or ');
              const sqlParams: any[] = [params.chatId, 3, ...terms.map((t) => `%${t}%`)];
              const rows: any[] = await prisma.$queryRawUnsafe(
                `select content from public.chat_embeddings where chat_id = $1::uuid and role = 'assistant' and (${likeConds}) order by created_at desc limit $2::int`,
                ...sqlParams
              );
              const pick = (rows || [])
                .map((r) => String((r as any).content || ''))
                .find((t: string) => t && t.length >= 300 && !/^\[[^\]]+\]/.test(t));
              if (pick) matchedDraft = pick;
            }
          } catch {}
          // Sanitize: strip any leading [MODE] tag accidentally included in content
          try {
            matchedDraft = (matchedDraft || '').replace(/^\s*\[MODE\][^\n]*\n?/i, '').trim();
          } catch {}

          if (clientMode === 'action') {
            // Persist to DB immediately for reliability
            try {
              if (targetId) {
                await prisma.chapter.update({ where: { id: targetId }, data: { title: chapterTitle, content: matchedDraft } });
                send({ action: 'update_chapter', id: targetId, chapter_number: chapterNumber, title: chapterTitle, content: matchedDraft });
                await persistAssistant(`Updated chapter${chapterNumber ? ` ${chapterNumber}` : ''}${chapterTitle ? `: "${chapterTitle}"` : ''}.`);
              } else {
                const created = await prisma.chapter.create({ data: { projectId: projectIdStr, title: chapterTitle, content: matchedDraft } });
                send({ action: 'create_chapter', id: created.id, title: chapterTitle, content: matchedDraft, chapter_number: chapterNumber });
                await persistAssistant(`Created chapter${chapterNumber ? ` ${chapterNumber}` : ''}${chapterTitle ? `: "${chapterTitle}"` : ''}.`);
              }
            } catch (e: any) {
              send({ type: 'error', message: e?.message || 'Failed to persist chapter' });
              await persistAssistant(`Error: ${e?.message || 'Failed to persist chapter'}`);
            }
          } else {
            const op = targetId ? 'update' : 'create';
            const preview = `Will ${op} ${chapterNumber ? `Chapter ${chapterNumber}` : 'a chapter'}${chapterTitle ? ` titled \"${chapterTitle}\"` : ''} from the prior draft. Switch to Action mode to apply.`;
            send({ type: 'text', content: preview });
            await persistAssistant(preview);
          }
          send({ type: 'done' });
          reply.raw.end();
          return reply;
        }
      } catch {}

      // Save settings request: generate structured JSON from conversation (no user JSON required)
      try {
        const rawText = body.message.trim();
        const wantsSave = /\b(save|set)\b.*\b(settings)\b/i.test(rawText) || /\bset\s+current\s+settings\b/i.test(rawText) || /\bgenerate\b.*\bsettings\b/i.test(rawText);
        if (wantsSave) {
          const changes = await deriveSettingsFromConversation();
          if (changes) {
            if (clientMode === 'action') {
              send({ action: 'confirm_settings', changes });
            } else {
              const preview = Object.entries(changes).map(([k,v]) => `- ${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join('\n');
              send({ type: 'text', content: `Preview settings (not applied in Chat mode):\n${preview}\n\nSwitch to Action mode to apply.` });
            }
            send({ type: 'done' });
            reply.raw.end();
            return reply;
          }
          send({ type: 'error', message: 'Failed to derive settings from recent conversation.' });
          send({ type: 'done' });
          reply.raw.end();
          return reply;
        }
      } catch {}

      // Lightweight intent detection
      const rawMsg = body.message.trim();
      const msg = rawMsg.toLowerCase();
      const regexConvert = /(convert\s+chapter|generate\s+panels|panel\s+script)/i.test(msg);
      const regexWrite = /\b(write|draft|create)\s+(?:\w+\s+)?chapter\b/i.test(rawMsg);
      const regexRewrite = /\b(rewrite|revise|edit)\s+(?:the\s+)?chapter\b/i.test(rawMsg);
      const isConvert = intent === 'convert_to_manhwa' || regexConvert;
      const isWriteChapter = intent === 'create_chapter' || regexWrite;
      const isUpdateChapter = intent === 'update_chapter' || regexRewrite;

      // Build prioritized context with DB truth (settings), target chapter (full), other chapters (summaries), then chat
      // Prepare chapters
      const chapters = await prisma.chapter.findMany({
        where: { projectId: projectIdStr },
        orderBy: { createdAt: 'asc' },
        select: { id: true, title: true, content: true, createdAt: true },
      });
      const resolveByNumber = (n?: number | null) => {
        if (!n || n < 1) return null;
        return chapters[n - 1] || null;
      };
      const resolveByTitle = (t?: string | null) => {
        if (!t) return null;
        const lc = t.trim().toLowerCase();
        return chapters.find(c => (c.title || '').toLowerCase() === lc) || null;
      };
      const target = resolveByNumber(mentions.chapter_number ?? null) || resolveByTitle(mentions.title ?? null) || null;
      const summarize = (txt?: string | null, max = 600) => {
        const t = (txt || '').replace(/\s+/g, ' ').trim();
        if (!t) return '';
        return t.length <= max ? t : t.slice(0, max) + '…';
      };

      const basePrompt = await buildSystemPromptForChat(projectIdStr, chatType);
      const rolling = await getSummary(params.chatId);
      const ctxParts: string[] = [];
      const jsonBlocks: string[] = [];

      // In plot chats, detect referenced characters/world and inject only their full JSON
      if (chatType === 'plot') {
        const win = await (prisma as any).chatMessage.findMany({
          where: { chatId: params.chatId }, orderBy: { createdAt: 'desc' }, take: 20,
          select: { role: true, content: true },
        } as any).catch(() => []) as Array<{ role: string; content?: string }>;
        const transcript = (win || []).reverse().map(t => `${t.role}: ${(t.content || '').slice(0, 400)}`).join('\n').slice(0, 8000);
        const sys = [
          'Extract referenced entity names from the prompt and short transcript.',
          'Return ONLY JSON object: { "characters": string[], "world": string[] }',
          'Rules: list names explicitly mentioned or clearly implied targets. No prose, no code fences.',
        ].join('\n');
        const usr = [`Prompt: ${body.message}`, transcript ? `Transcript:\n${transcript}` : ''].filter(Boolean).join('\n');
        let refNames: { characters: string[]; world: string[] } = { characters: [], world: [] };
        try {
          const resp = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile', temperature: 0,
            messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }],
          } as any);
          const txt = resp?.choices?.[0]?.message?.content || '{}';
          const parsed = JSON.parse(txt);
          if (parsed && typeof parsed === 'object') {
            refNames.characters = Array.isArray(parsed.characters) ? parsed.characters.filter((s: any) => typeof s === 'string') : [];
            refNames.world = Array.isArray(parsed.world) ? parsed.world.filter((s: any) => typeof s === 'string') : [];
          }
        } catch {}

        // Resolve to DB entries (case-insensitive by name)
        const pickUnique = <T extends { id: string }>(arr: T[]) => {
          const seen = new Set<string>();
          const out: T[] = [];
          for (const it of arr) { if (!seen.has(it.id)) { seen.add(it.id); out.push(it); } }
          return out;
        };

        const selChars: any[] = [];
        for (const nm of (refNames.characters || []).slice(0, 8)) {
          const name = String(nm || '').trim(); if (!name) continue;
          const found = await (prisma as any).character.findFirst({
            where: { projectId: projectIdStr, name: { equals: name, mode: 'insensitive' } },
            select: { id: true, name: true, role: true, summary: true, traits: true, imageUrl: true },
          } as any).catch(() => null);
          if (found) selChars.push(found);
        }
        const selWorld: any[] = [];
        for (const nm of (refNames.world || []).slice(0, 8)) {
          const name = String(nm || '').trim(); if (!name) continue;
          const found = await (prisma as any).worldSetting.findFirst({
            where: { projectId: projectIdStr, name: { equals: name, mode: 'insensitive' } },
            select: { id: true, name: true, summary: true, traits: true, images: true },
          } as any).catch(() => null);
          if (found) selWorld.push(found);
        }
        const uniqChars = pickUnique(selChars);
        const uniqWorld = pickUnique(selWorld);
        if (uniqChars.length) jsonBlocks.push(`[CHARACTERS JSON]\n${JSON.stringify(uniqChars).slice(0, 120000)}`);
        if (uniqWorld.length) jsonBlocks.push(`[WORLD JSON]\n${JSON.stringify(uniqWorld).slice(0, 120000)}`);
      }
      ctxParts.push('CONTEXT PRIORITY: DB truth (settings, chapters list) is authoritative. Use DB truth and explicit mentions over chat. Do NOT perform writes unless clientMode=action. Do NOT claim a chapter exists/saved unless it appears in the DB chapters list below.');
      ctxParts.push(`[MODE] ${clientMode}`);
      ctxParts.push(`[DB CHAPTERS COUNT] ${chapters.length}`);
      if (chapters.length) {
        ctxParts.push('[DB CHAPTERS]');
        chapters.forEach((c, i) => {
          ctxParts.push(`- ${i + 1}. ${c.title || 'Untitled'}`);
        });
      }
      ctxParts.push('REPORTING RULE: When asked how many chapters are written/saved, answer EXACTLY with the number in [DB CHAPTERS COUNT]. When listing saved chapters, use [DB CHAPTERS]. Do NOT count drafts discussed in chat unless they appear in the DB list.');
      if (target) {
        ctxParts.push('[TARGET CHAPTER FULL]');
        ctxParts.push(`title=${target.title || 'Untitled'}`);
        ctxParts.push(`content=\n${(target.content || '').slice(0, 8000)}`);
      }
      if (chapters.length) {
        ctxParts.push('[OTHER CHAPTERS SUMMARY]');
        for (const c of chapters) {
          if (target && c.id === target.id) continue;
          ctxParts.push(`- ${c.title || 'Untitled'}: ${summarize(c.content)}`);
        }
      }
      const systemPrompt = (rolling ? `${basePrompt}\n\nContext Summary (rolling):\n${rolling}` : basePrompt)
        + (jsonBlocks.length ? `\n\n${jsonBlocks.join('\n\n')}` : '')
        + `\n\n[CHAT TYPE] ${chatType}\n${ctxParts.join('\n')}`;

      // Short-term memory: load last 20 messages as context
      const history = await (prisma as any).chatMessage.findMany({
        where: { chatId: params.chatId },
        orderBy: { createdAt: 'asc' },
        take: 20,
        select: { role: true, content: true },
      } as any);

      // Retrieval: pull top relevant past turns from Supabase (keyword/pgvector fallback)
      const relevant = await retrieveRelevant(params.chatId, body.message, 5);

      const groqMessages = [
        { role: 'system', content: systemPrompt },
        // Map DB roles to Groq roles
        ...history.map((m: { role: string; content: string }) => ({ role: (m.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user', content: m.content })),
        // Add retrieved relevant snippets (dedup naturally by model input)
        ...relevant.map((m) => ({ role: m.role, content: m.content } as { role: 'assistant' | 'user'; content: string })),
        { role: 'user', content: body.message },
      ];

      const stream = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: groqMessages as any,
        stream: true,
        temperature: 0.7,
      });

      let assistantText = '';

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content || '';
        if (!delta) continue;
        assistantText += delta;
        // Only stream text to chat when not creating/convert action (classifier intent takes precedence)
        if (clientMode !== 'action' || (!isWriteChapter && !isConvert && !isUpdateChapter)) {
          send({ type: 'text', content: delta });
        }
      }

      const assistantMsg = await (prisma as any).chatMessage.create({
        data: {
          chatId: params.chatId,
          role: 'assistant',
          // Store full text only if it was conversational; otherwise keep a short summary
          content: (isWriteChapter || isConvert || isUpdateChapter)
            ? (isConvert ? '[convert_to_manhwa proposal ready]' : (isWriteChapter ? '[chapter draft ready]' : '[chapter rewrite ready]'))
            : assistantText,
          panelId: body.regeneratePanelId ?? null,
        },
      } as any);
      // Save assistant text to long-term memory (store actual text, not placeholder)
      void saveChatMemory(params.chatId, 'assistant', assistantText);

      // Structured action event
      if (isConvert) {
        // Send a conversion action; client can persist panel_script accordingly
        if (clientMode === 'action') {
          send({ action: 'convert_to_manhwa', panel_script: assistantText });
        }
      } else if (isWriteChapter) {
        // Novel chapter creation requested
        const m = /write\s+chapter(?:\s+(\d+))?[:\-\s]*(.*)$/i.exec(rawMsg);
        const chNum = m?.[1];
        const rest = (m?.[2] || '').trim();
        const inferred = rest || (chNum ? `Chapter ${chNum}` : (mentions.chapter_number ? `Chapter ${mentions.chapter_number}` : 'Untitled Chapter'));
        if (clientMode === 'action') {
          send({ action: 'create_chapter', title: inferred, content: assistantText });
        }
      } else if (isUpdateChapter) {
        // Try to infer chapter number or title from the prompt
        let chapterNumber: number | undefined;
        let chapterTitle: string | undefined;
        const mNum = /(rewrite|revise|edit)\s+(?:the\s+)?chapter\s+(\d+)/i.exec(rawMsg);
        if (mNum?.[2]) chapterNumber = parseInt(mNum[2], 10);
        const mTitle = /"([^"]+)"/.exec(rawMsg);
        if (mTitle?.[1]) chapterTitle = mTitle[1];
        if (!chapterNumber && mentions.chapter_number) chapterNumber = mentions.chapter_number;
        if (!chapterTitle && mentions.title) chapterTitle = mentions.title;
        if (clientMode === 'action') {
          send({ action: 'update_chapter', chapter_number: chapterNumber, title: chapterTitle, content: assistantText });
        }
      }

      if (body.regeneratePanelId) {
        const url = process.env.UPSTASH_REDIS_URL || '';
        if (url) {
          const connection = new IORedis(url, { tls: url.startsWith('rediss://') ? {} : undefined });
          const queue = new Queue('image-generation', { connection });
          await queue.add('generate', {
            projectId: projectIdStr,
            panelId: body.regeneratePanelId,
            prompt: assistantText,
            userId: user.id,
          });
          send({ type: 'image_job', status: 'queued', panelId: body.regeneratePanelId });
        }
      }

      send({ type: 'done', messageId: assistantMsg.id });
      reply.raw.end();
    } catch (err: any) {
      send({ type: 'error', message: err?.message || 'Unexpected error' });
      reply.raw.end();
    }

    return reply; // keep Fastify happy
  });

  done();
};

export default chatRoutes;
