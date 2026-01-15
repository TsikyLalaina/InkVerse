"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const supabase_js_1 = require("@supabase/supabase-js");
const zod_1 = require("zod");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
// Initialize once; supabase-js will call the auth endpoint to verify tokens
const supabase = supabaseUrl && supabaseAnonKey
    ? (0, supabase_js_1.createClient)(supabaseUrl, supabaseAnonKey)
    : null;
const AuthHeaderSchema = zod_1.z.object({
    authorization: zod_1.z.string().optional(),
});
async function handleAuth(request, reply, optional) {
    if (!supabase) {
        request.log.error('Supabase client not configured. Check SUPABASE_URL and SUPABASE_ANON_KEY');
        return reply.code(500).send({ error: 'Server auth not configured' });
    }
    const parsed = AuthHeaderSchema.safeParse(request.headers);
    if (!parsed.success) {
        if (optional)
            return; // proceed unauthenticated
        return reply.code(401).send({ error: 'Missing Authorization header' });
    }
    const authHeader = parsed.data.authorization;
    if (!authHeader) {
        if (optional)
            return;
        return reply.code(401).send({ error: 'Missing Authorization header' });
    }
    const [scheme, token] = authHeader.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
        if (optional)
            return; // ignore malformed when optional
        return reply.code(401).send({ error: 'Invalid Authorization format' });
    }
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
        if (optional)
            return; // proceed unauthenticated
        return reply.code(401).send({ error: 'Invalid or expired token' });
    }
    // Attach user info to request
    request.user = { id: data.user.id, email: data.user.email };
}
const authPlugin = (fastify, opts, done) => {
    const optional = Boolean(opts?.optional);
    fastify.addHook('onRequest', async (request, reply) => {
        await handleAuth(request, reply, optional);
    });
    // Verify authentication decorator
    fastify.decorate('auth', async (request, reply) => {
        if (!request.user) {
            return reply.code(401).send({ error: 'Unauthorized' });
        }
    });
    done();
};
exports.default = (0, fastify_plugin_1.default)(authPlugin, {
    name: 'auth-plugin',
});
//# sourceMappingURL=auth.js.map