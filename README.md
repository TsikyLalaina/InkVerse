# InkVerse

A modern AI-assisted writing and manhwa creation suite. Compose chapters with a Plot Muse, manage Characters and World entries, and generate panels with image models — all backed by Supabase Postgres and Storage.

<p align="left">
  <a href="https://nextjs.org/"><img alt="Next.js" src="https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white"></a>
  <a href="https://tailwindcss.com/"><img alt="TailwindCSS" src="https://img.shields.io/badge/TailwindCSS-3-38B2AC?logo=tailwindcss&logoColor=white"></a>
  <a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white"></a>
  <a href="https://fastify.dev/"><img alt="Fastify" src="https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white"></a>
  <a href="https://www.prisma.io/"><img alt="Prisma" src="https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white"></a>
  <a href="https://supabase.com/"><img alt="Supabase" src="https://img.shields.io/badge/Supabase-Auth%20%2F%20Storage-3ECF8E?logo=supabase&logoColor=white"></a>
  <a href="https://upstash.com/redis"><img alt="Upstash Redis" src="https://img.shields.io/badge/Redis-Upstash-00E9A3?logo=redis&logoColor=white"></a>
  <a href="https://github.com/taskforcesh/bullmq"><img alt="BullMQ" src="https://img.shields.io/badge/BullMQ-Queues-DB4444?logo=npm&logoColor=white"></a>
  <a href="https://groq.com/"><img alt="Groq" src="https://img.shields.io/badge/Groq-SDK-F15A24?logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTEyIiBoZWlnaHQ9IjExMiIgZmlsbD0ibm9uZSIgdmlld0JveD0iMCAwIDExMiAxMTIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIvPg=="></a>
  <a href="https://fal.ai/"><img alt="Fal.ai" src="https://img.shields.io/badge/Fal.ai-Images-6C63FF"></a>
  <a href="https://opensource.org/licenses/ISC"><img alt="License" src="https://img.shields.io/badge/License-ISC-blue"></a>
</p>

## 📖 Overview

- **Create projects** and write chapters with a focused Plot Muse (SSE streaming via Groq).
- **Separate chats** per project: Plot, Character, and World modes with scoped behaviors.
- **Characters & World** managers with nested traits editors and multiple image uploads to Supabase Storage.
- **Image generation** via Fal.ai Flux models, with optional Redis/BullMQ queue and webhook support.
- **Supabase Auth** guards all `/api` routes; Postgres via Prisma stores projects, chapters, chats, characters, world, and history.
- **Reader view** for quick reading sessions of saved chapters.

## 🗂️ Project Structure

- **client/** Next.js 14 app (App Router), TailwindCSS, Supabase SSR/Auth, PWA files.
- **src/** Fastify server (TypeScript), routes, services, middleware, workers.
- **prisma/** Prisma schema and seed.

```
InkVerse/
├─ client/                # Next.js app (frontend)
│  ├─ src/app/            # Pages (dashboard, auth, project chat)
│  ├─ src/components/     # UI (Workspace, Chat, managers, etc.)
│  ├─ src/lib/            # API wrapper, Supabase SSR client
│  ├─ public/             # Manifest / SW / demo assets
│  └─ next.config.mjs
├─ src/                   # Fastify backend
│  ├─ routes/             # project, chat, generate, webhook
│  ├─ services/           # groq, fal, memory, queue
│  ├─ middleware/         # auth (Supabase)
│  ├─ db/prisma.ts        # Prisma client init
│  └─ workers/            # image worker (BullMQ)
├─ prisma/schema.prisma   # Postgres models
├─ prisma/seed.ts         # Sample seed script
├─ package.json           # Server scripts
└─ client/package.json    # Client scripts
```

## 🧰 Tech Stack

- **Frontend**: Next.js 14, React 18, TailwindCSS, framer-motion, lucide-react
- **Backend**: Fastify 5, Zod, Prisma, BullMQ, ioredis
- **Infra/Services**: Supabase (Auth, Postgres, Storage), Upstash Redis (optional), Groq LLM, Fal.ai images
- **Lang/Tooling**: TypeScript 5, ts-node, nodemon

## 🗃️ Data Model (Prisma)

Key tables: `Project`, `Chapter`, `Branch`, `Chat`, `ChatMessage`, `Character`, `WorldSetting`, `SettingHistory`, enum `Mode { novel, manhwa, convert }`.

## 🔌 API Overview

All API routes are under `/api` and protected by Supabase Auth (Bearer token). Public endpoints: `/health`, `/webhook/fal`.

- **Projects**: `GET/POST /project`, `GET/PATCH/DELETE /project/:id`, `PATCH /project/:id/settings`
- **Chapters**: `POST /project/:id/chapter`, `PATCH /project/:id/chapter/:chapterId`, `DELETE /project/:id/chapter/:chapterId`,
  `GET /project/:id/chapters` (paginated), `GET /project/:id/chapters/summary`
- **Chats (per project)**: `GET/POST /project/:id/chats`, `PATCH/DELETE /project/:id/chats/:chatId`
- **Chat messages**: `GET /chat/:chatId/messages`, `POST /chat/:chatId` (SSE stream)
- **Generate**: `POST /generate/text` (SSE stream), `POST /generate/image` (queue or direct Fal)

## ✅ Prerequisites

- Node.js 18+
- A Supabase project (Auth + Postgres + Storage)
- Optional: Upstash Redis (for queue + caching)
- API keys: Groq, Fal

## 🔧 Environment

Create two env files: one at repo root (server) and one in `client/` (frontend).

- **Server (.env)**

```env
# Server
PORT=3000

# Database (Supabase Postgres)
DATABASE_URL=postgresql://... # Prefer transaction pooler host (port 6543) for production
DIRECT_URL=postgresql://...   # Direct connection URL if needed

# Supabase (server)
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# LLM / Images
GROQ_API_KEY=...
FAL_API_KEY=...

# Redis / Queue (optional)
UPSTASH_REDIS_URL=rediss://...     # Leave empty to disable
DISABLE_QUEUE=false                # or IMAGE_QUEUE_DISABLED=true to force disable
WEBHOOK_BASE_URL=https://api.example.com  # base for /webhook/fal (optional)

# Seeding (optional)
SEED_USER_ID=<uuid-of-existing-user>
# SEED_PROJECT_ID=<uuid>          # optional stable id for upsert
```

- **Client (client/.env.local)**

```env
# Backend API base
NEXT_PUBLIC_API_URL=http://localhost:3000

# Supabase (client)
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>

# Storage buckets (optional overrides)
NEXT_PUBLIC_SUPABASE_CHAR_BUCKET=character-images
NEXT_PUBLIC_SUPABASE_WORLD_BUCKET=world-images
# Or a shared bucket
NEXT_PUBLIC_SUPABASE_IMAGE_BUCKET=images
NEXT_PUBLIC_SUPABASE_BUCKET=images
```

Notes:
- The server’s auth middleware validates Bearer tokens via `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
- For Supabase Postgres, prefer the transaction pooler URL (port 6543) in production.

## 🚀 Install & Run

- **1) Install dependencies**

```bash
# in repo root (server deps)
npm install

# in client/
cd client && npm install
```

- **2) Database**

```bash
# Apply schema
yarn prisma migrate deploy  # or: npm run prisma:migrate
# Generate client (if needed)
npx prisma generate
```

- **3) Development**

```bash
# Terminal A — server (Fastify)
npm run dev

# Terminal B — client (Next.js)
cd client && npm run dev
```

Server listens on `http://localhost:3000` and client on `http://localhost:3000` (Next dev default is 3000; change one if needed). You can set `NEXT_PUBLIC_API_URL` to match your server port.

- **4) Optional: Worker (image queue)**

```bash
npm run worker:image
```

Queue is auto-disabled when `UPSTASH_REDIS_URL` is missing or `DISABLE_QUEUE=true` (or `IMAGE_QUEUE_DISABLED=true`). When disabled, `/api/generate/image` falls back to synchronous Fal generation and returns `{ jobId, url, queued: false }`.

- **5) Optional: Seed**

```bash
SEED_USER_ID=<uuid> npm run seed
```

## 🧠 Development Notes

- **SSE streaming**
  - Text: `POST /api/generate/text` streams tokens.
  - Chat: `POST /api/chat/:chatId` streams assistant output and actions.
- **Chats & modes**
  - Plot, Character, and World chats use different system prompts and strict JSON flows when applying changes.
- **Images**
  - `/api/generate/image` enqueues a Fal job if Redis is available; otherwise generates directly.
  - Webhook endpoint: `POST /webhook/fal` stores result payloads in Redis for retrieval.
- **Storage**
  - Character and World managers upload to Supabase Storage with public URLs. Removal attempts to delete from Storage server-side when possible.

## 📜 Scripts

- Root (server)
  - `npm run dev` — Fastify with ts-node + nodemon
  - `npm run build` — tsc
  - `npm start` — node dist/index.js
  - `npm run prisma:migrate` — prisma migrate deploy
  - `npm run seed` — run Prisma seed
  - `npm run worker:image` — start BullMQ image worker
- Client
  - `npm run dev` — Next dev
  - `npm run build` — Next build
  - `npm start` — Next start
  - `npm run lint`

## 🔐 Security & Keys

- Do not commit secrets. Use `.env` and `client/.env.local`.
- Supabase Service Role Key must remain server-side only.

## 📄 License

ISC

—

If you need help configuring Supabase or Redis, open an issue or check the inline warnings in `src/db/prisma.ts` and `src/services/queue.ts`.
