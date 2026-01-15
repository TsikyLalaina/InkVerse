import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import dotenv from 'dotenv';
import './db/prisma';
import auth from './middleware/auth';
import projectRoutes from './routes/project';
import chatRoutes from './routes/chat';
import generateRoutes, { webhookPlugin as falWebhook } from './routes/generate';
import paymentRoutes from './routes/payment';

// ... imports
import userRoutes from './routes/user';

const app = fastify({
  logger: true,
  bodyLimit: 50 * 1024 * 1024, // 50MB
});

// Register raw-body plugin for Stripe webhooks
// This must be registered BEFORE payload parsing (which happens implicitly but we need to intercept specific routes)
// or global registration with configuration for specific routes.
import rawBody from 'fastify-raw-body';
app.register(rawBody, {
  field: 'rawBody', // attach raw body to req.rawBody
  global: false, // only for routes that enable it
  encoding: 'utf8', // default encoding
  runFirst: true, // run before other body parsers
  routes: ['/api/payment/webhooks/stripe'], // fallback explicit list if config doesn't work
});

const port = Number(process.env.PORT) || 3001;

app.register(cors, {
  origin: true, // Allow all origins for now
  credentials: true,
});

app.register(helmet, {
  global: true,
  contentSecurityPolicy: false, 
});

// Protected API scope, keeps /health public
app.register(async (instance) => {
  instance.register(auth, { optional: true });
  instance.register(projectRoutes);
  instance.register(chatRoutes);
  instance.register(generateRoutes);
  instance.register(userRoutes);
  instance.register(paymentRoutes);
}, { prefix: '/api' });

app
  .listen({ port, host: '0.0.0.0' })
  .then(() => {
    app.log.info(`Server listening on 0.0.0.0:${port}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
