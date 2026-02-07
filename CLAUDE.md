# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WhatsApp Blast AI is a **WhatsApp marketing automation platform** built as a monorepo using Turborepo. It integrates with WhatsApp via Baileys (unofficial API) for multi-session message blasting, AI chatbots, and campaign management.

**Important**: This is a non-SaaS, single-tenant application. Each deployment serves a single user/organization.

## Architecture

```
burhan2ws/
├── apps/
│   ├── web/          # Next.js 16 frontend
│   └── api/          # Express.js backend (port 3001)
└── packages/
    ├── ui/           # Shared React components
    ├── auth/         # Better Auth integration
    ├── database/     # Drizzle ORM + PostgreSQL
    └── whatsapp/     # Baileys WhatsApp client wrapper
```

**Key architectural patterns:**
- **Monorepo**: Turborepo manages build dependencies and parallel execution
- **Real-time**: Socket.io connects frontend to backend for live WhatsApp status and message updates
- **Shared database**: All services use the same PostgreSQL instance via Drizzle ORM
- **WhatsApp instances**: Stored in-memory (`whatsappInstances` Map) for active sessions, persisted to database for session state

## Common Commands

```bash
# Development
npm run dev              # Start all services (web on :3000, api on :3001)
npm run build            # Build all packages
npm run start            # Start production servers

# Database (Drizzle ORM)
npm run db:generate      # Generate migrations from schema changes
npm run db:migrate       # Run pending migrations
npm run db:push          # Push schema directly to database (dev only)
npm run db:studio        # Open Drizzle Studio GUI

# Code quality
npm run lint             # Run ESLint
npm run format           # Format with Prettier

# Docker
npm run docker:up        # Start all containers (postgres, redis, api, web, nginx)
npm run docker:down      # Stop all containers

# Utility
npm run reset:users      # Reset all user data (api script)
```

## Environment Variables

Required in `.env` at root:

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/whatsapp_blast"
BETTER_AUTH_SECRET="random-secret-key"
DATA_PATH="./data"                    # Upload storage
PORT=3001                             # API port
FRONTEND_URL="http://localhost:3000"  # CORS origin
NEXT_PUBLIC_API_URL="http://localhost:3001"  # Frontend uses this for API/Socket
```

## Database Schema (Drizzle ORM)

Schema files in `packages/database/src/schema/`:
- `users.ts` - User accounts
- `whatsapp-sessions.ts` - Multi-session WhatsApp connection state
- `contacts.ts` - Contact lists with custom JSON data
- `campaigns.ts` - Blast campaigns with scheduling
- `campaign-recipients` - Join table for campaign contacts
- `conversations.ts` - Chat history with takeover mode
- `ai-models.ts` - AI model configurations
- `knowledge-base.ts` - Bot training data
- `bot-commands.ts` - Custom slash commands

**Database package exports**:
- `db` - Drizzle database instance
- All table schemas
- Schema export at `packages/database/src/schema/index.ts`

## WhatsApp Integration (Baileys)

The `@whatsapp-blast/whatsapp` package wraps Baileys with:
- Multi-session support via `whatsappInstances` Map (keyed by `userId:sessionId`)
- QR code generation for new sessions
- Message sending (text, image, video, document)
- Connection health checking

**Important**: WhatsApp sessions are stored in `./sessions/` locally. Database tracks session status but in-memory Map is the source of truth for active connections.

**Anti-ban measures** (in `apps/api/src/services/blast.service.ts`):
- Randomized delays between messages (default 3-10s)
- Message personalization with `{{name}}`, `{{phone}}`, `{{date}}`, custom fields
- Retry logic with exponential backoff for timeouts
- Pre-blast connection health check

## Key Services

**Campaign blasting** (`apps/api/src/services/blast.service.ts`):
- `processCampaign(campaignId)` - Main campaign execution
- `startScheduler(intervalMs)` - Check for scheduled campaigns
- `pauseCampaign()` / `resumeCampaign()` - Control active campaigns

**Bot processor** (`apps/api/src/services/bot-processor.service.ts`):
- Handles incoming WhatsApp messages
- AI response generation using configured models
- Slash command processing
- Takeover mode (human intervention)

**Message storage** (`apps/api/src/services/message-storage.service.ts`):
- Persists incoming/outgoing messages to conversations table
- Real-time Socket.io emissions for message updates

## Frontend (Next.js)

- **App Router** - All routes in `apps/web/app/`
- **UI Components** - Shadcn/ui in `apps/web/components/ui/`
- **Layout** - Sidebar navigation via `app-layout.tsx`
- **API client** - Uses `NEXT_PUBLIC_API_URL` env var
- **Socket.io client** - Connects to backend for real-time updates

## Notes for Development

- Server restart clears in-memory WhatsApp instances - use `cleanupOldSessions()` in `apps/api/index.ts` to mark as disconnected
- Socket.io timeout is increased to 5 minutes for large file uploads
- File uploads use chunked upload (50MB chunks) to avoid timeouts
- Campaign attachments stored in `DATA_PATH` and served via `/data` static route
- Phone number formatting: handles `+60`, `60`, `0xxx` for Malaysian numbers
