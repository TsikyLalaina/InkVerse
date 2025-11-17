import type { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/prisma';
const ChatTypeEnum = z.enum(['plot','character','world']);

const uuidParam = z.object({ id: z.string().uuid() });
const createBody = z.object({ title: z.string().min(1), description: z.string().optional() });
const ModeEnum = z.enum(['novel', 'manhwa', 'convert']);
const updateBody = z.object({ title: z.string().min(1).optional(), description: z.string().optional(), mode: ModeEnum.optional() }).refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });
const settingsBody = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  coverImage: z.string().url().optional(),
  genre: z.string().optional(),
  coreConflict: z.string().optional(),
  settingsJson: z.any().optional(),
  mode: ModeEnum.optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'No settings provided' });
const createChapterBody = z.object({
  title: z.string().min(1),
  content: z.string().optional(),
  panel_script: z.any().optional(),
  branchId: z.string().uuid().optional(),
  isCanon: z.boolean().optional(),
});

const traitsOp = z.object({ op: z.enum(['set','delete']), path: z.array(z.string().min(1)), value: z.any().optional() });
const characterCreateBody = z.object({
  name: z.string().min(1),
  role: z.string().optional(),
  summary: z.string().optional(),
  images: z.array(z.string().url()).optional(),
  traits: z.any().optional(),
  traitsOps: z.array(traitsOp).optional(),
});
const characterUpdateBody = z.object({
  name: z.string().min(1).optional(),
  role: z.string().optional(),
  summary: z.string().optional(),
  images: z.array(z.string().url()).optional(),
  traits: z.any().optional(),
  traitsOps: z.array(traitsOp).optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

const routes: FastifyPluginCallback = (app, _opts, done) => {
  app.get('/project', async (req, reply) => {
    const user = (req as any).user;
    if (!user?.id) return reply.code(401).send({ error: 'Unauthorized' });

    const projects = await prisma.project.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, description: true, createdAt: true, mode: true },
    });
    return reply.send(projects);
  });

  // --- Chats (per project) ---
  app.get('/project/:id/chats', async (req, reply) => {
    const params = uuidParam.parse(req.params);
    const user = (req as any).user;
    if (!user?.id) return reply.code(401).send({ error: 'Unauthorized' });

    const project = await prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
    if (!project) return reply.code(404).send({ error: 'Not found' });

    const chats = await (prisma as any).chat.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, type: true, title: true, createdAt: true, updatedAt: true },
    } as any);
    return reply.send(chats);
  });

  app.post('/project/:id/chats', async (req, reply) => {
    const params = uuidParam.parse(req.params);
    const user = (req as any).user;
    if (!user?.id) return reply.code(401).send({ error: 'Unauthorized' });

    const body = z.object({ type: ChatTypeEnum, title: z.string().optional() }).parse(req.body);
    const project = await prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
    if (!project) return reply.code(404).send({ error: 'Not found' });

    // Default title using total count only (avoid touching enum column to bypass casting issues)
    const totalChats = await prisma.chat.count({ where: { projectId: project.id } as any });
    const defaultTitle = body.type === 'plot' ? `Plot Chat ${totalChats + 1}` : (body.type === 'character' ? `Character Chat ${totalChats + 1}` : `World Chat ${totalChats + 1}`);
    const created = await (prisma as any).chat.create({
      data: { projectId: project.id, type: body.type as any, title: (body.title && body.title.trim()) || defaultTitle },
      select: { id: true, type: true, title: true, createdAt: true },
    } as any);
    return reply.code(201).send(created);
  });

  app.patch('/project/:id/chats/:chatId', async (req, reply) => {
    const params = z.object({ id: z.string().uuid(), chatId: z.string().uuid() }).parse(req.params);
    const user = (req as any).user;
    if (!user?.id) return reply.code(401).send({ error: 'Unauthorized' });
    const body = z.object({ title: z.string().min(1) }).parse(req.body);
    const project = await prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
    if (!project) return reply.code(404).send({ error: 'Not found' });
    const updated = await (prisma as any).chat.updateMany({ where: { id: params.chatId, projectId: project.id }, data: { title: body.title } } as any);
    if (!updated.count) return reply.code(404).send({ error: 'Not found' });
    const result = await (prisma as any).chat.findFirst({ where: { id: params.chatId }, select: { id: true, type: true, title: true, updatedAt: true } } as any);
    return reply.send(result);
  });

  app.delete('/project/:id/chats/:chatId', async (req, reply) => {
    const params = z.object({ id: z.string().uuid(), chatId: z.string().uuid() }).parse(req.params);
    const user = (req as any).user;
    if (!user?.id) return reply.code(401).send({ error: 'Unauthorized' });
    const project = await prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
    if (!project) return reply.code(404).send({ error: 'Not found' });
    const del = await (prisma as any).chat.deleteMany({ where: { id: params.chatId, projectId: project.id } } as any);
    if (!del.count) return reply.code(404).send({ error: 'Not found' });
    return reply.code(204).send();
  });

  // Create a chapter under a project (moved outside GET handler)
  app.post('/project/:id/chapter', async (req, reply) => {
    const params = uuidParam.parse(req.params);
    const user = (req as any).user;
    if (!user?.id) return reply.code(401).send({ error: 'Unauthorized' });

    const project = await prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
    if (!project) return reply.code(404).send({ error: 'Not found' });

    const body = createChapterBody.parse(req.body);

    const chapter = await prisma.chapter.create({
      data: {
        projectId: project.id,
        title: body.title,
        content: body.content ?? '',
        // @ts-ignore: panelScript is Json field
        panelScript: body.panel_script ?? undefined,
        branchId: body.branchId ?? null,
        // @ts-ignore
        isCanon: body.isCanon ?? true,
      },
      select: { id: true, title: true, createdAt: true },
    });

    return reply.code(201).send(chapter);
  });

  // Update a chapter's title/content/panel_script
  app.patch('/project/:id/chapter/:chapterId', async (req, reply) => {
    const params = z.object({ id: z.string().uuid(), chapterId: z.string().uuid() }).parse(req.params);
    const user = (req as any).user;
    if (!user?.id) return reply.code(401).send({ error: 'Unauthorized' });

    const project = await prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
    if (!project) return reply.code(404).send({ error: 'Not found' });

    const body = z.object({
      title: z.string().min(1).optional(),
      content: z.string().optional(),
      panel_script: z.any().optional(),
    }).refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' }).parse(req.body);

    const updated = await prisma.chapter.updateMany({
      where: { id: params.chapterId, projectId: project.id },
      data: {
        title: body.title ?? undefined,
        content: body.content ?? undefined,
        // @ts-ignore
        panelScript: body.panel_script ?? undefined,
      },
    });
    if (updated.count === 0) return reply.code(404).send({ error: 'Not found' });

    const ch = await prisma.chapter.findFirst({ where: { id: params.chapterId, projectId: project.id }, select: { id: true, title: true, content: true, panelScript: true } });
    return reply.send(ch);
  });

  app.delete('/project/:id/chapter/:chapterId', async (req, reply) => {
    const params = z.object({ id: z.string().uuid(), chapterId: z.string().uuid() }).parse(req.params);
    const user = (req as any).user;
    if (!user?.id) return reply.code(401).send({ error: 'Unauthorized' });

    const project = await prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
    if (!project) return reply.code(404).send({ error: 'Not found' });

    const result = await prisma.$transaction(async (tx) => {
      await tx.chatMessage.updateMany({ where: { panelId: params.chapterId }, data: { panelId: null } });
      await tx.branch.updateMany({ where: { baseChapterId: params.chapterId }, data: { baseChapterId: null } });
      const del = await tx.chapter.deleteMany({ where: { id: params.chapterId, projectId: project.id } });
      return del.count;
    });

    if (result === 0) return reply.code(404).send({ error: 'Not found' });
    return reply.code(204).send();
  });

  // --- World Settings CRUD ---
  const worldCreateBody = z.object({
    name: z.string().min(1),
    summary: z.string().optional(),
    traits: z.any().optional(),
    traitsOps: z.array(traitsOp).optional(),
    images: z.array(z.string().url()).optional(),
  });
  const worldUpdateBody = z.object({
    name: z.string().min(1).optional(),
    summary: z.string().optional(),
    traits: z.any().optional(),
    traitsOps: z.array(traitsOp).optional(),
    images: z.array(z.string().url()).optional(),
  }).refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

  app.get('/project/:id/world', async (req, reply) => {
    const params = uuidParam.parse(req.params);
    const user = (req as any).user;
    if (!user?.id) return reply.code(401).send({ error: 'Unauthorized' });
    const project = await prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
    if (!project) return reply.code(404).send({ error: 'Not found' });
    const items = await (prisma as any).worldSetting.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, summary: true, traits: true, images: true, createdAt: true, updatedAt: true },
    } as any);
    return reply.send(items);
  });

  app.post('/project/:id/world', async (req, reply) => {
    const params = uuidParam.parse(req.params);
    const user = (req as any).user;
    if (!user?.id) return reply.code(401).send({ error: 'Unauthorized' });
    const project = await prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
    if (!project) return reply.code(404).send({ error: 'Not found' });
    const body = worldCreateBody.parse(req.body);
    let traits: any = undefined;
    if (Array.isArray(body.traitsOps) && body.traitsOps.length) traits = applyTraitsOps({}, body.traitsOps as any);
    else if (body.traits !== undefined) traits = body.traits;
    const created = await (prisma as any).worldSetting.create({
      data: { projectId: project.id, name: body.name, summary: body.summary ?? null, traits: traits ?? null, images: (body.images ?? null) },
      select: { id: true, name: true, summary: true, traits: true, images: true, createdAt: true },
    } as any);
    return reply.code(201).send(created);
  });

  app.patch('/project/:id/world/:wsId', async (req, reply) => {
    const params = z.object({ id: z.string().uuid(), wsId: z.string().uuid() }).parse(req.params);
    const user = (req as any).user;
    if (!user?.id) return reply.code(401).send({ error: 'Unauthorized' });
    const project = await prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
    if (!project) return reply.code(404).send({ error: 'Not found' });
    const body = worldUpdateBody.parse(req.body);
    const existing = await (prisma as any).worldSetting.findFirst({ where: { id: params.wsId, projectId: project.id }, select: { traits: true, images: true } });
    if (!existing) return reply.code(404).send({ error: 'Not found' });
    let traits: any = undefined;
    if (Array.isArray(body.traitsOps) && body.traitsOps.length) traits = applyTraitsOps((existing as any).traits || {}, body.traitsOps as any);
    else if (body.traits !== undefined) traits = body.traits;
    const updated = await (prisma as any).worldSetting.updateMany({
      where: { id: params.wsId, projectId: project.id },
      data: {
        name: body.name ?? undefined,
        summary: body.summary ?? undefined,
        traits: traits === undefined ? undefined : traits,
        images: body.images === undefined ? undefined : (body.images ?? null),
      },
    } as any);
    if (!updated.count) return reply.code(404).send({ error: 'Not found' });
    const result = await (prisma as any).worldSetting.findFirst({ where: { id: params.wsId, projectId: project.id }, select: { id: true, name: true, summary: true, traits: true, images: true, updatedAt: true } });
    return reply.send(result);
  });

  app.delete('/project/:id/world/:wsId', async (req, reply) => {
    const params = z.object({ id: z.string().uuid(), wsId: z.string().uuid() }).parse(req.params);
    const user = (req as any).user;
    if (!user?.id) return reply.code(401).send({ error: 'Unauthorized' });
    const project = await prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
    if (!project) return reply.code(404).send({ error: 'Not found' });
    const del = await (prisma as any).worldSetting.deleteMany({ where: { id: params.wsId, projectId: project.id } });
    if (!del.count) return reply.code(404).send({ error: 'Not found' });
    return reply.code(204).send();
  });

  app.post('/project', async (req, reply) => {
    const body = createBody.parse(req.body);
    const user = (req as any).user;
    if (!user?.id) return reply.code(401).send({ error: 'Unauthorized' });

    const project = await prisma.project.create({
      data: {
        userId: user.id,
        title: body.title,
        description: body.description ?? null,
      },
      select: { id: true },
    });

    return reply.code(201).send(project);
  });

  app.get('/project/:id', async (req, reply) => {
    const params = uuidParam.parse(req.params);
    const user = (req as any).user;
    if (!user?.id) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      const project = await prisma.project.findFirst({
        where: { id: params.id, userId: user.id },
        // Select top-level fields and include light related data
        select: {
          id: true,
          title: true,
          description: true,
          // @ts-ignore optional columns depending on schema
          mode: true as any,
          // @ts-ignore
          genre: true as any,
          // @ts-ignore
          coreConflict: true as any,
          // @ts-ignore
          settingsJson: true as any,
          chapters: { take: 10, orderBy: { createdAt: 'desc' } },
          branches: { take: 10, orderBy: { createdAt: 'desc' } },
        } as any,
      });

      if (!project) return reply.code(404).send({ error: 'Not found' });
      return reply.send(project);
    } catch (_err) {
      const project = await prisma.project.findFirst({
        where: { id: params.id, userId: user.id },
        select: {
          id: true,
          title: true,
          description: true,
          // @ts-ignore optional columns depending on schema
          mode: true as any,
          // @ts-ignore
          genre: true as any,
          // @ts-ignore
          coreConflict: true as any,
          // @ts-ignore
          settingsJson: true as any,
          chapters: { take: 10, orderBy: { createdAt: 'desc' } },
          branches: { take: 10, orderBy: { createdAt: 'desc' } },
        } as any,
      });
      if (!project) return reply.code(404).send({ error: 'Not found' });
      return reply.send(project);
    }
  });

  app.patch('/project/:id', async (req, reply) => {
    const params = uuidParam.parse(req.params);
    const body = updateBody.parse(req.body);
    const user = (req as any).user;
    if (!user?.id) return reply.code(401).send({ error: 'Unauthorized' });

    const existing = await prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
    if (!existing) return reply.code(404).send({ error: 'Not found' });

    const updated = await prisma.project.update({
      where: { id: params.id },
      data: {
        title: body.title ?? undefined,
        description: body.description ?? undefined,
        // Apply mode when column exists
        // @ts-ignore - if column not present yet, Prisma will error at runtime
        mode: (body as any).mode ?? undefined,
      },
      select: { id: true, title: true, description: true },
    });

    // Try to include mode in response if available
    try {
      const withMode = await prisma.project.findFirst({ where: { id: params.id }, select: { id: true, title: true, description: true, mode: true } as any });
      return reply.send(withMode || updated);
    } catch {
      return reply.send(updated);
    }
  });

  app.delete('/project/:id', async (req, reply) => {
    const params = uuidParam.parse(req.params);
    const user = (req as any).user;
    if (!user?.id) return reply.code(401).send({ error: 'Unauthorized' });

    const result = await prisma.project.deleteMany({ where: { id: params.id, userId: user.id } });
    if (result.count === 0) return reply.code(404).send({ error: 'Not found' });

    return reply.code(204).send();
  });

  // Update project settings and log history (defined at plugin registration time)
  app.patch('/project/:id/settings', async (req, reply) => {
    const params = uuidParam.parse(req.params);
    const user = (req as any).user;
    if (!user?.id) return reply.code(401).send({ error: 'Unauthorized' });

    const body = settingsBody.parse(req.body);
    const existing = await prisma.project.findFirst({ where: { id: params.id, userId: user.id } });
    if (!existing) return reply.code(404).send({ error: 'Not found' });

    const data: any = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (body.coverImage !== undefined) data.coverImage = body.coverImage;
    if (body.genre !== undefined) data.genre = body.genre;
    if (body.coreConflict !== undefined) data.coreConflict = body.coreConflict;
    if (body.settingsJson !== undefined) {
      const isObj = (v: any) => v && typeof v === 'object' && !Array.isArray(v);
      const incoming = body.settingsJson as any;
      const current = (existing as any)?.settingsJson as any;
      if (isObj(incoming) && isObj(current)) {
        data.settingsJson = { ...current, ...incoming } as any;
      } else {
        data.settingsJson = incoming as any;
      }
    }
    if ((body as any).mode !== undefined) data.mode = (body as any).mode;

    const updated = await prisma.project.update({
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
        mode: true as any,
        // @ts-ignore
        genre: true as any,
        // @ts-ignore
        coreConflict: true as any,
        // @ts-ignore
        settingsJson: true as any,
        // @ts-ignore
        updatedAt: true as any,
      } as any,
    });

    // Log history (best-effort)
    try {
      await (prisma as any).settingHistory.create({
        data: {
          projectId: params.id,
          userId: user.id,
          changes: body as any,
        },
      });
    } catch {}

    return reply.send(updated);
  });

  // Paginated chapters for reader (ascending by createdAt)
  app.get('/project/:id/chapters', async (req, reply) => {
    const params = uuidParam.parse(req.params);
    const user = (req as any).user;
    if (!user?.id) return reply.code(401).send({ error: 'Unauthorized' });

    const qp = z.object({
      page: z.coerce.number().int().min(0).default(0),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }).parse((req as any).query || {});

    const project = await prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
    if (!project) return reply.code(404).send({ error: 'Not found' });

    const total = await prisma.chapter.count({ where: { projectId: project.id } });
    const items = await prisma.chapter.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'asc' },
      skip: qp.page * qp.limit,
      take: qp.limit,
      select: { id: true, title: true, content: true, panelScript: true, createdAt: true },
    });
    return reply.send({ items, total });
  });

  // Lightweight chapter summary for previews
  app.get('/project/:id/chapters/summary', async (req, reply) => {
    const params = uuidParam.parse(req.params);
    const user = (req as any).user;
    if (!user?.id) return reply.code(401).send({ error: 'Unauthorized' });

    const project = await prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
    if (!project) return reply.code(404).send({ error: 'Not found' });

    const count = await prisma.chapter.count({ where: { projectId: project.id } });
    const firstText = await prisma.chapter.findFirst({
      where: { projectId: project.id, content: { not: '' } },
      orderBy: { createdAt: 'asc' },
      select: { content: true },
    });
    return reply.send({ count, snippet: (firstText?.content || '') });
  });

  // --- Characters CRUD ---
  function applyTraitsOps(base: any, ops: Array<{ op: 'set'|'delete'; path: string[]; value?: any }>) {
    const root = (base && typeof base === 'object') ? JSON.parse(JSON.stringify(base)) : {};
    const setAt = (obj: any, path: string[], val: any) => {
      let curr = obj;
      for (let i = 0; i < path.length - 1; i++) {
        const k = path[i];
        if (!curr[k] || typeof curr[k] !== 'object') curr[k] = {};
        curr = curr[k];
      }
      curr[path[path.length - 1]] = val;
    };
    const delAt = (obj: any, path: string[]) => {
      let curr = obj;
      for (let i = 0; i < path.length - 1; i++) {
        const k = path[i];
        if (!curr[k] || typeof curr[k] !== 'object') return;
        curr = curr[k];
      }
      delete curr[path[path.length - 1]];
    };
    for (const op of ops || []) {
      const p = (op.path || []).filter(Boolean);
      if (!p.length) continue;
      if (op.op === 'set') setAt(root, p, op.value);
      else if (op.op === 'delete') delAt(root, p);
    }
    return root;
  }

  app.get('/project/:id/characters', async (req, reply) => {
    const params = uuidParam.parse(req.params);
    const user = (req as any).user;
    if (!user?.id) return reply.code(401).send({ error: 'Unauthorized' });
    const project = await prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
    if (!project) return reply.code(404).send({ error: 'Not found' });
    const items = await (prisma as any).character.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'asc' },
      // images column may or may not exist yet; select imageUrl and compute images on the fly
      select: { id: true, name: true, role: true, summary: true, traits: true, imageUrl: true, createdAt: true, updatedAt: true },
    } as any);
    const withImages = (items as any[]).map((c: any) => ({
      ...c,
      images: (c as any).images ?? (c.imageUrl ? [c.imageUrl] : []),
    }));
    return reply.send(withImages);
  });

  app.post('/project/:id/characters', async (req, reply) => {
    const params = uuidParam.parse(req.params);
    const user = (req as any).user;
    if (!user?.id) return reply.code(401).send({ error: 'Unauthorized' });
    const project = await prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true, mode: true } as any });
    if (!project) return reply.code(404).send({ error: 'Not found' });
    const body = characterCreateBody.parse(req.body);
    if ((project as any).mode === 'manhwa' && !(body.images && body.images.length)) {
      return reply.code(400).send({ error: 'At least one image is required in manhwa mode' });
    }
    let traits: any = undefined;
    if (Array.isArray(body.traitsOps) && body.traitsOps.length) traits = applyTraitsOps({}, body.traitsOps as any);
    else if (body.traits !== undefined) traits = body.traits;
    const created = await (prisma as any).character.create({
      data: { projectId: project.id, name: body.name, role: body.role ?? null, summary: body.summary ?? null, imageUrl: (body.images && body.images[0]) ? body.images[0] : null, traits: traits ?? null },
      select: { id: true, name: true, role: true, summary: true, traits: true, imageUrl: true, createdAt: true },
    } as any);
    // Best-effort: update images JSON column if present
    if (Array.isArray(body.images)) {
      try {
        await (prisma as any).character.update({ where: { id: created.id }, data: { images: body.images } } as any);
      } catch {}
    }
    const result = { ...created, images: Array.isArray(body.images) ? body.images : (created.imageUrl ? [created.imageUrl] : []) };
    return reply.code(201).send(result);
  });

  app.patch('/project/:id/characters/:charId', async (req, reply) => {
    const params = z.object({ id: z.string().uuid(), charId: z.string().uuid() }).parse(req.params);
    const user = (req as any).user;
    if (!user?.id) return reply.code(401).send({ error: 'Unauthorized' });
    const project = await prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true, mode: true } as any });
    if (!project) return reply.code(404).send({ error: 'Not found' });
    const body = characterUpdateBody.parse(req.body);
    if ((project as any).mode === 'manhwa' && (body.images !== undefined) && (!body.images || body.images.length === 0)) {
      return reply.code(400).send({ error: 'Cannot remove all images in manhwa mode' });
    }
    // Load existing to apply traitsOps
    const existing = await (prisma as any).character.findFirst({ where: { id: params.charId, projectId: project.id }, select: { traits: true } });
    if (!existing) return reply.code(404).send({ error: 'Not found' });
    let traits: any = undefined;
    if (Array.isArray(body.traitsOps) && body.traitsOps.length) traits = applyTraitsOps(existing.traits || {}, body.traitsOps as any);
    else if (body.traits !== undefined) traits = body.traits;
    const updated = await (prisma as any).character.updateMany({
      where: { id: params.charId, projectId: project.id },
      data: {
        name: body.name ?? undefined,
        role: body.role ?? undefined,
        summary: body.summary ?? undefined,
        imageUrl: Array.isArray(body.images) ? (body.images[0] ?? null) as any : undefined,
        traits: traits === undefined ? undefined : traits,
      },
    } as any);
    if (!updated.count) return reply.code(404).send({ error: 'Not found' });
    // Best-effort: update images JSON column if present
    if (body.images !== undefined) {
      try {
        await (prisma as any).character.update({ where: { id: params.charId }, data: { images: body.images } } as any);
      } catch {}
    }
    const result = await (prisma as any).character.findFirst({ where: { id: params.charId, projectId: project.id }, select: { id: true, name: true, role: true, summary: true, traits: true, imageUrl: true, updatedAt: true } });
    const withImages = { ...(result as any), images: ((result as any)?.images ?? (((result as any)?.imageUrl) ? [(result as any).imageUrl] : [])) };
    return reply.send(withImages);
  });

  app.delete('/project/:id/characters/:charId', async (req, reply) => {
    const params = z.object({ id: z.string().uuid(), charId: z.string().uuid() }).parse(req.params);
    const user = (req as any).user;
    if (!user?.id) return reply.code(401).send({ error: 'Unauthorized' });
    const project = await prisma.project.findFirst({ where: { id: params.id, userId: user.id }, select: { id: true } });
    if (!project) return reply.code(404).send({ error: 'Not found' });
    const del = await (prisma as any).character.deleteMany({ where: { id: params.charId, projectId: project.id } });
    if (!del.count) return reply.code(404).send({ error: 'Not found' });
    return reply.code(204).send();
  });

  done();
};

export default routes;
