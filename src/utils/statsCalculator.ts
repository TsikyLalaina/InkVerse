/**
 * Stats Calculator - Retroactively calculates user stats from existing database records
 */

import { prisma } from '../db/prisma';
import { awardExp, EXP_REWARDS } from './expSystem';

export async function calculateUserStatsFromDatabase(userId: string) {
  try {
    // Count projects
    const projectsCreated = await prisma.project.count({
      where: { userId },
    });

    // Count chapters
    const chaptersCreated = await prisma.chapter.count({
      where: { project: { userId } },
    });

    // Count characters
    const charactersCreated = await prisma.character.count({
      where: { project: { userId } },
    });

    // Count world settings
    const worldSettingsCreated = await prisma.worldSetting.count({
      where: { project: { userId } },
    });

    // Calculate total words written (sum of all chapter content lengths)
    const chapters = await prisma.chapter.findMany({
      where: { project: { userId } },
      select: { content: true },
    });
    const totalWordsWritten = chapters.reduce((sum, ch) => {
      const wordCount = (ch.content || '').trim().split(/\s+/).length;
      return sum + wordCount;
    }, 0);

    // Count chat messages (interactions)
    const chatMessagesCount = await prisma.chatMessage.count({
      where: { chat: { project: { userId } } },
    });

    // Calculate total EXP based on actions
    let totalExp = 0;

    // Award EXP for each action
    totalExp += projectsCreated * EXP_REWARDS.CREATE_PROJECT;
    totalExp += chaptersCreated * EXP_REWARDS.CREATE_CHAPTER;
    totalExp += charactersCreated * EXP_REWARDS.CREATE_CHARACTER;
    totalExp += worldSettingsCreated * EXP_REWARDS.CREATE_WORLD_SETTING;
    totalExp += chatMessagesCount * EXP_REWARDS.CHAT_MESSAGE;

    return {
      projectsCreated,
      chaptersCreated,
      charactersCreated,
      worldSettingsCreated,
      totalWordsWritten,
      chatMessagesCount,
      totalExp,
    };
  } catch (err) {
    console.error('Error calculating user stats:', err);
    return {
      projectsCreated: 0,
      chaptersCreated: 0,
      charactersCreated: 0,
      worldSettingsCreated: 0,
      totalWordsWritten: 0,
      chatMessagesCount: 0,
      totalExp: 0,
    };
  }
}

/**
 * Initialize or update user stats from database records
 * Call this when a user first logs in or periodically to sync stats
 */
export async function initializeUserStats(userId: string) {
  try {
    // Check if stats already exist
    let stats = await prisma.userStats.findUnique({
      where: { userId },
    });

    // Calculate stats from database
    const calculated = await calculateUserStatsFromDatabase(userId);

    if (!stats) {
      // Create new stats with calculated values
      stats = await prisma.userStats.create({
        data: {
          userId,
          totalExp: calculated.totalExp,
          projectsCreated: calculated.projectsCreated,
          chaptersCreated: calculated.chaptersCreated,
          charactersCreated: calculated.charactersCreated,
          worldSettingsCreated: calculated.worldSettingsCreated,
          totalWordsWritten: calculated.totalWordsWritten,
        },
      });
    } else {
      // Update existing stats with calculated values
      stats = await prisma.userStats.update({
        where: { userId },
        data: {
          totalExp: calculated.totalExp,
          projectsCreated: calculated.projectsCreated,
          chaptersCreated: calculated.chaptersCreated,
          charactersCreated: calculated.charactersCreated,
          worldSettingsCreated: calculated.worldSettingsCreated,
          totalWordsWritten: calculated.totalWordsWritten,
          updatedAt: new Date(),
        },
      });
    }

    return stats;
  } catch (err) {
    console.error('Error initializing user stats:', err);
    throw err;
  }
}

/**
 * Sync user stats - recalculates from database and updates
 * Use this periodically or after bulk operations
 */
export async function syncUserStats(userId: string) {
  return initializeUserStats(userId);
}
