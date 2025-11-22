import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  const userId = process.env.SEED_USER_ID;
  if (!userId) {
    throw new Error('SEED_USER_ID is required in env to run the seed.');
  }

  // Create a sample project
  const project = await prisma.project.upsert({
    where: { id: process.env.SEED_PROJECT_ID || '00000000-0000-0000-0000-000000000000' },
    update: {},
    create: {
      userId,
      title: 'InkVerse Sample Project',
      description: 'A starter project seeded by prisma/seed.ts',
      coverImage: null,
    },
  });

  // Create a sample branch
  const branch = await prisma.branch.create({
    data: {
      projectId: project.id,
      name: 'main',
    },
  });

  // Create a sample chapter
  const chapter = await prisma.chapter.create({
    data: {
      projectId: project.id,
      title: 'Chapter 1: Awakening',
      content: 'Our hero awakens to a strange new world... ',
      panelScript: { panels: [] },
      branchId: branch.id,
      order: 1,
      isCanon: true,
    },
  });

  // Link base chapter to branch
  await prisma.branch.update({
    where: { id: branch.id },
    data: { baseChapterId: chapter.id },
  });

  // Seed a sample chat message
  const chat = await prisma.chat.create({
    data: {
      projectId: project.id,
      type: 'plot',
      title: 'Main Plot',
    },
  });

  await prisma.chatMessage.create({
    data: {
      chatId: chat.id,
      role: 'user',
      content: 'Generate a mysterious prologue for the manhwa.',
      panelId: chapter.id,
    },
  });

  console.log('Seed completed:', { projectId: project.id, branchId: branch.id, chapterId: chapter.id });
}

main()
  .catch(async (e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
