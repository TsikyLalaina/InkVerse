"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookPlugin = void 0;
const zod_1 = require("zod");
const groq_sdk_1 = __importDefault(require("groq-sdk"));
const groq_1 = require("../services/groq");
const prisma_1 = require("../db/prisma");
const crypto_1 = __importDefault(require("crypto"));
const queue_1 = require("../services/queue");
const fal_1 = require("../services/fal");
const groq = new groq_sdk_1.default({ apiKey: process.env.GROQ_API_KEY || '' });
const imageQueue = (0, queue_1.isQueueConfigured)() ? (0, queue_1.createQueue)('fal-image') : null;
function hash(input) {
    return crypto_1.default.createHash('sha256').update(input).digest('hex');
}
const textBody = zod_1.z.object({
    prompt: zod_1.z.string().min(1),
    projectId: zod_1.z.string().uuid(),
});
const imageBody = zod_1.z.object({
    description: zod_1.z.string().min(1),
    style: zod_1.z.string().optional(),
    projectId: zod_1.z.string().uuid().optional(),
});
const generateRoutes = (app, _opts, done) => {
    // POST /generate/text -> SSE stream
    app.post('/generate/text', async (req, reply) => {
        const user = req.user;
        if (!user?.id)
            return reply.code(401).send({ error: 'Unauthorized' });
        const body = textBody.parse(req.body);
        // Verify project ownership
        const project = await prisma_1.prisma.project.findFirst({ where: { id: body.projectId, userId: user.id } });
        if (!project)
            return reply.code(404).send({ error: 'Project not found' });
        // Add CORS for raw SSE stream
        const origin = req.headers.origin || '*';
        reply.raw.setHeader('Access-Control-Allow-Origin', origin);
        reply.raw.setHeader('Vary', 'Origin');
        reply.raw.setHeader('Access-Control-Expose-Headers', '*');
        reply.raw.setHeader('Content-Type', 'text/event-stream');
        reply.raw.setHeader('Cache-Control', 'no-cache');
        reply.raw.setHeader('Connection', 'keep-alive');
        const send = (data) => {
            reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
        };
        const cacheKey = `gen:text:${project.id}:${hash(body.prompt)}`;
        try {
            // Cache hit -> stream cached once (best-effort)
            try {
                if (queue_1.connection) {
                    const cached = await queue_1.connection.get(cacheKey);
                    if (cached) {
                        send({ type: 'text', content: cached });
                        send({ type: 'done' });
                        reply.raw.end();
                        return reply;
                    }
                }
            }
            catch { }
            // Muse prompt aligned with chat/action policy
            const basePrompt = await (0, groq_1.buildSystemPrompt)(project.id);
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
            try {
                if (queue_1.connection)
                    await queue_1.connection.setex(cacheKey, 60 * 60, full);
            }
            catch { }
            send({ type: 'done' });
            reply.raw.end();
        }
        catch (err) {
            send({ type: 'error', message: err?.message || 'Unexpected error' });
            reply.raw.end();
        }
        return reply;
    });
    // POST /generate/image -> enqueue Fal job
    app.post('/generate/image', async (req, reply) => {
        const user = req.user;
        if (!user?.id)
            return reply.code(401).send({ error: 'Unauthorized' });
        const body = imageBody.parse(req.body);
        const keyBase = `${body.description}|${body.style || ''}`;
        const cacheKey = `gen:image:job:${hash(keyBase)}`;
        // If queue is unavailable, fall back to synchronous generation via Fal and persist via Prisma (Supabase Postgres)
        if (!imageQueue) {
            try {
                // Optional: verify project if provided
                if (body.projectId) {
                    const owns = await prisma_1.prisma.project.findFirst({ where: { id: body.projectId, userId: user.id }, select: { id: true } });
                    if (!owns)
                        return reply.code(404).send({ error: 'Project not found' });
                }
                const url = await (0, fal_1.generateImage)(body.description, { style: body.style || undefined });
                const jobId = `direct:${hash(url)}`;
                return reply.send({ jobId, url, queued: false });
            }
            catch (e) {
                return reply.code(500).send({ error: 'Direct Fal generate failed', detail: e?.message || '' });
            }
        }
        // Return cached job id if exists to dedupe (best-effort)
        if (queue_1.connection) {
            try {
                const cachedJobId = await queue_1.connection.get(cacheKey);
                if (cachedJobId) {
                    return reply.send({ jobId: cachedJobId, cached: true });
                }
            }
            catch (e) {
                return reply.code(429).send({ error: 'Image queue rate limited (Redis)', detail: e?.message || '' });
            }
        }
        // Optional: verify project if provided
        if (body.projectId) {
            const owns = await prisma_1.prisma.project.findFirst({ where: { id: body.projectId, userId: user.id }, select: { id: true } });
            if (!owns)
                return reply.code(404).send({ error: 'Project not found' });
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
        }
        catch (e) {
            return reply.code(429).send({ error: 'Failed to enqueue image job (Redis rate limit)', detail: e?.message || '' });
        }
        const jobId = typeof job.id === 'string' || typeof job.id === 'number' ? String(job.id) : undefined;
        if (!jobId) {
            return reply.code(500).send({ error: 'Failed to enqueue image job (no id)' });
        }
        try {
            if (queue_1.connection)
                await queue_1.connection.setex(cacheKey, 10 * 60, jobId);
        }
        catch { }
        return reply.send({ jobId });
    });
    done();
};
exports.default = generateRoutes;
// Public webhook plugin for Fal callbacks
const webhookPlugin = (app, _opts, done) => {
    app.post('/webhook/fal', async (req, reply) => {
        try {
            const payload = req.body;
            const jobId = payload?.jobId || payload?.id;
            if (jobId && queue_1.connection) {
                const key = `fal:result:${jobId}`;
                await queue_1.connection.setex(key, 24 * 60 * 60, JSON.stringify(payload));
            }
        }
        catch (e) {
            // swallow errors, respond 200 to avoid retries storms
        }
        return reply.send({ ok: true });
    });
    done();
};
exports.webhookPlugin = webhookPlugin;
//# sourceMappingURL=generate.js.map