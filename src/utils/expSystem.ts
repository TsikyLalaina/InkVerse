/**
 * EXP and Level System
 * Uses exponential progression: EXP Required = Base × (Level ^ Exponent)
 */

const BASE_EXP = 100;
const EXPONENT = 1.5;
const MAX_LEVEL = 100;

/**
 * Calculate total EXP required to reach a specific level
 */
export function getTotalExpForLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += getExpForLevelUp(i);
  }
  return total;
}

/**
 * Calculate EXP required to go from level N to N+1
 */
export function getExpForLevelUp(level: number): number {
  return Math.floor(BASE_EXP * Math.pow(level, EXPONENT));
}

/**
 * Calculate current level and progress based on total EXP
 */
export function calculateLevelFromExp(totalExp: number): {
  level: number;
  currentLevelExp: number;
  nextLevelExp: number;
  progressPercent: number;
} {
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
export const EXP_REWARDS = {
  CREATE_PROJECT: 50,
  CREATE_CHAPTER: 25,
  UPDATE_CHAPTER: 10,
  CREATE_CHARACTER: 15,
  CREATE_WORLD_SETTING: 15,
  CHAT_MESSAGE: 5,
  EXPORT_PROJECT: 30,
} as const;

/**
 * Award EXP and return updated level info
 */
export function awardExp(currentTotalExp: number, expAmount: number) {
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
