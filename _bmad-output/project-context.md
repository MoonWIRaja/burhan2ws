---
project_name: 'burhan2ws'
user_name: 'Kid'
date: '2026-02-04T15:41:51.202Z'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'code_quality_rules', 'critical_rules', 'usage_guidelines']
status: 'complete'
rule_count: 75
optimized_for_llm: true
---

# Project Context for AI Agents

_Fail ini mengandungi peraturan dan pattern kritikal yang AI agents mesti ikut semasa menulis kod untuk projek WhatsApp Blast AI ini. Fokus pada butiran yang tidak nyata yang agents mungkin terlepas._

---

## Technology Stack & Versions

### 🏗️ Architecture Decision Records (ADRs)

#### ADR-001: Next.js 16 + React 19
**Decision**: Bleeding edge adoption untuk latest App Router features
**Context**: Real-time WhatsApp UI needs Server Components + streaming SSR
**Trade-off**: Stability vs features
**Review trigger**: Major breaking changes announced

#### ADR-002: Dual ORM Pattern
**Decision**: Prisma (auth only) + Drizzle (business logic)
**Context**: Better Auth requirement + performance needs
**Trade-off**: Complexity vs separation of concerns
**Review trigger**: Better Auth adds native Drizzle support

#### ADR-003: Baileys Version Lock
**Decision**: Lock at `@whiskeysockets/baileys@6.7.16` (exact, no ^)
**Context**: WhatsApp protocol changes frequently
**Risk**: HIGH - direct impact on core functionality
**Action**: Monitor releases monthly, test before upgrades

#### ADR-004: Monorepo with Turborepo
**Decision**: Workspace architecture dengan remote caching
**Context**: Multiple apps + shared packages
**Trade-off**: Setup complexity vs code sharing
**Metrics**: Target build time <5 minutes

#### ADR-005: Socket.io Integration
**Decision**: Next.js rewrites → Express proxy pattern
**Context**: Cross-origin WebSocket requirements
**Implementation**: See `apps/web/next.config.ts` rewrites section

### ⚠️ Critical Version Constraints

```json
{
  "@whiskeysockets/baileys": "6.7.16",     // LOCKED - no ^
  "better-auth": "1.2.0",                 // LOCKED - security-sensitive
  "next": "16.1.6",                        // Monitor breaking changes
  "react": "19.2.3",                       // Monitor ecosystem support
  "redis": "7.2.4-alpine",                 // [NEW] Cache & PubSub
  "nginx": "1.25.4-alpine"                 // [NEW] Reverse Proxy
}
```

### Full System Infrastructure (Docker)
- **Reverse Proxy**: Nginx (handling port 80/443 -> internal 3000/3001)
- **Database**: PostgreSQL 15 (Primary Data)
- **Cache/Queue**: Redis 7 (Session store & detailed caching)
- **App Containers**: Web (Next.js), API (Express)
```

### 🏗️ Dual ORM Architecture (CRITICAL)

| ORM | Scope | Location | Usage |
|-----|-------|----------|-------|
| **Prisma** | Auth only | `packages/auth/` | Better Auth sessions |
| **Drizzle** | Business logic | `packages/database/` | All other data |

**Code Examples:**
```typescript
// ✅ CORRECT - Drizzle for business logic
import { db, contacts } from "@whatsapp-blast/database";
const list = await db.select().from(contacts);

// ❌ WRONG - Prisma for business logic
import { prisma } from "@whatsapp-blast/auth";
const list = await prisma.contact.findMany(); // DON'T DO THIS
```

### Monorepo Structure
```
burhan2ws/
├── apps/
│   ├── web/          # Next.js frontend (port 3000)
│   └── api/          # Express backend (port 3001)
└── packages/
    ├── database/     # Drizzle ORM schemas & database client
    ├── whatsapp/     # WhatsApp Baileys wrapper
    ├── auth/         # Better Auth + Prisma configuration
    └── ui/           # Shared React components
```

### Frontend (apps/web)
- **Framework**: Next.js 16.1.6 (App Router, Server Components enabled)
- **React**: 19.2.3
- **TypeScript**: 5.x (strict mode enabled)
- **Styling**: Tailwind CSS v4 (PostCSS plugin)
- **Animation**: Framer Motion 12.29.2
- **Socket**: socket.io-client 4.7.4
- **Icons**: Lucide React 0.563.0 + @tabler/icons-react 3.36.1
- **Utilities**: clsx, tailwind-merge, class-variance-authority
- **Theme**: next-themes 0.4.6 (dark mode support)

### Backend (apps/api)
- **Framework**: Express 4.18.2
- **TypeScript**: 5.3.3
- **Socket**: socket.io 4.7.4 (with CORS origins)
- **Authentication**: better-auth 1.2.0
- **WhatsApp**: @whiskeysockets/baileys 6.7.16
- **File Upload**: multer 1.4.5-lts.1
- **Security**: bcryptjs 2.4.3, cors 2.8.5

### Packages

#### @whatsapp-blast/database
- **ORM**: Drizzle ORM 0.39.0
- **Database**: PostgreSQL (via postgres 3.4.5)
- **ID Generation**: @paralleldrive/cuid2 2.2.2

#### @whatsapp-blast/whatsapp
- **WhatsApp Library**: @whiskeysockets/baileys 6.7.16 (LOCKED)
- **QR Code**: qrcode 1.5.3
- **Logging**: pino 8.17.2

#### @whatsapp-blast/auth
- **Auth Library**: better-auth (latest)
- **Prisma**: @prisma/client (latest) - for auth sessions only

#### @whatsapp-blast/ui
- **React**: 18.2.0
- **Styling**: Tailwind CSS
- **Utilities**: clsx, tailwind-merge, class-variance-authority, framer-motion

### Build Tools
- **Build Tool**: Turborepo v2.8.3
- **Package Manager**: npm@10.2.4
- **Workspaces**: `apps/*`, `packages/*`

### 🐳 Docker Infrastructure Rules (Full System)

#### Persistence Strategy
- **Database**: Named volume `postgres_data` (Must never use bind mount in prod)
- **Redis**: Named volume `redis_data` (AOF persistence enabled)
- **WhatsApp Sessions**: Named volume `whatsapp_sessions` (Critical for persistence)

#### Environment Configuration
- **Production**: Use `--env-file .env.production`
- **Secrets**: BetterAuth secrets & DB passwords injected at runtime
- **Networking**: All internal comms (API<->DB, API<->Redis) happen on `backend_network` bridge. Only Nginx exposes ports 80/443.

#### Startup Sequence (Healthchecks)
1. **Postgres/Redis**: Healthy (pg_isready / redis-cli ping)
2. **API**: Waits for DB+Redis (using `depends_on: service_healthy`)
3. **Web**: Waits for API
4. **Nginx**: Starts last, routes traffic


---

## Language-Specific Rules (TypeScript/JavaScript)

### ⚠️ CRITICAL: .js Extension in Backend Imports

**The #1 Source of Errors for New Developers!**

```typescript
// ❌ WRONG - Akan fail di Node.js ESM
import { getSessionId } from "../utils/get-user";

// ✅ CORRECT - .js extension walaupun source file adalah .ts
import { getSessionId } from "../utils/get-user.js";
```

**WHY?** Visual explanation:

```
Source Code:   get-user.ts     ← TypeScript code anda tulis
                 ↓ Compile (tsc)
Runtime File:  get-user.js     ← Node.js baca ni
                 ↓ Import Resolution
Import Path:   "./get-user.js" ← Mesti match apa Node.js see
```

> **Rule:** Di `apps/api` dan semua `packages/*`, import statements MESTI guna `.js` extension walaupun source file adalah `.ts`. Ini adalah Node.js ESM requirement.

### Import/Export Pattern Matrix

| Context | Pattern | Example | Location |
|---------|---------|---------|----------|
| **Backend** | Workspace imports | `import { db } from "@whatsapp-blast/database"` | `apps/api/src/**/*.ts` |
| **Packages** | Workspace imports | `import { db } from "@whatsapp-blast/database"` | `packages/**/*.ts` |
| **Frontend** | Path aliases | `import { cn } from "@/lib/utils"` | `apps/web/**/*.tsx` |
| **Relative** | .js extension | `import { helper } from "./utils.js"` | All backend files |
| **Types only** | `import type` | `import type { User } from "./types"` | Everywhere |

### TypeScript Strict Mode Requirements

```json
// apps/web/tsconfig.json, apps/api/tsconfig.json
{
  "compilerOptions": {
    "strict": true,              // ✅ MANDATORY - no exceptions
    "noImplicitAny": true,       // ✅ No `any` types
    "strictNullChecks": true,    // ✅ Handle null explicitly
    "target": "ES2017",
    "module": "esnext",
    "moduleResolution": "bundler"
  }
}
```

### Async/Await Pattern (Consistent Error Handling)

```typescript
// ✅ PREFERRED - All route handlers MUST follow this pattern
export async function GET(request: NextRequest) {
  try {
    const sessionId = getSessionId(request);
    const data = await fetchData(sessionId);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Operation failed:", error);
    return NextResponse.json(
      { error: "Operation failed" },
      { status: 500 }
    );
  }
}
```

### Type Guards for Runtime Safety

```typescript
// Gunakan type guards untuk external data (WhatsApp messages, API requests)
function isWhatsAppMessage(msg: unknown): msg is WhatsAppMessage {
  return (
    typeof msg === 'object' && msg !== null &&
    'from' in msg && typeof msg.from === 'string' &&
    'body' in msg && typeof msg.body === 'string' &&
    'timestamp' in msg && typeof msg.timestamp === 'number'
  );
}

// Usage
if (isWhatsAppMessage(data)) {
  // TypeScript now knows `data` has correct types
  processMessage(data);
}
```

### Type Safety Rules

- ❌ **NO `any` types** unless absolutely necessary
- ✅ **Use `unknown`** untuk untyped data (then type guard it)
- ✅ **Import types** from `@types/*` packages
- ✅ **Define interfaces** untuk semua API responses

---

## Framework-Specific Rules

### 🐳 Docker-Specific Framework Rules

#### 1. Dual-URL Configuration (CRITICAL for Next.js)
Next.js runs in two places: **Server (SSR)** and **Browser (Client)**. They need different URLs to reach the API.

- **Browser**: Uses `NEXT_PUBLIC_API_URL` -> Points to Nginx Public URL (e.g., `https://api.burhan.com`)
- **Server (SSR)**: Uses `INTERNAL_API_URL` -> Points to Docker Service Name (e.g., `http://api:3001`)

**Implementation Pattern:**
```typescript
const isServer = typeof window === 'undefined';
const apiUrl = isServer ? process.env.INTERNAL_API_URL : process.env.NEXT_PUBLIC_API_URL;
```

#### 2. Logging Strategy
- **Format**: JSON only (using `pino`)
- **Destination**: STDOUT/STDERR only (Docker collects this)
- **NO File Logs**: Never write logs to disk inside credentials (ephemeral).

### Next.js 16 (App Router) Rules

#### 🚨 API Routes are PROXIES Only

All routes in `apps/web/app/api/*/route.ts` MUST proxy to Express backend:

```typescript
// ❌ WRONG - Direct database access
export async function GET() {
  const data = await db.select().from(contacts); // SECURITY RISK!
  return NextResponse.json(data);
}

// ✅ CORRECT - Proxy to backend
const API_URL = process.env.API_URL || "http://localhost:3001";
export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get("session_id")?.value;
  const response = await fetch(`${API_URL}/api/contacts`, {
    headers: { Cookie: `session_id=${sessionId}` },
    credentials: "include",
  });
  return NextResponse.json(await response.json());
}
```

**Rule:** Frontend NEVER connects directly to database. All data operations go through Express backend.

#### Client vs Server Components

```typescript
// ✅ Server Component (default) - No "use client"
// Use untuk: data fetching, static content
export default async function Dashboard() {
  const data = await fetchData(); // OK di server
  return <div>{data}</div>;
}

// ✅ Client Component - "use client" required
// Use untuk: interactivity, hooks, event handlers
"use client";
export function InteractiveButton() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

**Golden Rule:** Start as Server Component. Add `"use client"` ONLY when you need hooks or event handlers.

### Express Middleware Order (CRITICAL!)

```typescript
// ✅ CORRECT ORDER - apps/api/index.ts
app.use(cors({ origin: FRONTEND_URL, credentials: true }));     // 1. CORS FIRST
app.use("/api/upload", uploadRoutes);                            // 2. Upload BEFORE body parsing
app.use("/data", express.static("data"));                         // 3. Static files
app.get("/health", (req, res) => res.json({ status: "ok" }));    // 4. Health check
app.use(express.json({ limit: "50mb" }));                        // 5. Body parsers
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use("/api/auth", authRoutes);                                 // 6. Other routes
```

**Why this order?** Upload routes need their own body parser (500MB limit). If you put `express.json()` first, upload routes will fail with "request entity too large".

### Socket.io Integration Rules

#### Room Naming Convention

```typescript
// Backend (apps/api)
io.to(`session:${sessionId}`).emit("whatsapp_qr", qrData);

// Frontend (apps/web)
socket.on("whatsapp_qr", (data) => {
  setQrCode(data.qr);
});
```

**Rule:** Always use `session:{sessionId}` pattern for user-specific rooms.

#### Socket.io Events Reference

| Event | Direction | Purpose |
|-------|----------|---------|
| `whatsapp_qr` | Server → Client | QR code update |
| `whatsapp_connected` | Server → Client | Connection successful |
| `whatsapp_disconnected` | Server → Client | Connection lost |
| `join_session` | Client → Server | Join user's room |

### Framer Motion Rules

#### Use Variants for Consistency

```typescript
// ✅ CORRECT - Define reusable variants
const fadeVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

// Use everywhere
<motion.div
  variants={fadeVariants}
  initial="hidden"
  animate="visible"
/>
```

**Rule:** Don't create custom animations per component. Define variants and reuse.

### Route Handler Patterns

#### Next.js Route Handlers

```typescript
// apps/web/app/api/contacts/route.ts
const API_URL = process.env.API_URL || "http://localhost:3001";

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get("session_id")?.value;
  if (!sessionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const response = await fetch(`${API_URL}/api/contacts`, {
    headers: { Cookie: `session_id=${sessionId}` },
    credentials: "include",
  });
  return NextResponse.json(await response.json());
}
```

#### Express Route Handlers

```typescript
// apps/api/src/routes/contacts.routes.ts
router.get("/", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const contacts = await db.select().from(contacts);
    res.json(contacts);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed" });
  }
});
```

---

## Critical Implementation Rules

### Project Architecture Rules

#### Monorepo Structure
```
burhan2ws/
├── apps/
│   ├── web/          # Next.js frontend (port 3000)
│   └── api/          # Express backend (port 3001)
└── packages/
    ├── database/     # Drizzle ORM schemas & database client
    ├── whatsapp/     # WhatsApp Baileys wrapper
    ├── auth/         # Better Auth configuration
    └── ui/           # Shared React components
```

#### Import Path Conventions
- **Frontend**: Use `@/` for internal imports (configured in tsconfig.json paths)
- **Backend/Packages**: Use workspace imports: `@whatsapp-blast/database`, `@whatsapp-blast/whatsapp`
- **Database**: All schemas exported from `@whatsapp-blast/database/src/schema/index.ts`

### Database Rules (Drizzle ORM)

#### Schema Definition Pattern
```typescript
import { createId } from "@paralleldrive/cuid2";
import { pgTable, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";

export const tableName = pgTable("table_name", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // ... other fields
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

#### Critical ID Rules
- **Primary Keys**: ALWAYS use `text("id").primaryKey().$defaultFn(() => createId())` from `@paralleldrive/cuid2`
- **User IDs**: Phone-number based for WhatsApp users (format: `wa:60123456789`)
- **Foreign Keys**: Always add `.references(() => table.id, { onDelete: "cascade" })` for cascade delete

#### Relations Pattern
```typescript
import { relations } from "drizzle-orm";

export const tableNameRelations = relations(tableName, ({ one, many }) => ({
  relatedTable: one(relatedTable, {
    fields: [tableName.relatedId],
    references: [relatedTable.id],
  }),
  manyItems: many(junctionTable),
}));
```

### Frontend Rules (Next.js App Router)

#### Route Handler Pattern
All API routes in `apps/web/app/api/*/route.ts` are **proxies** to the Express backend:
```typescript
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:3001";

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get("session_id")?.value;
  const response = await fetch(`${API_URL}/api/endpoint`, {
    headers: { Cookie: `session_id=${sessionId}` },
    credentials: "include",
  });
  return NextResponse.json(await response.json());
}
```

#### Session Management
- **Cookie Name**: `session_id`
- **Authentication Check**: Cookie `wa_connected === "true"`
- **Public Routes**: Only `/login` (defined in `middleware.ts`)
- **Middleware**: Redirects unauthenticated users to `/login`

#### Component Naming Conventions
- **Client Components**: MUST include `"use client";` at the top
- **Files**: kebab-case for multi-word files (e.g., `profile-setup-modal.tsx`)
- **Components**: PascalCase for component names
- **Pages**: `page.tsx` in App Router directories
- **Layouts**: `layout.tsx` for shared layouts

#### Styling Rules
- **Utility Function**: Always use `cn()` from `@/lib/utils` for conditional classes
- **Tailwind**: Use v4 syntax with PostCSS plugin
- **Dark Mode**: Use `next-themes` with `dark:` prefix
- **Icons**: Prefer `@tabler/icons-react` (e.g., `IconBrandTabler`)

### Backend Rules (Express API)

#### Middleware Order (CRITICAL!)
```typescript
// 1. CORS FIRST
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));

// 2. Upload routes BEFORE body parsing (for large file handling)
app.use("/api/upload", uploadRoutes);

// 3. Static files
app.use("/data", express.static("data"));

// 4. Health check (no body parsing)
app.get("/health", (req, res) => res.json({ status: "ok" }));

// 5. Body parsers (increased limit for base64)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// 6. Other routes
app.use("/api/auth", authRoutes);
```

#### Route Handler Pattern
```typescript
import { Router } from "express";
import { db } from "@whatsapp-blast/database";
import { getSessionId } from "../utils/get-user.js";

const router = Router();

router.get("/endpoint", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    // ... logic
    res.json(data);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed" });
  }
});

export default router;
```

#### Environment Variables
- **API_URL**: Backend URL (default: `http://localhost:3001`)
- **FRONTEND_URL**: Frontend URL for CORS
- **DATABASE_URL**: PostgreSQL connection string
- **DATA_PATH**: File storage path (default: `./data`)
- **NODE_ENV**: `production` or `development`

### WhatsApp Integration Rules

#### User ID Convention
- **Phone-based IDs**: User IDs are based on WhatsApp phone numbers
- **Format**: `wa:{cleaned_number}` (e.g., `wa:60123456789`)
- **Normalization**: Remove all non-numeric characters

#### Session Management
- **Browser Session**: UUID stored in `session_id` cookie
- **WhatsApp Session**: Stored in `whatsappSessions` table
- **Instance Key**: Phone-based user ID after connection
- **Auto-reconnect**: Implemented on server restart using saved sessions

#### Bot Handler Pattern
```typescript
wa.setBotHandler(async (userId: string, message: {
  from: string;
  fromMe: boolean;
  body: string;
  timestamp: number;
}) => {
  // Process message and return optional reply
  return response; // string | null
});
```

### TypeScript Configuration

#### Both Frontend & Backend Use
- **strict mode**: `true`
- **target**: ES2017
- **module**: esnext
- **moduleResolution**: bundler
- **jsx**: react-jsx (for frontend)

#### Path Aliases (Frontend)
```json
{
  "paths": {
    "@/*": ["./*"]
  }
}
```

### Socket.io Integration

#### Backend (apps/api)
- **CORS Origins**: `process.env.FRONTEND_URL`, `https://dev.owlscottage.com`, `http://localhost:3000`
- **Room Naming**: `session:{sessionId}` for user-specific events
- **Events**:
  - `whatsapp_qr` - QR code update
  - `whatsapp_connected` - Connection successful
  - `whatsapp_disconnected` - Connection lost

#### Frontend (apps/web)
- **Connection**: Via `lib/socket.ts` using `socket.io-client`
- **Environment**: Uses `NEXT_PUBLIC_API_URL` from Next.js config
- **Rewrite**: Next.js rewrites `/socket.io/*` to backend

### File Naming & Organization

#### Frontend (apps/web)
```
app/
├── api/{feature}/route.ts       # API proxies
├── {page}/page.tsx              # Page components
├── layout.tsx                   # Root layout
└── globals.css                  # Global styles

components/
├── layout/                      # Layout components
├── ui/                          # Reusable UI components
├── providers/                   # Context providers
└── {feature}/                   # Feature-specific components

lib/
├── utils.ts                     # Utilities (cn function)
├── socket.ts                    # Socket.io client
└── markdown.tsx                 # Markdown renderer
```

#### Backend (apps/api)
```
src/
├── routes/                      # Express route handlers
├── services/                    # Business logic
├── socket/                      # Socket.io handlers
├── utils/                       # Helper functions
└── scripts/                     # Utility scripts
```

### Development Workflow

#### Available Scripts (Root)
```bash
npm run dev          # Start all services with Turbodev
npm run build        # Build all packages
npm run lint         # Lint all packages
npm run db:generate  # Generate Drizzle migrations
npm run db:migrate   # Run migrations
npm run db:push      # Push schema changes
npm run db:studio    # Open Drizzle Studio
```

#### Running Individual Apps
```bash
# Frontend (port 3000)
cd apps/web && npm run dev

# Backend (port 3001)
cd apps/api && npm run dev
```

---

## Testing Rules

### Test Stack & Tools

| Layer | Tool | Purpose |
|-------|------|---------|
| **Unit Tests** | Vitest | Fast unit tests dengan native ESM |
| **API Tests** | Supertest | Express endpoint integration tests |
| **E2E Tests** | Playwright | Full user flow automation |
| **Visual Tests** | Chromatic (optional) | Component regression testing |
| **Mocking** | Vitest `vi` mocks | Module mocking |

### Test File Organization

```
burhan2ws/
├── apps/api/tests/
│   ├── unit/services/        # Business logic tests
│   │   ├── blast.service.test.ts
│   │   └── bot-processor.test.ts
│   ├── integration/routes/   # API endpoint tests
│   │   ├── auth.routes.test.ts
│   │   └── contacts.routes.test.ts
│   └── fixtures/             # Test data fixtures
│       └── sample-data.ts
├── apps/web/__tests__/
│   ├── unit/components/      # Component unit tests
│   └── e2e/                  # Playwright specs
│       ├── auth.spec.ts
│       └── blast.spec.ts
└── packages/*/tests/         # Package-specific tests
```

### 🎯 Critical Test Patterns

#### 1. Dual ORM Cleanup Pattern

```typescript
// ✅ CORRECT - Cleanup BOTH ORMs after each test
afterEach(async () => {
  // Drizzle cleanup (business logic)
  await db.delete(campaignRecipients).execute(); // Dependent tables first
  await db.delete(campaigns).execute();
  await db.delete(contacts).execute();
  await db.delete(users).execute();

  // Prisma cleanup (auth sessions)
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.verification.deleteMany({});
});
```

**Rule:** Always delete dependent tables FIRST to avoid foreign key constraint errors.

#### 2. WhatsApp Instance Mocking

```typescript
// ✅ CORRECT - Mock entire WhatsApp package
vi.mock("@whatsapp-blast/whatsapp", () => ({
  getWhatsAppInstance: vi.fn(() => mockWA),
  getFreshWhatsAppInstance: vi.fn(() => mockWA),
  hasActiveInstance: vi.fn(() => false),
  removeWhatsAppInstance: vi.fn(),
}));

const mockWA = {
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  isConnected: vi.fn(() => true),
  sendMessage: vi.fn().mockResolvedValue({ id: 'msg_123' }),
  setBotHandler: vi.fn(),
};

// ❌ WRONG - Never connect to real WhatsApp in tests
const wa = getFreshWhatsAppInstance();
await wa.connect(); // This will try to reach WhatsApp servers!
```

**Rule:** NEVER connect to external services (WhatsApp, real database) dalam unit tests.

#### 3. API Route Test Template

```typescript
// ✅ Template untuk Express route tests
describe('POST /api/contacts', () => {
  beforeEach(async () => {
    // Setup: Clean database, create test data
    await db.delete(contacts).execute();
  });

  it('creates contact with valid data', async () => {
    const response = await request(app)
      .post('/api/contacts')
      .set('Cookie', 'session_id=test-session')
      .send({
        name: 'Test User',
        phoneNumber: '+60123456789',
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
  });

  it('returns 401 without session', async () => {
    const response = await request(app)
      .post('/api/contacts')
      .send({ name: 'Test', phoneNumber: '+60123456789' });

    expect(response.status).toBe(401);
  });

  it('returns 400 for invalid phone number', async () => {
    const response = await request(app)
      .post('/api/contacts')
      .set('Cookie', 'session_id=test-session')
      .send({ name: 'Test', phoneNumber: 'invalid' });

    expect(response.status).toBe(400);
  });
});
```

#### 4. Next.js Route Handler Test

```typescript
// ✅ Test untuk Next.js API proxy routes
import { GET } from './route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/utils', () => ({
  cn: vi.fn(),
}));

describe('GET /api/contacts', () => {
  it('proxies to backend API', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: async () => ({ contacts: [] }),
    });
    global.fetch = mockFetch;

    const request = new NextRequest('http://localhost:3000/api/contacts', {
      headers: { Cookie: 'session_id=test' },
    });

    const response = await GET(request);
    expect(response.status).toBe(200);
  });
});
```

### Test Coverage Requirements

| Component | Coverage Target | Rationale |
|-----------|-----------------|-----------|
| Business logic (services) | 80%+ | Core functionality |
| API routes (integration) | 100% | All endpoints must work |
| WhatsApp handlers | 70%+ | Complex but heavily mocked |
| UI components | 60%+ | Visual testing covers some gaps |

### Definition of Done (Testing Checklist)

```
☐ Unit tests written for new code
☐ All tests pass (vitest run)
☐ Coverage threshold met
☐ No console errors in test output
☐ E2E test untuk critical user flows
☐ Mocked external services verified
☐ Tests documented with describe/blocks
```

### Risk-Based Testing Priority

| Priority | Feature | Test Type | Example Cases |
|----------|---------|-----------|---------------|
| **P0** | WhatsApp connection | E2E + Unit | QR generation, auth flow |
| **P0** | Authentication | Integration | Login, logout, session mgmt |
| **P1** | Blast messaging | Integration | Single send, bulk send |
| **P1** | Bot processing | Unit | Message handling, replies |
| **P2** | Dashboard | Unit | Stats calculation, aggregation |
| **P2** | Settings | Unit | Profile updates, preferences |

### Visual Regression Testing

```typescript
// ✅ Component snapshot test
it('renders button correctly', () => {
  const { container } = render(<Button>Click me</Button>);
  expect(container).toMatchSnapshot();
});

// ✅ E2E visual test
test('dashboard visual layout', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveScreenshot('dashboard.png');
});
```

---

## Code Quality & Style Rules

### 📋 Linting & Formatting

#### ESLint Configuration
```javascript
// apps/web/eslint.config.mjs
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default [
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    rules: {
      // Enforce best practices
      "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
      "no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];
```

### 📝 Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| **Components** | PascalCase | `Sidebar.tsx`, `ProfileSetupModal.tsx` |
| **Files** | kebab-case | `sidebar.tsx`, `route.ts` |
| **Variables** | camelCase | `sessionId`, `isConnected` |
| **Boolean** | is/has/can prefix | `isLoading`, `hasPermission`, `canEdit` |
| **Constants** | UPPER_SNAKE_CASE | `API_URL`, `MAX_RETRIES` |
| **Types/Interfaces** | PascalCase | `User`, `WhatsAppMessage` |
| **Enums** | PascalCase | `ConnectionStatus`, `UserRole` |

### 🎯 Code Style Principles

#### 1. Early Returns for Clarity
```typescript
// ✅ PREFERRED - Early returns, flat structure
export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get("session_id")?.value;
  if (!sessionId) return unauthorizedResponse();

  const user = await getUser(sessionId);
  if (!user) return unauthorizedResponse();

  if (!user.hasPermission) return forbiddenResponse();

  return NextResponse.json(await getData(user));
}
```

#### 2. Self-Documenting Code
```typescript
// ❌ OVER-DOCUMENTED - Unnecessary JSDoc
/**
 * Gets the session ID from the request
 * @param request - The NextRequest object
 * @returns The session ID string
 */
function getSessionId(request: NextRequest): string {
  return request.cookies.get("session_id")?.value || "";
}

// ✅ BETTER - Let the code speak
function getSessionId(request: NextRequest): string {
  return request.cookies.get("session_id")?.value || "";
}
```

#### 3. Functional Patterns Where Appropriate
```typescript
// ✅ PREFERRED - Declarative, composable
const activeUsers = users
  .filter(u => u.isActive)
  .map(u => ({ ...u, displayName: u.name.trim() }))
  .sort((a, b) => a.name.localeCompare(b.name));
```

### 🔒 Security Rules

#### Input Validation & Sanitization
```typescript
// ✅ ALWAYS validate and sanitize external input
import { sanitizePhoneNumber } from "@/lib/sanitize";

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Validate type
  if (!body.phoneNumber || typeof body.phoneNumber !== 'string') {
    return NextResponse.json({ error: "Invalid phone" }, { status: 400 });
  }

  // Sanitize
  const cleanPhone = sanitizePhoneNumber(body.phoneNumber);

  await saveContact(cleanPhone);
}
```

#### Secret Management
```typescript
// ❌ WRONG - Never hardcode secrets
const API_KEY = "sk_live_1234567890abcdef";

// ✅ CORRECT - Use environment variables
const API_KEY = process.env.STRIPE_API_KEY;
if (!API_KEY) throw new Error("STRIPE_API_KEY not set");
```

### ⚡ Performance Patterns

#### Database Query Optimization
```typescript
// ❌ SLOW - N+1 queries
for (const campaign of campaigns) {
  campaign.recipients = await db.select()
    .from(campaignRecipients)
    .where(eq(campaignRecipients.campaignId, campaign.id));
}

// ✅ FAST - Single query with relations
const campaignsWithRecipients = await db.query(campaigns, {
  with: {
    recipients: true,
  },
});
```

#### Debouncing User Inputs
```typescript
// ✅ Debounce search/filter operations
import { useDebouncedValue } from "@/hooks/use-debounce";

function ContactSearch() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    if (debouncedSearch) {
      searchContacts(debouncedSearch);
    }
  }, [debouncedSearch]);
}
```

### 👥 Team Collaboration Rules

#### PR Description Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Refactor

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] No new warnings generated
```

#### Code Review Checklist
```
☐ Function names describe WHAT they do, not HOW
☐ Complex logic has comments explaining WHY
☐ No commented-out code (delete it, git has history)
☐ No console.log left in production code
☐ Error messages are user-friendly
☐ Sensitive data never logged
```

### 📚 Documentation Standards

#### When to Add Comments
```typescript
// ✅ EXPLAIN NON-OBVIOUS "WHY", NOT OBVIOUS "WHAT"
// NOTE: We use .js extensions for imports because Node.js ESM
// requires the actual file extension at runtime.
import { helper } from "./utils.js";

// ✅ EXPLAIN COMPLEX BUSINESS LOGIC
// Calculate retry delay with exponential backoff:
// 1st retry: 1s, 2nd: 2s, 3rd: 4s, max 30s
const delay = Math.min(Math.pow(2, attempt), 30);
```

### 🗂️ File Organization

#### Component Structure Order
```typescript
// 1. "use client" (if needed)
"use client";

// 2. External imports
import { useState } from "react";
import { Button } from "@/components/ui/button";

// 3. Internal imports
import { useStyles } from "./styles";
import { RelatedComponent } from "./related";

// 4. Type definitions
interface Props {
  name: string;
}

// 5. Constants
const DEFAULT_TIMEOUT = 5000;

// 6. Component
export function ComponentName({ name }: Props) {
  // Hooks
  // Event handlers
  // Effects
  // Render
}
```

### Error Handling Standards
```typescript
// ✅ Consistent error handling pattern
export async function POST(request: NextRequest) {
  try {
    const sessionId = getSessionId(request);
    if (!sessionId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const result = await processData(sessionId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/endpoint failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

### Performance Considerations
- **File upload limits**: 50MB for JSON body, 500MB for file uploads
- **Timeout**: 30 minutes for large file operations
- **Database**: Use proper indexes on frequently queried fields
- **Static files**: Serve via Express static middleware
- **Lazy loading**: Use React.lazy() for heavy components

---

## Important Implementation Notes

### Phone Number Normalization
```typescript
function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  return `wa:${cleaned}`;
}
```

### Cookie Settings (Production vs Development)
- **Development**: `sameSite: "lax"`, `secure: false`
- **Production**: `sameSite: "none"`, `secure: true`, `domain: ".owlscottage.com"`

### Better Auth Integration
- **Email/Password**: Enabled
- **User Roles**: "admin" (default) and "agent"
- **Database**: PostgreSQL via Prisma adapter
- **Session Storage**: Custom implementation with WhatsApp

### Database Migrations
- **Tool**: Drizzle Kit
- **Config**: `packages/database/drizzle.config.ts`
- **Output**: `packages/database/drizzle/`
- **Schema**: `packages/database/src/schema/`

---

## Testing & Debugging

### Health Check Endpoint
- **URL**: `GET /health`
- **Response**: `{ status: "ok", timestamp, version }`

### Session Status Check
- **URL**: `GET /api/auth/status`
- **Returns**: Connection status, phone number, display name

### Debugging Socket Issues
- Check Socket.io room naming: `session:{sessionId}`
- Verify CORS origins in backend
- Ensure cookie is passed with credentials: "include"

---

## Quick Reference: File Locations

| Purpose | Location |
|---------|----------|
| Database Schemas | `packages/database/src/schema/*.ts` |
| Database Client | `packages/database/src/index.ts` |
| WhatsApp Wrapper | `packages/whatsapp/index.ts` |
| Auth Config | `packages/auth/index.ts` |
| API Routes | `apps/api/src/routes/*.ts` |
| Frontend Pages | `apps/web/app/*/page.tsx` |
| API Proxies | `apps/web/app/api/*/route.ts` |
| Components | `apps/web/components/**/*.tsx` |
| Middleware | `apps/web/middleware.ts` |
| Next Config | `apps/web/next.config.ts` |
| Express App | `apps/api/index.ts` |

---

## Usage Guidelines

### For AI Agents

**Before implementing any code:**
1. Read this file completely
2. Follow ALL rules exactly as documented
3. When in doubt, prefer the more restrictive option
4. Update this file if new patterns emerge

**Critical Reminders:**
- Backend imports MUST use `.js` extension (Node.js ESM requirement)
- Frontend API routes are PROXIES only - never connect directly to database
- Use Drizzle for business logic, Prisma ONLY for auth
- WhatsApp instances must be mocked in tests - never connect to real services
- Room naming: `session:{sessionId}` for Socket.io events

### For Humans

**Maintenance:**
- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

**When to Update:**
- Adding new packages with specific usage patterns
- Changing framework versions with breaking changes
- Discovering new anti-patterns or common mistakes
- Establishing new conventions not covered here

### Last Updated

**Date:** 2026-02-04
**Sections Completed:**
- Technology Stack & Versions
- Language-Specific Rules
- Framework-Specific Rules
- Testing Rules
- Code Quality & Style Rules
- Critical Implementation Rules
