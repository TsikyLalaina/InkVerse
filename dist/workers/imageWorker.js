"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const queue_1 = require("../services/queue");
const fal_1 = require("../services/fal");
// Process jobs from both possible queues for compatibility
const falImageWorker = (0, queue_1.createWorker)('fal-image', async (job) => {
    const { description, style } = job.data;
    const url = await (0, fal_1.generateImage)(description, { style: style ?? null });
    return { url };
});
const imageGenerationWorker = (0, queue_1.createWorker)('image-generation', async (job) => {
    const { prompt, style } = job.data;
    const url = await (0, fal_1.generateImage)(prompt, { style: style ?? null });
    return { url };
});
// Keep workers alive
process.on('SIGINT', async () => {
    await Promise.allSettled([falImageWorker.close(), imageGenerationWorker.close()]);
    process.exit(0);
});
//# sourceMappingURL=imageWorker.js.map