import fp from 'fastify-plugin';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Initialize once; supabase-js will call the auth endpoint to verify tokens
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const AuthHeaderSchema = z.object({
  authorization: z.string().optional(),
});

export type AuthPluginOptions = {
  optional?: boolean; // allow public routes while attaching user if provided
};

async function handleAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  optional: boolean
) {
  if (!supabase) {
    request.log.error('Supabase client not configured. Check SUPABASE_URL and SUPABASE_ANON_KEY');
    return reply.code(500).send({ error: 'Server auth not configured' });
  }

  const parsed = AuthHeaderSchema.safeParse(request.headers);
  if (!parsed.success) {
    if (optional) return; // proceed unauthenticated
    return reply.code(401).send({ error: 'Missing Authorization header' });
  }

  const authHeader = parsed.data.authorization;
  if (!authHeader) {
    if (optional) return;
    return reply.code(401).send({ error: 'Missing Authorization header' });
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    if (optional) return; // ignore malformed when optional
    return reply.code(401).send({ error: 'Invalid Authorization format' });
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    if (optional) return; // proceed unauthenticated
    return reply.code(401).send({ error: 'Invalid or expired token' });
  }

  // Attach user info to request
  (request as any).user = { id: data.user.id, email: data.user.email };
}

const authPlugin: FastifyPluginCallback<AuthPluginOptions> = (fastify, opts, done) => {
  const optional = Boolean(opts?.optional);

  fastify.addHook('onRequest', async (request, reply) => {
    await handleAuth(request, reply, optional);
  });

  done();
};

export default fp(authPlugin, {
  name: 'auth-plugin',
});
