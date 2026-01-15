"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const prisma_1 = require("../db/prisma");
const supabase_js_1 = require("@supabase/supabase-js");
const expAwarder_1 = require("../utils/expAwarder");
const projectExporter_1 = require("../utils/projectExporter");
const ChatTypeEnum = zod_1.z.enum(['plot', 'character', 'world']);
const sbUrl = process.env.SUPABASE_URL;
const sbServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = (sbUrl && sbServiceKey) ? (0, supabase_js_1.createClient)(sbUrl, sbServiceKey) : null;
function parseSupabasePublicUrl(url) {
    try {
        const idx = url.indexOf('/storage/v1/object/public/');
        if (idx === -1)
            return null;
        const rest = url.slice(idx + '/storage/v1/object/public/'.length);
        const firstSlash = rest.indexOf('/');
        if (firstSlash === -1)
            return null;
        const bucket = rest.slice(0, firstSlash);
        const path = rest.slice(firstSlash + 1);
        if (!bucket || !path)
            return null;
        return { bucket, path };
    }
    catch {
        return null;
    }
}
const uuidParam = zod_1.z.object({ id: zod_1.z.string().uuid() });
const createBody = zod_1.z.object({ title: zod_1.z.string().min(1), description: zod_1.z.string().optional() });
const ModeEnum = zod_1.z.enum(['novel', 'manhwa', 'convert']);
const updateBody = zod_1.z.object({ title: zod_1.z.string().min(1).optional(), description: zod_1.z.string().optional(), mode: ModeEnum.optional() }).refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });
const settingsBody = zod_1.z.object({
    title: zod_1.z.string().min(1).optional(),
    description: zod_1.z.string().optional(),
    coverImage: zod_1.z.string().optional().transform(v => {
        if (!v || v.trim() === '')
            return undefined;
        // Only accept valid URLs
        try {
            new URL(v);
            return v;
        }
        catch {
            return undefined;
        }
    }),
    cover_image: zod_1.z.string().optional().transform(v => {
        if (!v || v.trim() === '')
            return undefined;
        try {
            new URL(v);
            return v;
        }
        catch {
            return undefined;
        }
    }),
    genres: zod_1.z.array(zod_1.z.string()).optional(),
    coreConflict: zod_1.z.string().optional(),
    settingsJson: zod_1.z.any().optional(),
    mode: ModeEnum.optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'No settings provided' });
const createChapterBody = zod_1.z.object({
    title: zod_1.z.string().min(1),
    content: zod_1.z.string().optional(),
    panel_script: zod_1.z.any().optional(),
    branchId: zod_1.z.string().uuid().optional(),
    isCanon: zod_1.z.boolean().optional(),
});
const traitsOp = zod_1.z.object({ op: zod_1.z.enum(['set', 'delete']), path: zod_1.z.array(zod_1.z.string().min(1)), value: zod_1.z.any().optional() });
const characterCreateBody = zod_1.z.object({
    name: zod_1.z.string().min(1),
    role: zod_1.z.string().optional(),
    summary: zod_1.z.string().optional(),
    images: zod_1.z.array(zod_1.z.string().url()).optional(),
    traits: zod_1.z.any().optional(),
    traitsOps: zod_1.z.array(traitsOp).optional(),
});
const characterUpdateBody = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    role: zod_1.z.string().optional(),
    summary: zod_1.z.string().optional(),
    images: zod_1.z.array(zod_1.z.string().url()).optional(),
    traits: zod_1.z.any().optional(),
    traitsOps: zod_1.z.array(traitsOp).optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });
const routes = (app, _opts, done) => {
    app.get('/project', async (req, reply) => {
        const user = req.user;
        if (!user?.id)
            return reply.code(401).send({ error: 'Unauthorized' });
        const projects = await prisma_1.prisma.project.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
            select: { id: true, title: true, description: true, createdAt: true, mode: true, coverImage: true, genres: true, visibility: true, publicSlug: true },
        });
        return reply.send(projects);
    });
    // --- Chats (per project) ---
    app.get('/project/:id/chats', async (req, reply) => {
        const params = uuidParam.parse(req.params);
        const user = req.user;
        if (!user?.id)
            return reply.code(401).send({ error: 'Unauthorized' });
        const project = await prisma_1.prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
        if (!project)
            return reply.code(404).send({ error: 'Not found' });
        const chats = await prisma_1.prisma.chat.findMany({
            where: { projectId: project.id },
            orderBy: { createdAt: 'asc' },
            select: { id: true, type: true, title: true, createdAt: true, updatedAt: true },
        });
        return reply.send(chats);
    });
    app.post('/project/:id/chats', async (req, reply) => {
        const params = uuidParam.parse(req.params);
        const user = req.user;
        if (!user?.id)
            return reply.code(401).send({ error: 'Unauthorized' });
        const body = zod_1.z.object({ type: ChatTypeEnum, title: zod_1.z.string().optional() }).parse(req.body);
        const project = await prisma_1.prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
        if (!project)
            return reply.code(404).send({ error: 'Not found' });
        // Default title using total count only (avoid touching enum column to bypass casting issues)
        const totalChats = await prisma_1.prisma.chat.count({ where: { projectId: project.id } });
        const defaultTitle = body.type === 'plot' ? `Plot Chat ${totalChats + 1}` : (body.type === 'character' ? `Character Chat ${totalChats + 1}` : `World Chat ${totalChats + 1}`);
        const created = await prisma_1.prisma.chat.create({
            data: { projectId: project.id, type: body.type, title: (body.title && body.title.trim()) || defaultTitle },
            select: { id: true, type: true, title: true, createdAt: true },
        });
        return reply.code(201).send(created);
    });
    app.patch('/project/:id/chats/:chatId', async (req, reply) => {
        const params = zod_1.z.object({ id: zod_1.z.string().uuid(), chatId: zod_1.z.string().uuid() }).parse(req.params);
        const user = req.user;
        if (!user?.id)
            return reply.code(401).send({ error: 'Unauthorized' });
        const body = zod_1.z.object({ title: zod_1.z.string().min(1) }).parse(req.body);
        const project = await prisma_1.prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
        if (!project)
            return reply.code(404).send({ error: 'Not found' });
        const updated = await prisma_1.prisma.chat.updateMany({ where: { id: params.chatId, projectId: project.id }, data: { title: body.title } });
        if (!updated.count)
            return reply.code(404).send({ error: 'Not found' });
        const result = await prisma_1.prisma.chat.findFirst({ where: { id: params.chatId }, select: { id: true, type: true, title: true, updatedAt: true } });
        return reply.send(result);
    });
    app.delete('/project/:id/chats/:chatId', async (req, reply) => {
        const params = zod_1.z.object({ id: zod_1.z.string().uuid(), chatId: zod_1.z.string().uuid() }).parse(req.params);
        const user = req.user;
        if (!user?.id)
            return reply.code(401).send({ error: 'Unauthorized' });
        const project = await prisma_1.prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
        if (!project)
            return reply.code(404).send({ error: 'Not found' });
        const del = await prisma_1.prisma.chat.deleteMany({ where: { id: params.chatId, projectId: project.id } });
        if (!del.count)
            return reply.code(404).send({ error: 'Not found' });
        return reply.code(204).send();
    });
    // Create a chapter under a project (moved outside GET handler)
    app.post('/project/:id/chapter', async (req, reply) => {
        const params = uuidParam.parse(req.params);
        const user = req.user;
        if (!user?.id)
            return reply.code(401).send({ error: 'Unauthorized' });
        const project = await prisma_1.prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
        if (!project)
            return reply.code(404).send({ error: 'Not found' });
        const body = createChapterBody.parse(req.body);
        const chapter = await prisma_1.prisma.chapter.create({
            data: {
                projectId: project.id,
                title: body.title,
                content: body.content ?? '',
                // @ts-ignore: panelScript is Json field
                panelScript: body.panel_script ?? undefined,
                // @ts-ignore
                price: body.price ?? 0,
                branchId: body.branchId ?? null,
                // @ts-ignore
                isCanon: body.isCanon ?? true,
            },
            select: { id: true, title: true, createdAt: true },
        });
        // Award EXP for creating a chapter
        try {
            const wordCount = (0, expAwarder_1.countWords)(body.content ?? '');
            await (0, expAwarder_1.awardExpForAction)(user.id, 'CREATE_CHAPTER', { wordCount });
        }
        catch (err) {
            req.log.warn({ err }, 'Failed to award EXP for chapter creation');
        }
        return reply.code(201).send(chapter);
    });
    // Update a chapter's title/content/panel_script
    app.patch('/project/:id/chapter/:chapterId', async (req, reply) => {
        const params = zod_1.z.object({ id: zod_1.z.string().uuid(), chapterId: zod_1.z.string().uuid() }).parse(req.params);
        const user = req.user;
        if (!user?.id)
            return reply.code(401).send({ error: 'Unauthorized' });
        const project = await prisma_1.prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
        if (!project)
            return reply.code(404).send({ error: 'Not found' });
        const body = zod_1.z.object({
            title: zod_1.z.string().min(1).optional(),
            content: zod_1.z.string().optional(),
            panel_script: zod_1.z.any().optional(),
            price: zod_1.z.number().int().min(0).optional(),
        }).refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' }).parse(req.body);
        const updated = await prisma_1.prisma.chapter.updateMany({
            where: { id: params.chapterId, projectId: project.id },
            data: {
                title: body.title ?? undefined,
                content: body.content ?? undefined,
                // @ts-ignore
                panelScript: body.panel_script ?? undefined,
                // @ts-ignore
                price: body.price ?? undefined,
            },
        });
        if (updated.count === 0)
            return reply.code(404).send({ error: 'Not found' });
        const ch = await prisma_1.prisma.chapter.findFirst({ where: { id: params.chapterId, projectId: project.id }, select: { id: true, title: true, content: true, panelScript: true } });
        // Award EXP for updating chapter content
        try {
            if (body.content) {
                const wordCount = (0, expAwarder_1.countWords)(body.content);
                await (0, expAwarder_1.awardExpForAction)(user.id, 'UPDATE_CHAPTER', { wordCount });
            }
        }
        catch (err) {
            req.log.warn({ err }, 'Failed to award EXP for chapter update');
        }
        return reply.send(ch);
    });
    app.delete('/project/:id/chapter/:chapterId', async (req, reply) => {
        const params = zod_1.z.object({ id: zod_1.z.string().uuid(), chapterId: zod_1.z.string().uuid() }).parse(req.params);
        const user = req.user;
        if (!user?.id)
            return reply.code(401).send({ error: 'Unauthorized' });
        const project = await prisma_1.prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
        if (!project)
            return reply.code(404).send({ error: 'Not found' });
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            await tx.chatMessage.updateMany({ where: { panelId: params.chapterId }, data: { panelId: null } });
            await tx.branch.updateMany({ where: { baseChapterId: params.chapterId }, data: { baseChapterId: null } });
            const del = await tx.chapter.deleteMany({ where: { id: params.chapterId, projectId: project.id } });
            return del.count;
        });
        if (result === 0)
            return reply.code(404).send({ error: 'Not found' });
        return reply.code(204).send();
    });
    // --- World Settings CRUD ---
    const worldCreateBody = zod_1.z.object({
        name: zod_1.z.string().min(1),
        summary: zod_1.z.string().optional(),
        traits: zod_1.z.any().optional(),
        traitsOps: zod_1.z.array(traitsOp).optional(),
        images: zod_1.z.array(zod_1.z.string().url()).optional(),
    });
    const worldUpdateBody = zod_1.z.object({
        name: zod_1.z.string().min(1).optional(),
        summary: zod_1.z.string().optional(),
        traits: zod_1.z.any().optional(),
        traitsOps: zod_1.z.array(traitsOp).optional(),
        images: zod_1.z.array(zod_1.z.string().url()).optional(),
    }).refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });
    app.get('/project/:id/world', async (req, reply) => {
        const params = uuidParam.parse(req.params);
        const user = req.user;
        if (!user?.id)
            return reply.code(401).send({ error: 'Unauthorized' });
        const project = await prisma_1.prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
        if (!project)
            return reply.code(404).send({ error: 'Not found' });
        const items = await prisma_1.prisma.worldSetting.findMany({
            where: { projectId: project.id },
            orderBy: { createdAt: 'asc' },
            select: { id: true, name: true, summary: true, traits: true, images: true, createdAt: true, updatedAt: true },
        });
        return reply.send(items);
    });
    app.post('/project/:id/world', async (req, reply) => {
        const params = uuidParam.parse(req.params);
        const user = req.user;
        if (!user?.id)
            return reply.code(401).send({ error: 'Unauthorized' });
        const project = await prisma_1.prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
        if (!project)
            return reply.code(404).send({ error: 'Not found' });
        const body = worldCreateBody.parse(req.body);
        try {
            req.log?.info?.({ route: 'world.create', projectId: params.id, hasImages: Array.isArray(body.images), imagesCount: (body.images || []).length }, 'World CREATE start');
        }
        catch { }
        let traits = undefined;
        if (Array.isArray(body.traitsOps) && body.traitsOps.length)
            traits = applyTraitsOps({}, body.traitsOps);
        else if (body.traits !== undefined)
            traits = body.traits;
        const created = await prisma_1.prisma.worldSetting.create({
            data: { projectId: project.id, name: body.name, summary: body.summary ?? null, traits: traits ?? null, images: (body.images ?? null) },
            select: { id: true, name: true, summary: true, traits: true, images: true, createdAt: true },
        });
        try {
            req.log?.info?.({ route: 'world.create', id: created.id }, 'World CREATE done');
        }
        catch { }
        // Award EXP for creating a world setting
        try {
            await (0, expAwarder_1.awardExpForAction)(user.id, 'CREATE_WORLD_SETTING');
        }
        catch (err) {
            req.log.warn({ err }, 'Failed to award EXP for world setting creation');
        }
        return reply.code(201).send(created);
    });
    app.patch('/project/:id/world/:wsId', async (req, reply) => {
        const params = zod_1.z.object({ id: zod_1.z.string().uuid(), wsId: zod_1.z.string().uuid() }).parse(req.params);
        const user = req.user;
        if (!user?.id)
            return reply.code(401).send({ error: 'Unauthorized' });
        const project = await prisma_1.prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
        if (!project)
            return reply.code(404).send({ error: 'Not found' });
        const body = worldUpdateBody.parse(req.body);
        try {
            req.log?.info?.({ route: 'world.patch', projectId: params.id, id: params.wsId, hasImages: body.images !== undefined, imagesCount: (body.images || []).length }, 'World PATCH start');
        }
        catch { }
        const existing = await prisma_1.prisma.worldSetting.findFirst({ where: { id: params.wsId, projectId: project.id }, select: { traits: true, images: true } });
        if (!existing)
            return reply.code(404).send({ error: 'Not found' });
        let traits = undefined;
        if (Array.isArray(body.traitsOps) && body.traitsOps.length)
            traits = applyTraitsOps(existing.traits || {}, body.traitsOps);
        else if (body.traits !== undefined)
            traits = body.traits;
        const updated = await prisma_1.prisma.worldSetting.updateMany({
            where: { id: params.wsId, projectId: project.id },
            data: {
                name: body.name ?? undefined,
                summary: body.summary ?? undefined,
                traits: traits === undefined ? undefined : traits,
                images: body.images === undefined ? undefined : (body.images ?? null),
            },
        });
        try {
            req.log?.info?.({ route: 'world.patch', id: params.wsId, updatedCount: updated.count }, 'World PATCH updated');
        }
        catch { }
        if (!updated.count)
            return reply.code(404).send({ error: 'Not found' });
        // Best-effort: remove deleted images from Supabase storage (server-side)
        if (Array.isArray(existing?.images)) {
            if (Array.isArray(body.images)) {
                const prevImages = existing.images || [];
                const nextSet = new Set(body.images);
                const removed = prevImages.filter((u) => !nextSet.has(u));
                if (removed.length && supabaseAdmin) {
                    for (const u of removed) {
                        try {
                            const parsed = parseSupabasePublicUrl(u);
                            if (parsed) {
                                await supabaseAdmin.storage.from(parsed.bucket).remove([parsed.path]);
                            }
                        }
                        catch { }
                    }
                }
            }
        }
        const result = await prisma_1.prisma.worldSetting.findFirst({ where: { id: params.wsId, projectId: project.id }, select: { id: true, name: true, summary: true, traits: true, images: true, updatedAt: true } });
        try {
            req.log?.info?.({ route: 'world.patch', id: params.wsId }, 'World PATCH done');
        }
        catch { }
        return reply.send(result);
    });
    app.delete('/project/:id/world/:wsId', async (req, reply) => {
        const params = zod_1.z.object({ id: zod_1.z.string().uuid(), wsId: zod_1.z.string().uuid() }).parse(req.params);
        const user = req.user;
        if (!user?.id)
            return reply.code(401).send({ error: 'Unauthorized' });
        const project = await prisma_1.prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
        if (!project)
            return reply.code(404).send({ error: 'Not found' });
        try {
            const existing = await prisma_1.prisma.worldSetting.findFirst({ where: { id: params.wsId, projectId: project.id }, select: { images: true } });
            const imgs = Array.isArray(existing?.images) ? existing.images : [];
            if (imgs.length && supabaseAdmin) {
                for (const u of imgs) {
                    try {
                        const parsed = parseSupabasePublicUrl(u);
                        if (parsed) {
                            await supabaseAdmin.storage.from(parsed.bucket).remove([parsed.path]);
                        }
                    }
                    catch { }
                }
            }
        }
        catch { }
        const del = await prisma_1.prisma.worldSetting.deleteMany({ where: { id: params.wsId, projectId: project.id } });
        if (!del.count)
            return reply.code(404).send({ error: 'Not found' });
        return reply.code(204).send();
    });
    app.post('/project', async (req, reply) => {
        const body = createBody.parse(req.body);
        const user = req.user;
        if (!user?.id)
            return reply.code(401).send({ error: 'Unauthorized' });
        const project = await prisma_1.prisma.project.create({
            data: {
                userId: user.id,
                title: body.title,
                description: body.description ?? null,
            },
            select: { id: true },
        });
        // Award EXP for creating a project
        try {
            await (0, expAwarder_1.awardExpForAction)(user.id, 'CREATE_PROJECT');
        }
        catch (err) {
            req.log.warn({ err }, 'Failed to award EXP for project creation');
        }
        return reply.code(201).send(project);
    });
    app.get('/project/:id', async (req, reply) => {
        const params = uuidParam.parse(req.params);
        const user = req.user;
        if (!user?.id)
            return reply.code(401).send({ error: 'Unauthorized' });
        try {
            const project = await prisma_1.prisma.project.findFirst({
                where: { id: params.id, userId: user.id },
                // Select top-level fields and include light related data
                select: {
                    id: true,
                    title: true,
                    description: true,
                    coverImage: true,
                    // @ts-ignore optional columns depending on schema
                    mode: true,
                    // @ts-ignore
                    genres: true,
                    // @ts-ignore
                    coreConflict: true,
                    // @ts-ignore
                    settingsJson: true,
                    chapters: { take: 10, orderBy: { createdAt: 'desc' } },
                    branches: { take: 10, orderBy: { createdAt: 'desc' } },
                },
            });
            if (!project)
                return reply.code(404).send({ error: 'Not found' });
            return reply.send(project);
        }
        catch (_err) {
            const project = await prisma_1.prisma.project.findFirst({
                where: { id: params.id, userId: user.id },
                select: {
                    id: true,
                    title: true,
                    description: true,
                    coverImage: true,
                    // @ts-ignore optional columns depending on schema
                    mode: true,
                    // @ts-ignore
                    genres: true,
                    // @ts-ignore
                    coreConflict: true,
                    // @ts-ignore
                    settingsJson: true,
                    chapters: { take: 10, orderBy: { createdAt: 'desc' } },
                    branches: { take: 10, orderBy: { createdAt: 'desc' } },
                },
            });
            if (!project)
                return reply.code(404).send({ error: 'Not found' });
            return reply.send(project);
        }
    });
    app.patch('/project/:id', async (req, reply) => {
        const params = uuidParam.parse(req.params);
        const body = updateBody.parse(req.body);
        const user = req.user;
        if (!user?.id)
            return reply.code(401).send({ error: 'Unauthorized' });
        const existing = await prisma_1.prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
        if (!existing)
            return reply.code(404).send({ error: 'Not found' });
        const updated = await prisma_1.prisma.project.update({
            where: { id: params.id },
            data: {
                title: body.title ?? undefined,
                description: body.description ?? undefined,
                // Apply mode when column exists
                // @ts-ignore - if column not present yet, Prisma will error at runtime
                mode: body.mode ?? undefined,
            },
            select: { id: true, title: true, description: true },
        });
        // Try to include mode in response if available
        try {
            const withMode = await prisma_1.prisma.project.findFirst({ where: { id: params.id }, select: { id: true, title: true, description: true, mode: true } });
            return reply.send(withMode || updated);
        }
        catch {
            return reply.send(updated);
        }
    });
    app.delete('/project/:id', async (req, reply) => {
        const params = uuidParam.parse(req.params);
        const user = req.user;
        if (!user?.id)
            return reply.code(401).send({ error: 'Unauthorized' });
        const result = await prisma_1.prisma.project.deleteMany({ where: { id: params.id, userId: user.id } });
        if (result.count === 0)
            return reply.code(404).send({ error: 'Not found' });
        return reply.code(204).send();
    });
    // Update project settings and log history (defined at plugin registration time)
    app.patch('/project/:id/settings', async (req, reply) => {
        const params = uuidParam.parse(req.params);
        const user = req.user;
        if (!user?.id)
            return reply.code(401).send({ error: 'Unauthorized' });
        const body = settingsBody.parse(req.body);
        const existing = await prisma_1.prisma.project.findFirst({ where: { id: params.id, userId: user.id } });
        if (!existing)
            return reply.code(404).send({ error: 'Not found' });
        const data = {};
        if (body.title !== undefined)
            data.title = body.title;
        if (body.description !== undefined)
            data.description = body.description;
        if (body.coverImage !== undefined)
            data.coverImage = body.coverImage;
        if (body.cover_image !== undefined)
            data.coverImage = body.cover_image;
        if (body.genres !== undefined)
            data.genres = body.genres;
        if (body.coreConflict !== undefined)
            data.coreConflict = body.coreConflict;
        if (body.settingsJson !== undefined) {
            const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
            const incoming = body.settingsJson;
            const current = existing?.settingsJson;
            if (isObj(incoming) && isObj(current)) {
                data.settingsJson = { ...current, ...incoming };
            }
            else {
                data.settingsJson = incoming;
            }
        }
        if (body.mode !== undefined)
            data.mode = body.mode;
        const updated = await prisma_1.prisma.project.update({
            where: { id: params.id },
            data: {
                ...data,
                // @ts-ignore
                updatedAt: new Date(),
            },
            select: {
                id: true,
                title: true,
                description: true,
                coverImage: true,
                // @ts-ignore
                mode: true,
                // @ts-ignore
                genres: true,
                // @ts-ignore
                coreConflict: true,
                // @ts-ignore
                settingsJson: true,
                // @ts-ignore
                updatedAt: true,
            },
        });
        // Log history (best-effort)
        try {
            await prisma_1.prisma.settingHistory.create({
                data: {
                    projectId: params.id,
                    userId: user.id,
                    changes: body,
                },
            });
        }
        catch { }
        return reply.send(updated);
    });
    // Paginated chapters for reader (ascending by createdAt)
    app.get('/project/:id/chapters', async (req, reply) => {
        const params = uuidParam.parse(req.params);
        const user = req.user;
        const qp = zod_1.z.object({
            page: zod_1.z.coerce.number().int().min(0).default(0),
            limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
        }).parse(req.query || {});
        // Owner access if authenticated
        let accessProject = null;
        if (user?.id) {
            accessProject = await prisma_1.prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true, userId: true } });
        }
        // Public access if not owner
        if (!accessProject) {
            const pub = await prisma_1.prisma.project.findFirst({ where: { id: params.id, visibility: 'public' }, select: { id: true, userId: true } });
            if (!pub)
                return reply.code(404).send({ error: 'Not found' });
            accessProject = pub;
        }
        const total = await prisma_1.prisma.chapter.count({ where: { projectId: accessProject.id, ...(user?.id ? {} : { isCanon: true }) } });
        const items = await prisma_1.prisma.chapter.findMany({
            where: { projectId: accessProject.id, ...(user?.id ? {} : { isCanon: true }) },
            orderBy: { createdAt: 'asc' },
            skip: qp.page * qp.limit,
            take: qp.limit,
            // @ts-ignore
            select: { id: true, title: true, content: true, panelScript: true, createdAt: true, price: true },
        });
        // Post-process to mask content if locked
        if (!user?.id && items.some(i => i.price > 0)) {
            // Anonymous users can't see paid chapters
            items.forEach((i) => {
                if (i.price > 0) {
                    i.content = "LOCKED_CONTENT";
                    i.panelScript = null;
                }
            });
        }
        else if (user?.id) {
            // Check which are unlocked
            const paidChapters = items.filter((i) => i.price > 0).map(i => i.id);
            req.log.info({ paidChaptersCount: paidChapters.length, userId: user.id }, 'Checking paid chapters access');
            if (paidChapters.length > 0) {
                const unlocked = await prisma_1.prisma.unlockedContent.findMany({
                    where: {
                        userId: user.id,
                        chapterId: { in: paidChapters }
                    },
                    select: { chapterId: true }
                });
                const unlockedIds = new Set(unlocked.map(u => u.chapterId));
                const projectInfo = await prisma_1.prisma.project.findUnique({ where: { id: params.id }, select: { userId: true } });
                const isOwner = projectInfo?.userId === user.id;
                req.log.info({ isOwner, unlockedCount: unlockedIds.size, projectOwner: projectInfo?.userId }, 'Access check details');
                if (!isOwner) {
                    items.forEach((i) => {
                        if (i.price > 0 && !unlockedIds.has(i.id)) {
                            // Formatting log to confirm masking happens
                            req.log.info({ chapterId: i.id }, 'Masking locked chapter content');
                            i.content = "LOCKED_CONTENT";
                            i.panelScript = null;
                        }
                    });
                }
            }
        }
        return reply.send({ items, total });
    });
    // Lightweight chapter summary for previews
    app.get('/project/:id/chapters/summary', async (req, reply) => {
        const params = uuidParam.parse(req.params);
        const user = req.user;
        if (!user?.id)
            return reply.code(401).send({ error: 'Unauthorized' });
        const project = await prisma_1.prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
        if (!project)
            return reply.code(404).send({ error: 'Not found' });
        const count = await prisma_1.prisma.chapter.count({ where: { projectId: project.id } });
        const firstText = await prisma_1.prisma.chapter.findFirst({
            where: { projectId: project.id, content: { not: '' } },
            orderBy: { createdAt: 'asc' },
            select: { content: true },
        });
        return reply.send({ count, snippet: (firstText?.content || '') });
    });
    // --- Characters CRUD ---
    function applyTraitsOps(base, ops) {
        const root = (base && typeof base === 'object') ? JSON.parse(JSON.stringify(base)) : {};
        const setAt = (obj, path, val) => {
            let curr = obj;
            for (let i = 0; i < path.length - 1; i++) {
                const k = path[i];
                if (!curr[k] || typeof curr[k] !== 'object')
                    curr[k] = {};
                curr = curr[k];
            }
            curr[path[path.length - 1]] = val;
        };
        const delAt = (obj, path) => {
            let curr = obj;
            for (let i = 0; i < path.length - 1; i++) {
                const k = path[i];
                if (!curr[k] || typeof curr[k] !== 'object')
                    return;
                curr = curr[k];
            }
            delete curr[path[path.length - 1]];
        };
        for (const op of ops || []) {
            const p = (op.path || []).filter(Boolean);
            if (!p.length)
                continue;
            if (op.op === 'set')
                setAt(root, p, op.value);
            else if (op.op === 'delete')
                delAt(root, p);
        }
        return root;
    }
    app.get('/project/:id/characters', async (req, reply) => {
        const params = uuidParam.parse(req.params);
        const user = req.user;
        if (!user?.id)
            return reply.code(401).send({ error: 'Unauthorized' });
        const project = await prisma_1.prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
        if (!project)
            return reply.code(404).send({ error: 'Not found' });
        const items = await prisma_1.prisma.character.findMany({
            where: { projectId: project.id },
            orderBy: { createdAt: 'asc' },
            // Include images and imageUrl; compute fallback if images is missing
            select: { id: true, name: true, role: true, summary: true, traits: true, images: true, imageUrl: true, createdAt: true, updatedAt: true },
        });
        const withImages = items.map((c) => ({
            ...c,
            images: c.images ?? (c.imageUrl ? [c.imageUrl] : []),
        }));
        return reply.send(withImages);
    });
    app.post('/project/:id/characters', async (req, reply) => {
        const params = uuidParam.parse(req.params);
        const user = req.user;
        if (!user?.id)
            return reply.code(401).send({ error: 'Unauthorized' });
        const project = await prisma_1.prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true, mode: true } });
        if (!project)
            return reply.code(404).send({ error: 'Not found' });
        const body = characterCreateBody.parse(req.body);
        try {
            req.log?.info?.({ route: 'characters.create', projectId: params.id, hasImages: Array.isArray(body.images), imagesCount: (body.images || []).length }, 'Characters CREATE start');
        }
        catch { }
        if (project.mode === 'manhwa' && !(body.images && body.images.length)) {
            return reply.code(400).send({ error: 'At least one image is required in manhwa mode' });
        }
        let traits = undefined;
        if (Array.isArray(body.traitsOps) && body.traitsOps.length)
            traits = applyTraitsOps({}, body.traitsOps);
        else if (body.traits !== undefined)
            traits = body.traits;
        const created = await prisma_1.prisma.character.create({
            data: {
                projectId: project.id,
                name: body.name,
                role: body.role ?? null,
                summary: body.summary ?? null,
                imageUrl: (body.images && body.images[0]) ? body.images[0] : null,
                images: (body.images ?? null),
                traits: traits ?? null,
            },
            select: { id: true, name: true, role: true, summary: true, traits: true, imageUrl: true, createdAt: true },
        });
        // Best-effort: update images JSON column if present
        if (Array.isArray(body.images)) {
            try {
                await prisma_1.prisma.character.update({ where: { id: created.id }, data: { images: body.images } });
                try {
                    req.log?.info?.({ route: 'characters.create', id: created.id, imagesCount: (body.images || []).length }, 'Characters CREATE images persisted');
                }
                catch { }
            }
            catch { }
        }
        const result = { ...created, images: Array.isArray(body.images) ? body.images : (created.imageUrl ? [created.imageUrl] : []) };
        try {
            req.log?.info?.({ route: 'characters.create', id: result.id }, 'Characters CREATE done');
        }
        catch { }
        // Award EXP for creating a character
        try {
            await (0, expAwarder_1.awardExpForAction)(user.id, 'CREATE_CHARACTER');
        }
        catch (err) {
            req.log.warn({ err }, 'Failed to award EXP for character creation');
        }
        return reply.code(201).send(result);
    });
    app.patch('/project/:id/characters/:charId', async (req, reply) => {
        const params = zod_1.z.object({ id: zod_1.z.string().uuid(), charId: zod_1.z.string().uuid() }).parse(req.params);
        const user = req.user;
        if (!user?.id)
            return reply.code(401).send({ error: 'Unauthorized' });
        const project = await prisma_1.prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true, mode: true } });
        if (!project)
            return reply.code(404).send({ error: 'Not found' });
        const body = characterUpdateBody.parse(req.body);
        try {
            req.log?.info?.({ route: 'characters.patch', projectId: params.id, id: params.charId, hasImages: body.images !== undefined, imagesCount: (body.images || []).length }, 'Characters PATCH start');
        }
        catch { }
        if (project.mode === 'manhwa' && (body.images !== undefined) && (!body.images || body.images.length === 0)) {
            return reply.code(400).send({ error: 'Cannot remove all images in manhwa mode' });
        }
        // Load existing to apply traitsOps
        const existing = await prisma_1.prisma.character.findFirst({ where: { id: params.charId, projectId: project.id }, select: { traits: true, images: true, imageUrl: true } });
        if (!existing)
            return reply.code(404).send({ error: 'Not found' });
        let traits = undefined;
        if (Array.isArray(body.traitsOps) && body.traitsOps.length)
            traits = applyTraitsOps(existing.traits || {}, body.traitsOps);
        else if (body.traits !== undefined)
            traits = body.traits;
        const updated = await prisma_1.prisma.character.updateMany({
            where: { id: params.charId, projectId: project.id },
            data: {
                name: body.name ?? undefined,
                role: body.role ?? undefined,
                summary: body.summary ?? undefined,
                imageUrl: Array.isArray(body.images) ? (body.images[0] ?? null) : undefined,
                images: body.images === undefined ? undefined : (body.images ?? null),
                traits: traits === undefined ? undefined : traits,
            },
        });
        try {
            req.log?.info?.({ route: 'characters.patch', id: params.charId, updatedCount: updated.count }, 'Characters PATCH updated');
        }
        catch { }
        if (!updated.count)
            return reply.code(404).send({ error: 'Not found' });
        // Best-effort: remove deleted images from Supabase storage (server-side)
        if (Array.isArray(existing?.images) || existing?.imageUrl) {
            const prevImages = Array.isArray(existing.images) ? existing.images : ((existing.imageUrl) ? [existing.imageUrl] : []);
            if (Array.isArray(body.images)) {
                const nextSet = new Set(body.images);
                const removed = prevImages.filter((u) => !nextSet.has(u));
                if (removed.length && supabaseAdmin) {
                    for (const u of removed) {
                        try {
                            const parsed = parseSupabasePublicUrl(u);
                            if (parsed) {
                                await supabaseAdmin.storage.from(parsed.bucket).remove([parsed.path]);
                            }
                        }
                        catch { }
                    }
                }
            }
        }
        // Best-effort: update images JSON column if present
        if (body.images !== undefined) {
            try {
                await prisma_1.prisma.character.update({ where: { id: params.charId }, data: { images: body.images } });
                try {
                    req.log?.info?.({ route: 'characters.patch', id: params.charId, imagesCount: (body.images || []).length }, 'Characters PATCH images persisted');
                }
                catch { }
            }
            catch { }
        }
        const result = await prisma_1.prisma.character.findFirst({ where: { id: params.charId, projectId: project.id }, select: { id: true, name: true, role: true, summary: true, traits: true, images: true, imageUrl: true, updatedAt: true } });
        const withImages = { ...result, images: (result?.images ?? ((result?.imageUrl) ? [result.imageUrl] : [])) };
        try {
            req.log?.info?.({ route: 'characters.patch', id: params.charId }, 'Characters PATCH done');
        }
        catch { }
        return reply.send(withImages);
    });
    app.delete('/project/:id/characters/:charId', async (req, reply) => {
        const params = zod_1.z.object({ id: zod_1.z.string().uuid(), charId: zod_1.z.string().uuid() }).parse(req.params);
        const user = req.user;
        if (!user?.id)
            return reply.code(401).send({ error: 'Unauthorized' });
        const project = await prisma_1.prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
        if (!project)
            return reply.code(404).send({ error: 'Not found' });
        const del = await prisma_1.prisma.character.deleteMany({ where: { id: params.charId, projectId: project.id } });
        if (!del.count)
            return reply.code(404).send({ error: 'Not found' });
        return reply.code(204).send();
    });
    // --- Export endpoints ---
    app.post('/project/:id/export', async (req, reply) => {
        const params = uuidParam.parse(req.params);
        const user = req.user;
        if (!user?.id)
            return reply.code(401).send({ error: 'Unauthorized' });
        const body = zod_1.z.object({ format: zod_1.z.enum(['json', 'markdown', 'text']).default('json') }).parse(req.body);
        try {
            const project = await prisma_1.prisma.project.findFirst({
                where: { id: params.id, userId: user.id },
                select: { id: true, title: true },
            });
            if (!project)
                return reply.code(404).send({ error: 'Not found' });
            let content;
            let contentType;
            let filename;
            switch (body.format) {
                case 'markdown':
                    content = await (0, projectExporter_1.exportProjectAsMarkdown)(params.id, user.id);
                    contentType = 'text/markdown';
                    filename = `${project.title}.md`;
                    break;
                case 'text':
                    content = await (0, projectExporter_1.exportProjectAsText)(params.id, user.id);
                    contentType = 'text/plain';
                    filename = `${project.title}.txt`;
                    break;
                case 'json':
                default:
                    const jsonData = await (0, projectExporter_1.exportProjectAsJson)(params.id, user.id);
                    content = JSON.stringify(jsonData, null, 2);
                    contentType = 'application/json';
                    filename = `${project.title}.json`;
                    break;
            }
            // Award EXP for exporting
            try {
                await (0, expAwarder_1.awardExpForAction)(user.id, 'EXPORT_PROJECT');
            }
            catch (err) {
                req.log.warn({ err }, 'Failed to award EXP for project export');
            }
            // Set response headers for download
            reply.header('Content-Type', contentType);
            reply.header('Content-Disposition', `attachment; filename="${filename}"`);
            return reply.send(content);
        }
        catch (err) {
            req.log.error(err);
            return reply.code(500).send({ error: 'Failed to export project' });
        }
    });
    // --- Bookmarks ---
    app.post('/project/:id/bookmarks', async (req, reply) => {
        const params = uuidParam.parse(req.params);
        const user = req.user;
        if (!user?.id)
            return reply.code(401).send({ error: 'Unauthorized' });
        const body = zod_1.z.object({
            progress: zod_1.z.number().int().min(0).max(100),
            name: zod_1.z.string().optional(),
            description: zod_1.z.string().optional(),
        }).parse(req.body);
        const project = await prisma_1.prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
        if (!project)
            return reply.code(404).send({ error: 'Not found' });
        // Get count of existing bookmarks to generate default name
        const count = await prisma_1.prisma.bookmark.count({ where: { projectId: project.id } });
        const defaultName = body.name || `Bookmark ${count + 1}`;
        const bookmark = await prisma_1.prisma.bookmark.create({
            data: {
                projectId: project.id,
                name: defaultName,
                description: body.description || null,
                progress: body.progress,
            },
            select: { id: true, name: true, description: true, progress: true, updatedAt: true },
        });
        return reply.code(201).send(bookmark);
    });
    app.get('/project/:id/bookmarks', async (req, reply) => {
        const params = uuidParam.parse(req.params);
        const user = req.user;
        if (!user?.id)
            return reply.code(401).send({ error: 'Unauthorized' });
        const project = await prisma_1.prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
        if (!project)
            return reply.code(404).send({ error: 'Not found' });
        const bookmarks = await prisma_1.prisma.bookmark.findMany({
            where: { projectId: project.id },
            orderBy: { updatedAt: 'desc' },
            select: { id: true, name: true, description: true, progress: true, updatedAt: true },
        });
        return reply.send(bookmarks);
    });
    app.patch('/project/:id/bookmarks/:bookmarkId', async (req, reply) => {
        const params = zod_1.z.object({ id: zod_1.z.string().uuid(), bookmarkId: zod_1.z.string().uuid() }).parse(req.params);
        const user = req.user;
        if (!user?.id)
            return reply.code(401).send({ error: 'Unauthorized' });
        const body = zod_1.z.object({
            name: zod_1.z.string().optional(),
            description: zod_1.z.string().optional(),
        }).parse(req.body);
        const project = await prisma_1.prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
        if (!project)
            return reply.code(404).send({ error: 'Not found' });
        const updated = await prisma_1.prisma.bookmark.updateMany({
            where: { id: params.bookmarkId, projectId: project.id },
            data: {
                ...(body.name && { name: body.name }),
                ...(body.description !== undefined && { description: body.description }),
                updatedAt: new Date(),
            },
        });
        if (!updated.count)
            return reply.code(404).send({ error: 'Not found' });
        const result = await prisma_1.prisma.bookmark.findFirst({
            where: { id: params.bookmarkId },
            select: { id: true, name: true, description: true, progress: true, updatedAt: true },
        });
        return reply.send(result);
    });
    app.delete('/project/:id/bookmarks/:bookmarkId', async (req, reply) => {
        const params = zod_1.z.object({ id: zod_1.z.string().uuid(), bookmarkId: zod_1.z.string().uuid() }).parse(req.params);
        const user = req.user;
        if (!user?.id)
            return reply.code(401).send({ error: 'Unauthorized' });
        const project = await prisma_1.prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
        if (!project)
            return reply.code(404).send({ error: 'Not found' });
        const del = await prisma_1.prisma.bookmark.deleteMany({
            where: { id: params.bookmarkId, projectId: project.id },
        });
        if (!del.count)
            return reply.code(404).send({ error: 'Not found' });
        return reply.code(204).send();
    });
    // --- Sharing helpers and endpoints ---
    function slugifyTitle(title) {
        const base = (title || 'story')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 60);
        return base || 'story';
    }
    // Publish project (public)
    app.post('/project/:id/share/publish', async (req, reply) => {
        const params = uuidParam.parse(req.params);
        const user = req.user;
        if (!user?.id)
            return reply.code(401).send({ error: 'Unauthorized' });
        const project = await prisma_1.prisma.project.findFirst({ where: { id: params.id, userId: user.id } });
        if (!project)
            return reply.code(404).send({ error: 'Not found' });
        let slug = project.publicSlug;
        if (!slug) {
            const base = slugifyTitle(project.title || 'story');
            const suffix = project.id?.toString().slice(0, 8) || Math.random().toString(36).slice(2, 10);
            slug = `${base}-${suffix}`;
            let tries = 0;
            while (tries < 3) {
                const exists = await prisma_1.prisma.project.findFirst({ where: { publicSlug: slug }, select: { id: true } });
                if (!exists)
                    break;
                slug = `${base}-${suffix}-${Math.random().toString(36).slice(2, 6)}`;
                tries++;
            }
        }
        const updated = await prisma_1.prisma.project.update({
            where: { id: params.id },
            data: { visibility: 'public', publicSlug: slug, publishedAt: new Date() },
            select: { id: true, visibility: true, publicSlug: true, publishedAt: true },
        });
        return reply.send(updated);
    });
    // Unpublish (back to private)
    app.post('/project/:id/share/unpublish', async (req, reply) => {
        const params = uuidParam.parse(req.params);
        const user = req.user;
        if (!user?.id)
            return reply.code(401).send({ error: 'Unauthorized' });
        const project = await prisma_1.prisma.project.findFirst({ where: { id: params.id, userId: user.id } });
        if (!project)
            return reply.code(404).send({ error: 'Not found' });
        const updated = await prisma_1.prisma.project.update({
            where: { id: params.id },
            data: { visibility: 'private', publishedAt: null },
            select: { id: true, visibility: true, publicSlug: true, publishedAt: true },
        });
        return reply.send(updated);
    });
    // Public read: by slug
    app.get('/public/project/:slug', async (req, reply) => {
        const { slug } = zod_1.z.object({ slug: zod_1.z.string().min(1) }).parse(req.params);
        const project = await prisma_1.prisma.project.findFirst({
            where: { publicSlug: slug, visibility: 'public' },
            select: { id: true, title: true, description: true, coverImage: true, mode: true, genres: true, createdAt: true },
        });
        if (!project)
            return reply.code(404).send({ error: 'Not found' });
        return reply.send(project);
    });
    app.get('/public/project/:slug/chapters', async (req, reply) => {
        const { slug } = zod_1.z.object({ slug: zod_1.z.string().min(1) }).parse(req.params);
        const qp = zod_1.z.object({ page: zod_1.z.coerce.number().int().min(0).default(0), limit: zod_1.z.coerce.number().int().min(1).max(100).default(20) }).parse(req.query || {});
        const user = req.user;
        const project = await prisma_1.prisma.project.findFirst({ where: { publicSlug: slug, visibility: 'public' }, select: { id: true, userId: true } });
        if (!project)
            return reply.code(404).send({ error: 'Not found' });
        const total = await prisma_1.prisma.chapter.count({ where: { projectId: project.id, isCanon: true } });
        // Select price
        const items = await prisma_1.prisma.chapter.findMany({
            where: { projectId: project.id, isCanon: true },
            orderBy: { createdAt: 'asc' },
            skip: qp.page * qp.limit,
            take: qp.limit,
            select: { id: true, title: true, content: true, panelScript: true, createdAt: true, price: true },
        });
        // Masking Logic
        const paidChapters = items.filter((i) => i.price > 0).map(i => i.id);
        if (paidChapters.length > 0) {
            let unlockedIds = new Set();
            let isOwner = false;
            if (user?.id) {
                // If logged in, check ownership and unlocked status
                isOwner = project.userId === user.id;
                if (!isOwner) {
                    const unlocked = await prisma_1.prisma.unlockedContent.findMany({
                        where: { userId: user.id, chapterId: { in: paidChapters } },
                        select: { chapterId: true }
                    });
                    unlockedIds = new Set(unlocked.map(u => u.chapterId));
                }
            }
            // If not owner, mask any paid chapters that are not unlocked
            if (!isOwner) {
                items.forEach((i) => {
                    if (i.price > 0 && !unlockedIds.has(i.id)) {
                        i.content = "LOCKED_CONTENT";
                        i.panelScript = null;
                    }
                });
            }
        }
        return reply.send({ items, total });
    });
    // Public: list public projects
    app.get('/public/projects', async (req, reply) => {
        const qp = zod_1.z.object({
            page: zod_1.z.coerce.number().int().min(0).default(0),
            limit: zod_1.z.coerce.number().int().min(1).max(100).default(30),
            q: zod_1.z.string().optional(),
        }).parse(req.query || {});
        const where = { visibility: 'public' };
        const q = (qp.q || '').trim();
        if (q) {
            where.OR = [
                { title: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
            ];
        }
        const total = await prisma_1.prisma.project.count({ where });
        const items = await prisma_1.prisma.project.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: qp.page * qp.limit,
            take: qp.limit,
            select: { id: true, title: true, description: true, coverImage: true, mode: true, genres: true, createdAt: true, publicSlug: true },
        });
        const counts = await Promise.all(items.map((it) => prisma_1.prisma.chapter.count({ where: { projectId: it.id, isCanon: true } })));
        const enriched = items.map((it, idx) => ({ ...it, chapterCount: counts[idx] || 0 }));
        return reply.send({ items: enriched, total });
    });
    done();
};
exports.default = routes;
//# sourceMappingURL=project.js.map