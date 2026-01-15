"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const helmet_1 = __importDefault(require("@fastify/helmet"));
require("./db/prisma");
const auth_1 = __importDefault(require("./middleware/auth"));
const project_1 = __importDefault(require("./routes/project"));
const chat_1 = __importDefault(require("./routes/chat"));
const generate_1 = __importDefault(require("./routes/generate"));
const payment_1 = __importDefault(require("./routes/payment"));
// ... imports
const user_1 = __importDefault(require("./routes/user"));
const app = (0, fastify_1.default)({
    logger: true,
    bodyLimit: 50 * 1024 * 1024, // 50MB
});
// Register raw-body plugin for Stripe webhooks
// This must be registered BEFORE payload parsing (which happens implicitly but we need to intercept specific routes)
// or global registration with configuration for specific routes.
const fastify_raw_body_1 = __importDefault(require("fastify-raw-body"));
app.register(fastify_raw_body_1.default, {
    field: 'rawBody', // attach raw body to req.rawBody
    global: false, // only for routes that enable it
    encoding: 'utf8', // default encoding
    runFirst: true, // run before other body parsers
    routes: ['/api/payment/webhooks/stripe'], // fallback explicit list if config doesn't work
});
const port = Number(process.env.PORT) || 3001;
app.register(cors_1.default, {
    origin: true, // Allow all origins for now
    credentials: true,
});
app.register(helmet_1.default, {
    global: true,
    contentSecurityPolicy: false,
});
// Protected API scope, keeps /health public
app.register(async (instance) => {
    instance.register(auth_1.default, { optional: true });
    instance.register(project_1.default);
    instance.register(chat_1.default);
    instance.register(generate_1.default);
    instance.register(user_1.default);
    instance.register(payment_1.default);
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
//# sourceMappingURL=index.js.map