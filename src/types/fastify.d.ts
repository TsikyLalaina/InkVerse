import { FastifyRequest, FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    auth: any;
    prisma: any;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email?: string;
    };
    rawBody?: Buffer;
  }
}
