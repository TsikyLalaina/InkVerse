import { prisma } from '../db/prisma';

export interface ChapterContext {
  id: string;
  title: string;
  content: string | null;
  order: number;
  price: number;
  createdAt: Date | null;
  updatedAt: Date | null;
  branchId: string | null;
}

/**
 * Recursively fetches the full chapter history for a given branch.
 * Includes:
 * 1. The branch's own chapters.
 * 2. Inherited chapters from the base chapter (and its ancestry).
 */
export async function getBranchContextChapters(branchId: string): Promise<ChapterContext[]> {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    include: {
      baseChapter: {
        select: { id: true, order: true, branchId: true, projectId: true, createdAt: true }
      },
      project: { select: { id: true } }
    }
  });

  if (!branch) return [];

  // Recursive step: Get ancestry of the base chapter
  let inherited: ChapterContext[] = [];
  if (branch.baseChapter) {
    inherited = await getChapterAncestry(branch.baseChapter);
  }

  // Current branch chapters
  const currentChapters = await prisma.chapter.findMany({
    where: { branchId: branchId },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    select: { 
      id: true, title: true, content: true, order: true, 
      price: true, createdAt: true, updatedAt: true, branchId: true 
    }
  });

  return [...inherited, ...currentChapters];
}

async function getChapterAncestry(chapter: { id: string, order: number, branchId: string | null, projectId: string, createdAt: Date | null }): Promise<ChapterContext[]> {
  // If branchId is null, it's main timeline.
  // Fetch main timeline chapters <= order
  if (!chapter.branchId) {
    const chapters = await prisma.chapter.findMany({
      where: {
        projectId: chapter.projectId,
        branchId: null,
        OR: [
          { order: { lt: chapter.order } },
          { order: chapter.order, createdAt: { lte: chapter.createdAt ?? new Date() } }
        ]
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: { 
        id: true, title: true, content: true, order: true, 
        price: true, createdAt: true, updatedAt: true, branchId: true
      }
    });
    return chapters;
  }

  // If branchId is set, it belongs to a parent branch.
  // 1. Get that parent branch.
  const parentBranch = await prisma.branch.findUnique({
    where: { id: chapter.branchId },
    include: { baseChapter: { select: { id: true, order: true, branchId: true, projectId: true, createdAt: true } } }
  });

  if (!parentBranch) {
    // Fallback: just return empty for this segment if broken reference
    return [];
  }

  // 2. Recurse for parent's base
  let ancestors: ChapterContext[] = [];
  if (parentBranch.baseChapter) {
    ancestors = await getChapterAncestry(parentBranch.baseChapter);
  }

  // 3. Get parent branch chapters <= current chapter order
  const segment = await prisma.chapter.findMany({
    where: {
      branchId: parentBranch.id,
      OR: [
        { order: { lt: chapter.order } },
        { order: chapter.order, createdAt: { lte: chapter.createdAt ?? new Date() } }
      ]
    },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    select: { 
      id: true, title: true, content: true, order: true, 
      price: true, createdAt: true, updatedAt: true, branchId: true
    }
  });

  return [...ancestors, ...segment];
}
