import { createWorker } from '../services/queue';
import { generateImage } from '../services/fal';

type FalImageJob = {
  description: string;
  style?: string | null;
  userId?: string;
  projectId?: string | null;
  panelId?: string | null;
};

type ImageGenerationJob = {
  prompt: string;
  userId?: string;
  projectId?: string | null;
  panelId?: string | null;
  style?: string | null;
};

// Process jobs from both possible queues for compatibility
const falImageWorker = createWorker<FalImageJob, { url: string }, 'fal-image'>(
  'fal-image',
  async (job) => {
    const { description, style } = job.data;

    const url = await generateImage(description, { style: style ?? null });

    return { url };
  }
);

const imageGenerationWorker = createWorker<ImageGenerationJob, { url: string }, 'image-generation'>(
  'image-generation',
  async (job) => {
    const { prompt, style } = job.data;

    const url = await generateImage(prompt, { style: style ?? null });

    return { url };
  }
);

// Keep workers alive
process.on('SIGINT', async () => {
  await Promise.allSettled([falImageWorker.close(), imageGenerationWorker.close()]);
  process.exit(0);
});
