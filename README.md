# WhatsApp Blast AI (Non-SaaS)

A powerful WhatsApp marketing and AI automation tool built with Next.js 15, Express, and Baileys.

## 🏗️ Architecture

- **apps/web**: Next.js 15 with Aceternity UI Sidebar and Shadcn/ui.
- **apps/api**: Express.js with Socket.io for real-time WhatsApp status.
- **packages/ui**: Shared React components.
- **packages/database**: Prisma ORM with PostgreSQL.
- **packages/auth**: Better Auth for simple session management.
- **packages/whatsapp**: Baileys engine for WhatsApp integration.

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL database

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Setup environment variables:
   Create `.env` in root and `apps/api`:
   ```env
   DB_PROVIDER="postgresql"
   DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
   BETTER_AUTH_SECRET="your-secret"
   ```

   Recommended: use Supabase Postgres with the transaction pooler connection string.

   For MySQL:
   ```env
   DB_PROVIDER="mysql"
   DATABASE_URL="mysql://root:password@localhost:3306/whatsappapp"
   BETTER_AUTH_SECRET="your-secret"
   ```

3. Run migrations:
   ```bash
   npm run db:push
   ```

4. Start development:
   ```bash
   npm run dev
   ```

## 🛡️ Anti-Ban Strategy
- Randomized delays (3-10s) between messages.
- Personalized variables `{{nama}}`.
- Human takeover toggle to stop AI bot.
