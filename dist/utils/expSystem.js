"use strict";
/**
 * EXP and Level System
 * Uses exponential progression: EXP Required = Base × (Level ^ Exponent)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXP_REWARDS = void 0;
exports.getTotalExpForLevel = getTotalExpForLevel;
exports.getExpForLevelUp = getExpForLevelUp;
exports.calculateLevelFromExp = calculateLevelFromExp;
exports.awardExp = awardExp;
const BASE_EXP = 100;
const EXPONENT = 1.5;
const MAX_LEVEL = 100;
/**
 * Calculate total EXP required to reach a specific level
 */
function getTotalExpForLevel(level) {
    if (level <= 1)
        return 0;
    let total = 0;
    for (let i = 1; i < level; i++) {
        total += getExpForLevelUp(i);
    }
    return total;
}
/**
 * Calculate EXP required to go from level N to N+1
 */
function getExpForLevelUp(level) {
    return Math.floor(BASE_EXP * Math.pow(level, EXPONENT));
}
/**
 * Calculate current level and progress based on total EXP
 */
function calculateLevelFromExp(totalExp) {
    let level = 1;
    let accumulatedExp = 0;
    for (let i = 1; i <= MAX_LEVEL; i++) {
        const expForThisLevel = getExpForLevelUp(i);
        if (accumulatedExp + expForThisLevel > totalExp) {
            level = i;
            const currentLevelExp = totalExp - accumulatedExp;
            const nextLevelExp = expForThisLevel;
            const progressPercent = Math.round((currentLevelExp / nextLevelExp) * 100);
            return { level, currentLevelExp, nextLevelExp, progressPercent };
        }
        accumulatedExp += expForThisLevel;
    }
    // Max level reached
    return {
        level: MAX_LEVEL,
        currentLevelExp: totalExp - accumulatedExp,
        nextLevelExp: 0,
        progressPercent: 100,
    };
}
/**
 * EXP rewards for different actions
 */
exports.EXP_REWARDS = {
    CREATE_PROJECT: 50,
    CREATE_CHAPTER: 25,
    UPDATE_CHAPTER: 10,
    CREATE_CHARACTER: 15,
    CREATE_WORLD_SETTING: 15,
    CHAT_MESSAGE: 5,
    EXPORT_PROJECT: 30,
};
/**
 * Award EXP and return updated level info
 */
function awardExp(currentTotalExp, expAmount) {
    const newTotalExp = currentTotalExp + expAmount;
    const oldLevel = calculateLevelFromExp(currentTotalExp).level;
    const newLevelInfo = calculateLevelFromExp(newTotalExp);
    const leveledUp = newLevelInfo.level > oldLevel;
    return {
        totalExp: newTotalExp,
        leveledUp,
        oldLevel,
        newLevel: newLevelInfo.level,
        levelInfo: newLevelInfo,
    };
}
//# sourceMappingURL=expSystem.js.map