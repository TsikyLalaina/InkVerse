import { FastifyPluginCallback } from 'fastify';
import { prisma } from '../db/prisma';
import { calculateLevelFromExp, EXP_REWARDS, awardExp } from '../utils/expSystem';
import { initializeUserStats, syncUserStats } from '../utils/statsCalculator';

const routes: FastifyPluginCallback = (app, _opts, done) => {
  /**
   * GET /api/user/stats
   * Get current user's stats (level, exp, achievements)
   */
  app.get('/user/stats', async (req, reply) => {
    const user = (req as any).user;
    if (!user?.id) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      let stats = await prisma.userStats.findUnique({
        where: { userId: user.id },
      });

      // Initialize stats from database if they don't exist
      if (!stats) {
        stats = await initializeUserStats(user.id);
      }

      const levelInfo = calculateLevelFromExp(stats.totalExp);

      return reply.send({
        id: stats.id,
        userId: stats.userId,
        level: levelInfo.level,
        totalExp: stats.totalExp,
        currentLevelExp: levelInfo.currentLevelExp,
        nextLevelExp: levelInfo.nextLevelExp,
        progressPercent: levelInfo.progressPercent,
        chaptersCreated: stats.chaptersCreated,
        charactersCreated: stats.charactersCreated,
        worldSettingsCreated: stats.worldSettingsCreated,
        projectsCreated: stats.projectsCreated,
        totalWordsWritten: stats.totalWordsWritten,
      });
    } catch (err) {
      req.log.error(err);
      return reply.code(500).send({ error: 'Failed to fetch user stats' });
    }
  });

  /**
   * POST /api/user/stats/award
   * Award EXP to user (internal endpoint)
   * Body: { action: string, amount?: number }
   */
  app.post('/user/stats/award', async (req, reply) => {
    const user = (req as any).user;
    if (!user?.id) return reply.code(401).send({ error: 'Unauthorized' });

    const { action, amount } = req.body as { action: string; amount?: number };

    try {
      // Get or create user stats
      let stats = await prisma.userStats.findUnique({
        where: { userId: user.id },
      });

      if (!stats) {
        stats = await prisma.userStats.create({
          data: { userId: user.id },
        });
      }

      // Determine EXP amount
      const expAmount =
        amount ||
        (EXP_REWARDS[action as keyof typeof EXP_REWARDS] as number) ||
        0;

      if (expAmount <= 0) {
        return reply.code(400).send({ error: 'Invalid action or amount' });
      }

      // Award EXP
      const result = awardExp(stats.totalExp, expAmount);

      // Update stats
      const updated = await prisma.userStats.update({
        where: { userId: user.id },
        data: {
          totalExp: result.totalExp,
          updatedAt: new Date(),
        },
      });

      const levelInfo = calculateLevelFromExp(updated.totalExp);

      return reply.send({
        success: true,
        expAwarded: expAmount,
        leveledUp: result.leveledUp,
        newLevel: levelInfo.level,
        totalExp: updated.totalExp,
        currentLevelExp: levelInfo.currentLevelExp,
        nextLevelExp: levelInfo.nextLevelExp,
        progressPercent: levelInfo.progressPercent,
      });
    } catch (err) {
      req.log.error(err);
      return reply.code(500).send({ error: 'Failed to award EXP' });
    }
  });

  /**
   * PATCH /api/user/stats/increment
   * Increment counters (chapters, characters, etc.)
   * Body: { field: string, amount?: number }
   */
  app.patch('/user/stats/increment', async (req, reply) => {
    const user = (req as any).user;
    if (!user?.id) return reply.code(401).send({ error: 'Unauthorized' });

    const { field, amount = 1 } = req.body as {
      field: string;
      amount?: number;
    };

    const validFields = [
      'chaptersCreated',
      'charactersCreated',
      'worldSettingsCreated',
      'projectsCreated',
      'totalWordsWritten',
    ];

    if (!validFields.includes(field)) {
      return reply.code(400).send({ error: 'Invalid field' });
    }

    try {
      let stats = await prisma.userStats.findUnique({
        where: { userId: user.id },
      });

      if (!stats) {
        stats = await prisma.userStats.create({
          data: { userId: user.id },
        });
      }

      const updated = await prisma.userStats.update({
        where: { userId: user.id },
        data: {
          [field]: (stats[field as keyof typeof stats] as number) + amount,
          updatedAt: new Date(),
        },
      });

      return reply.send({
        success: true,
        field,
        newValue: updated[field as keyof typeof updated],
      });
    } catch (err) {
      req.log.error(err);
      return reply.code(500).send({ error: 'Failed to increment stat' });
    }
  });

  /**
   * POST /api/user/stats/sync
   * Recalculate and sync user stats from database records
   * This retroactively calculates EXP from existing projects, chapters, characters, etc.
   */
  app.post('/user/stats/sync', async (req, reply) => {
    const user = (req as any).user;
    if (!user?.id) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      const stats = await syncUserStats(user.id);
      const levelInfo = calculateLevelFromExp(stats.totalExp);

      return reply.send({
        success: true,
        message: 'Stats synced from database records',
        level: levelInfo.level,
        totalExp: stats.totalExp,
        currentLevelExp: levelInfo.currentLevelExp,
        nextLevelExp: levelInfo.nextLevelExp,
        progressPercent: levelInfo.progressPercent,
        projectsCreated: stats.projectsCreated,
        chaptersCreated: stats.chaptersCreated,
        charactersCreated: stats.charactersCreated,
        worldSettingsCreated: stats.worldSettingsCreated,
        totalWordsWritten: stats.totalWordsWritten,
      });
    } catch (err) {
      req.log.error(err);
      return reply.code(500).send({ error: 'Failed to sync stats' });
    }
  });

  /**
   * GET /api/user/profile
   * Get current user's profile (username, profilePhoto, theme)
   */
  app.get('/user/profile', async (req, reply) => {
    const user = (req as any).user;
    if (!user?.id) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      const profile = await prisma.userProfile.findUnique({
        where: { userId: user.id },
      });

      return reply.send({
        userId: user.id,
        email: user.email,
        username: profile?.username || null,
        profilePhoto: profile?.profilePhoto || null,
        theme: profile?.theme === 'dark' ? 'dark' : 'light',
      });
    } catch (err) {
      req.log.error(err);
      return reply.code(500).send({ error: 'Failed to fetch profile' });
    }
  });

  /**
   * POST /api/user/check-username
   * Check if username is available
   * Body: { username: string }
   */
  app.post('/user/check-username', async (req, reply) => {
    const { username } = req.body as { username?: string };

    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      return reply.code(400).send({ error: 'Username is required' });
    }

    const trimmed = username.trim();

    // Validate username format (alphanumeric, underscore, hyphen, 3-20 chars)
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(trimmed)) {
      return reply.code(400).send({ 
        error: 'Username must be 3-20 characters and contain only letters, numbers, underscores, and hyphens' 
      });
    }

    try {
      const existing = await prisma.userProfile.findUnique({
        where: { username: trimmed },
      });

      return reply.send({
        available: !existing,
        username: trimmed,
      });
    } catch (err) {
      req.log.error(err);
      return reply.code(500).send({ error: 'Failed to check username' });
    }
  });

  /**
   * PATCH /api/user/profile
   * Update current user's profile (username, profilePhoto, theme)
   * Body: { username?: string, profilePhoto?: string, theme?: string }
   */
  app.patch('/user/profile', async (req, reply) => {
    const user = (req as any).user;
    if (!user?.id) return reply.code(401).send({ error: 'Unauthorized' });

    const { username, profilePhoto, theme } = req.body as { username?: string; profilePhoto?: string; theme?: string };

    try {
      // If username is provided, validate and check availability
      if (username !== undefined) {
        if (typeof username !== 'string' || username.trim().length === 0) {
          return reply.code(400).send({ error: 'Username must be a non-empty string' });
        }

        const trimmed = username.trim();

        // Validate username format
        if (!/^[a-zA-Z0-9_-]{3,20}$/.test(trimmed)) {
          return reply.code(400).send({ 
            error: 'Username must be 3-20 characters and contain only letters, numbers, underscores, and hyphens' 
          });
        }

        // Check if username is already taken by another user
        const existing = await prisma.userProfile.findUnique({
          where: { username: trimmed },
        });

        if (existing && existing.userId !== user.id) {
          return reply.code(409).send({ error: 'Username is already taken' });
        }

        // Upsert user profile with new username
        await prisma.userProfile.upsert({
          where: { userId: user.id },
          update: { username: trimmed, updatedAt: new Date() },
          create: { userId: user.id, username: trimmed },
        });
      }

      // Update profilePhoto if provided
      if (profilePhoto !== undefined) {
        await prisma.userProfile.upsert({
          where: { userId: user.id },
          update: { profilePhoto, updatedAt: new Date() },
          create: { userId: user.id, username: `user_${user.id.slice(0, 8)}`, profilePhoto },
        });
      }

      // Update theme if provided
      if (theme !== undefined) {
        if (!['light', 'dark'].includes(theme)) {
          return reply.code(400).send({ error: 'Theme must be "light" or "dark"' });
        }
        await prisma.userProfile.upsert({
          where: { userId: user.id },
          update: { theme, updatedAt: new Date() },
          create: { userId: user.id, username: `user_${user.id.slice(0, 8)}`, theme },
        });
      }

      const profile = await prisma.userProfile.findUnique({
        where: { userId: user.id },
      });

      return reply.send({
        success: true,
        userId: user.id,
        email: user.email,
        username: profile?.username || null,
        profilePhoto: profile?.profilePhoto || null,
        theme: profile?.theme || 'system',
        message: 'Profile updated successfully',
      });
    } catch (err) {
      req.log.error(err);
      return reply.code(500).send({ error: 'Failed to update profile' });
    }
  });

  done();
};

export default routes;
