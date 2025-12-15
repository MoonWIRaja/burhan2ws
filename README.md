# burhan2ws

Sistem ini ialah aplikasi **Next.js 14 (App Router)** dengan integrasi:

- **Prisma** sebagai ORM
- **MySql** (atau mana-mana DB yang disokong Prisma)
- **Redis + BullMQ** untuk queue/worker
- **Baileys** untuk integrasi WhatsApp

README ini menerangkan cara **install**, **setup** dan **run** sistem ini di mesin anda.

---

## 1. Keperluan Asas

Pastikan anda sudah install:

- **Node.js** v18 atau v20 (disyorkan LTS)
- **npm** atau **pnpm/yarn** (contoh di sini guna `npm`)
- **MySql** (atau DB lain yang anda mahu guna dengan Prisma)
- **Redis server** (contoh: `redis-server` berjalan di `localhost:6379`)

> Jika anda guna Docker, anda boleh guna container untuk MySql dan Redis.

---

## 2. Clone Repo

```bash
git clone https://github.com/MoonWIRaja/burhan2ws.git
cd burhan2ws
```

---

## 3. Install Dependencies

```bash
npm install
```

Jika anda guna `pnpm` atau `yarn`, tukar mengikut package manager anda:

```bash
pnpm install
# atau
yarn install
```

---

## 4. Setup Environment Variables

Fail `.env` **wajib** disediakan di root projek.

Contoh struktur asas (ubah ikut keperluan anda):

```env
# Database
DATABASE_URL="mysql://user:password@localhost:5432/burhan2ws?schema=public"

# JWT & Encryption
JWT_SECRET="your_jwt_secret_here"
ENCRYPTION_KEY="32_chars_encryption_key_here_123456"

# Redis
REDIS_URL="redis://localhost:6379"

# Lain-lain setting (contoh WhatsApp / host / port dll)
NEXTAUTH_SECRET="your_next_auth_like_secret_if_used"
APP_URL="http://localhost:3000"
```

> Sila rujuk kod dalam folder `lib/`, `prisma/` dan lain-lain jika anda mahu lihat env var tambahan yang digunakan.

---

## 5. Setup Database (Prisma)

Selepas `.env` disediakan dan `DATABASE_URL` betul, jalankan:

```bash
# jana Prisma client
npm run db:generate

# push schema Prisma ke database
npm run db:push

# ATAU, jika anda guna migrasi dev
npm run db:migrate

# buka Prisma Studio (pilihan)
npm run db:studio
```

---

## 6. Jalankan Redis

Pastikan Redis anda berjalan. Contoh di Linux / WSL:

```bash
redis-server
```

Jika guna Docker:

```bash
docker run -d --name redis -p 6379:6379 redis:7
```

---

## 7. Jalankan Sistem (Dev Mode)

Projek ini menyediakan skrip untuk run **Next.js** dan **worker Redis** serentak.

```bash
# mode development (Next.js + worker Redis)
npm run dev
```

Skrip di atas bersamaan dengan:

- `next dev`
- `tsx lib/redis/worker.ts`

Jika mahu run satu-satu:

```bash
# hanya Next.js
npm run dev:next

# hanya worker Redis
npm run dev:worker
```

Aplikasi biasanya akan boleh diakses di:

```text
http://localhost:3000
```

---

## 8. Build & Run Production

Untuk build production:

```bash
npm run build
```

Untuk start dalam mode production (Next.js + worker Redis):

```bash
npm run start
```

Atau secara berasingan:

```bash
npm run start:next
npm run worker
```

Pastikan:

- Database production sudah wujud dan `DATABASE_URL` menunjuk ke DB tersebut.
- Redis production juga berjalan dan `REDIS_URL` dikonfigurasi dengan betul.

---

## 9. Linting

Untuk semak linting (ESLint + config Next.js):

```bash
npm run lint
```

---

## 10. Struktur Projek Ringkas

Beberapa folder penting:

- `app/` — route & page Next.js (App Router)
- `components/` — komponen UI (butang, kad, layout, komponen WhatsApp, dll.)
- `lib/` — logik backend (auth, bot, redis, queue, worker, scheduler, utils, dll.)
- `prisma/` — schema Prisma dan konfigurasi database
- `scripts/` — skrip tambahan (setup/maintain sistem)
- `styles/` — fail CSS (contohnya Tailwind entry)

---

## 11. Nota Production

- Gunakan **process manager** seperti `pm2`, `systemd` atau Docker/Swarm/Kubernetes untuk run `next start` dan worker Redis (`npm run worker`).
- Pastikan env var production disimpan secara selamat (contoh: `.env` di server, Docker secrets, atau pengurus rahsia seperti Vault).
- Sediakan **backup** untuk database dan monitoring untuk Redis/queue.

---

## 12. Sumbangan & Isu

Jika anda jumpa bug atau mahu cadang penambahbaikan:

1. Buka **Issue** dalam repo GitHub ini.
2. Terangkan masalah / cadangan dengan jelas.
3. Sertakan langkah reproduksi jika berkaitan.

Terima kasih kerana menggunakan sistem ini. 🙌
