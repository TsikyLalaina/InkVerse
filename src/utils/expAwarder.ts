/**
 * EXP Awarder - Helper to award EXP and increment stats after user actions
 */

import { prisma } from '../db/prisma';
import { EXP_REWARDS, calculateLevelFromExp } from './expSystem';

export type ActionType = keyof typeof EXP_REWARDS;

/**
 * Award EXP and increment stat counter for a user action
 * Returns updated stats and level info
 */
export async function awardExpForAction(
  userId: string,
  action: ActionType,
  options?: {
    wordCount?: number; // For chapter creation/update
    statField?: string; // Custom stat field to increment
    statAmount?: number; // Amount to increment by
  }
) {
  try {
    // Get or create user stats
    let stats = await prisma.userStats.findUnique({
      where: { userId },
    });

    if (!stats) {
      stats = await prisma.userStats.create({
        data: { userId },
      });
    }

    // Get EXP amount for this action
    const expAmount = EXP_REWARDS[action] || 0;
    const newTotalExp = stats.totalExp + expAmount;

    // Determine which stat field to increment
    let updateData: any = {
      totalExp: newTotalExp,
      updatedAt: new Date(),
    };

    // Auto-increment relevant stat fields based on action
    switch (action) {
      case 'CREATE_PROJECT':
        updateData.projectsCreated = (stats.projectsCreated || 0) + 1;
        break;
      case 'CREATE_CHAPTER':
        updateData.chaptersCreated = (stats.chaptersCreated || 0) + 1;
        if (options?.wordCount) {
          updateData.totalWordsWritten = (stats.totalWordsWritten || 0) + options.wordCount;
        }
        break;
      case 'UPDATE_CHAPTER':
        if (options?.wordCount) {
          updateData.totalWordsWritten = (stats.totalWordsWritten || 0) + options.wordCount;
        }
        break;
      case 'CREATE_CHARACTER':
        updateData.charactersCreated = (stats.charactersCreated || 0) + 1;
        break;
      case 'CREATE_WORLD_SETTING':
        updateData.worldSettingsCreated = (stats.worldSettingsCreated || 0) + 1;
        break;
      case 'CHAT_MESSAGE':
        // Chat messages don't have a dedicated counter, just award EXP
        break;
      case 'EXPORT_PROJECT':
        // Export doesn't have a dedicated counter, just award EXP
        break;
    }

    // Custom stat increment if provided
    if (options?.statField && options?.statAmount) {
      updateData[options.statField] = (stats[options.statField as keyof typeof stats] as number || 0) + options.statAmount;
    }

    // Update stats
    const updated = await prisma.userStats.update({
      where: { userId },
      data: updateData,
    });

    // Calculate level info
    const levelInfo = calculateLevelFromExp(updated.totalExp);
    const oldLevelInfo = calculateLevelFromExp(stats.totalExp);
    const leveledUp = levelInfo.level > oldLevelInfo.level;

    return {
      success: true,
      expAwarded: expAmount,
      newTotalExp: updated.totalExp,
      level: levelInfo.level,
      leveledUp,
      levelUpFrom: oldLevelInfo.level,
      levelUpTo: levelInfo.level,
      currentLevelExp: levelInfo.currentLevelExp,
      nextLevelExp: levelInfo.nextLevelExp,
      progressPercent: levelInfo.progressPercent,
      stats: {
        projectsCreated: updated.projectsCreated,
        chaptersCreated: updated.chaptersCreated,
        charactersCreated: updated.charactersCreated,
        worldSettingsCreated: updated.worldSettingsCreated,
        totalWordsWritten: updated.totalWordsWritten,
      },
    };
  } catch (err) {
    console.error(`Error awarding EXP for action ${action}:`, err);
    throw err;
  }
}

/**
 * Count words in text
 */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).length;
}
