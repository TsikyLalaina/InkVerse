import type { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';
import Groq from 'groq-sdk';
import { buildSystemPrompt } from '../services/groq';
import { prisma } from '../db/prisma';
import crypto from 'crypto';
import { createQueue, isQueueConfigured, connection as redis } from '../services/queue';
import { generateImage } from '../services/fal';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

const imageQueue = isQueueConfigured() ? createQueue('fal-image') : null;

function hash(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

const textBody = z.object({
  prompt: z.string().min(1),
  projectId: z.string().uuid(),
});

const imageBody = z.object({
  description: z.string().min(1),
  style: z.string().optional(),
  projectId: z.string().uuid().optional(),
});

const generateRoutes: FastifyPluginCallback = (app, _opts, done) => {
  // POST /generate/text -> SSE stream
  app.post('/generate/text', async (req, reply) => {
    const user = (req as any).user;
    if (!user?.id) return reply.code(401).send({ error: 'Unauthorized' });

    const body = textBody.parse(req.body);

    // Verify project ownership
    const project = await prisma.project.findFirst({ where: { id: body.projectId, userId: user.id } });
    if (!project) return reply.code(404).send({ error: 'Project not found' });

    // Add CORS for raw SSE stream
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

    const cacheKey = `gen:text:${project.id}:${hash(body.prompt)}`;

    try {
      // Cache hit -> stream cached once (best-effort)
      try {
        if (redis) {
          const cached = await redis.get(cacheKey);
          if (cached) {
            send({ type: 'text', content: cached });
            send({ type: 'done' });
            reply.raw.end();
            return reply;
          }
        }
      } catch {}

      // Muse prompt aligned with chat/action policy
      const basePrompt = await buildSystemPrompt(project.id);
      const systemPrompt = basePrompt;

      const stream = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: body.prompt },
        ],
        stream: true,
        temperature: 0.7,
      });

      let full = '';
      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content || '';
        if (delta) {
          full += delta;
          send({ type: 'text', content: delta });
        }
      }

      // Cache response (best-effort)
      try { if (redis) await redis.setex(cacheKey, 60 * 60, full); } catch {}

      send({ type: 'done' });
      reply.raw.end();
    } catch (err: any) {
      send({ type: 'error', message: err?.message || 'Unexpected error' });
      reply.raw.end();
    }

    return reply;
  });

  // POST /generate/image -> enqueue Fal job
  app.post('/generate/image', async (req, reply) => {
    const user = (req as any).user;
    if (!user?.id) return reply.code(401).send({ error: 'Unauthorized' });

    const body = imageBody.parse(req.body);
    const keyBase = `${body.description}|${body.style || ''}`;
    const cacheKey = `gen:image:job:${hash(keyBase)}`;

    // If queue is unavailable, fall back to synchronous generation via Fal and persist via Prisma (Supabase Postgres)
    if (!imageQueue) {
      try {
        // Optional: verify project if provided
        if (body.projectId) {
          const owns = await prisma.project.findFirst({ where: { id: body.projectId, userId: user.id }, select: { id: true } });
          if (!owns) return reply.code(404).send({ error: 'Project not found' });
        }

        const url = await generateImage(body.description, { style: body.style || undefined });

        const jobId = `direct:${hash(url)}`;
        return reply.send({ jobId, url, queued: false });
      } catch (e: any) {
        return reply.code(500).send({ error: 'Direct Fal generate failed', detail: e?.message || '' });
      }
    }

    // Return cached job id if exists to dedupe (best-effort)
    if (redis) {
      try {
        const cachedJobId = await redis.get(cacheKey);
        if (cachedJobId) {
          return reply.send({ jobId: cachedJobId, cached: true });
        }
      } catch (e: any) {
        return reply.code(429).send({ error: 'Image queue rate limited (Redis)', detail: e?.message || '' });
      }
    }

    // Optional: verify project if provided
    if (body.projectId) {
      const owns = await prisma.project.findFirst({ where: { id: body.projectId, userId: user.id }, select: { id: true } });
      if (!owns) return reply.code(404).send({ error: 'Project not found' });
    }

    const webhookBase = process.env.WEBHOOK_BASE_URL || '';
    let job;
    try {
      job = await imageQueue.add('fal.flux-schnell', {
        provider: 'fal',
        model: 'fal-ai/flux/schnell',
        description: body.description,
        style: body.style || null,
        userId: user.id,
        projectId: body.projectId || null,
        webhookUrl: webhookBase ? `${webhookBase.replace(/\/$/, '')}/webhook/fal` : '/webhook/fal',
      });
    } catch (e: any) {
      return reply.code(429).send({ error: 'Failed to enqueue image job (Redis rate limit)', detail: e?.message || '' });
    }

    const jobId = typeof job.id === 'string' || typeof job.id === 'number' ? String(job.id) : undefined;
    if (!jobId) {
      return reply.code(500).send({ error: 'Failed to enqueue image job (no id)' });
    }

    try { if (redis) await redis.setex(cacheKey, 10 * 60, jobId); } catch {}

    return reply.send({ jobId });
  });

  done();
};

export default generateRoutes;

// Public webhook plugin for Fal callbacks
export const webhookPlugin: FastifyPluginCallback = (app, _opts, done) => {
  app.post('/webhook/fal', async (req, reply) => {
    try {
      const payload = req.body as any;
      const jobId: string | undefined = payload?.jobId || payload?.id;
      if (jobId && redis) {
        const key = `fal:result:${jobId}`;
        await redis.setex(key, 24 * 60 * 60, JSON.stringify(payload));
      }
    } catch (e) {
      // swallow errors, respond 200 to avoid retries storms
    }
    return reply.send({ ok: true });
  });
  done();
};
