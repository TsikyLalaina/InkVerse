import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import dotenv from 'dotenv';
import './db/prisma';
import auth from './middleware/auth';
import projectRoutes from './routes/project';
import chatRoutes from './routes/chat';
import generateRoutes, { webhookPlugin as falWebhook } from './routes/generate';

dotenv.config();

const app = fastify({ logger: true });

app.register(cors, { origin: true });
app.register(helmet);

app.get('/health', async () => {
  return { status: 'ok' };
});

// Public webhook endpoint for Fal
app.register(falWebhook);

const port = Number(process.env.PORT) || 3000;

// Protected API scope, keeps /health public
app.register(async (instance) => {
  instance.register(auth, { optional: false });
  instance.register(projectRoutes);
  instance.register(chatRoutes);
  instance.register(generateRoutes);
}, { prefix: '/api' });

app
  .listen({ port, host: '0.0.0.0' })
  .then(() => {
    app.log.info(`Server listening on http://localhost:${port}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
