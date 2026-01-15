"use strict";
/**
 * EXP Awarder - Helper to award EXP and increment stats after user actions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.awardExpForAction = awardExpForAction;
exports.countWords = countWords;
const prisma_1 = require("../db/prisma");
const expSystem_1 = require("./expSystem");
/**
 * Award EXP and increment stat counter for a user action
 * Returns updated stats and level info
 */
async function awardExpForAction(userId, action, options) {
    try {
        // Get or create user stats
        let stats = await prisma_1.prisma.userStats.findUnique({
            where: { userId },
        });
        if (!stats) {
            stats = await prisma_1.prisma.userStats.create({
                data: { userId },
            });
        }
        // Get EXP amount for this action
        const expAmount = expSystem_1.EXP_REWARDS[action] || 0;
        const newTotalExp = stats.totalExp + expAmount;
        // Determine which stat field to increment
        let updateData = {
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
            updateData[options.statField] = (stats[options.statField] || 0) + options.statAmount;
        }
        // Update stats
        const updated = await prisma_1.prisma.userStats.update({
            where: { userId },
            data: updateData,
        });
        // Calculate level info
        const levelInfo = (0, expSystem_1.calculateLevelFromExp)(updated.totalExp);
        const oldLevelInfo = (0, expSystem_1.calculateLevelFromExp)(stats.totalExp);
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
    }
    catch (err) {
        console.error(`Error awarding EXP for action ${action}:`, err);
        throw err;
    }
}
/**
 * Count words in text
 */
function countWords(text) {
    return text.trim().split(/\s+/).length;
}
//# sourceMappingURL=expAwarder.js.map