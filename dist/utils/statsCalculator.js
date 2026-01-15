"use strict";
/**
 * Stats Calculator - Retroactively calculates user stats from existing database records
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateUserStatsFromDatabase = calculateUserStatsFromDatabase;
exports.initializeUserStats = initializeUserStats;
exports.syncUserStats = syncUserStats;
const prisma_1 = require("../db/prisma");
const expSystem_1 = require("./expSystem");
async function calculateUserStatsFromDatabase(userId) {
    try {
        // Count projects
        const projectsCreated = await prisma_1.prisma.project.count({
            where: { userId },
        });
        // Count chapters
        const chaptersCreated = await prisma_1.prisma.chapter.count({
            where: { project: { userId } },
        });
        // Count characters
        const charactersCreated = await prisma_1.prisma.character.count({
            where: { project: { userId } },
        });
        // Count world settings
        const worldSettingsCreated = await prisma_1.prisma.worldSetting.count({
            where: { project: { userId } },
        });
        // Calculate total words written (sum of all chapter content lengths)
        const chapters = await prisma_1.prisma.chapter.findMany({
            where: { project: { userId } },
            select: { content: true },
        });
        const totalWordsWritten = chapters.reduce((sum, ch) => {
            const wordCount = (ch.content || '').trim().split(/\s+/).length;
            return sum + wordCount;
        }, 0);
        // Count chat messages (interactions)
        const chatMessagesCount = await prisma_1.prisma.chatMessage.count({
            where: { chat: { project: { userId } } },
        });
        // Calculate total EXP based on actions
        let totalExp = 0;
        // Award EXP for each action
        totalExp += projectsCreated * expSystem_1.EXP_REWARDS.CREATE_PROJECT;
        totalExp += chaptersCreated * expSystem_1.EXP_REWARDS.CREATE_CHAPTER;
        totalExp += charactersCreated * expSystem_1.EXP_REWARDS.CREATE_CHARACTER;
        totalExp += worldSettingsCreated * expSystem_1.EXP_REWARDS.CREATE_WORLD_SETTING;
        totalExp += chatMessagesCount * expSystem_1.EXP_REWARDS.CHAT_MESSAGE;
        return {
            projectsCreated,
            chaptersCreated,
            charactersCreated,
            worldSettingsCreated,
            totalWordsWritten,
            chatMessagesCount,
            totalExp,
        };
    }
    catch (err) {
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
async function initializeUserStats(userId) {
    try {
        // Check if stats already exist
        let stats = await prisma_1.prisma.userStats.findUnique({
            where: { userId },
        });
        // Calculate stats from database
        const calculated = await calculateUserStatsFromDatabase(userId);
        if (!stats) {
            // Create new stats with calculated values
            stats = await prisma_1.prisma.userStats.create({
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
        }
        else {
            // Update existing stats with calculated values
            stats = await prisma_1.prisma.userStats.update({
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
    }
    catch (err) {
        console.error('Error initializing user stats:', err);
        throw err;
    }
}
/**
 * Sync user stats - recalculates from database and updates
 * Use this periodically or after bulk operations
 */
async function syncUserStats(userId) {
    return initializeUserStats(userId);
}
//# sourceMappingURL=statsCalculator.js.map