# 🌍 Wanderbot

> Plan beautiful, data-smart trips in minutes. Wanderbot blends airfare heuristics, curated photo collages, and interactive maps into a clean, shareable plan for your crew.

**Live demo:** https://wander-bot-puce.vercel.app/

```
__        __     _   _  _   _  ____  _____  ______     ____    ___  _____ 
\ \      / /    | \ | || \ | || __ )| ____||  _ \     | __ )  / _ \| ____|
 \ \ /\ / /____ |  \| ||  \| ||  _ \|  _|  | |_) |    |  _ \ | | | |  _|  
  \ V  V /_____| | |\  || |\  || |_) | |___ |  _ <  _ | |_) || |_| | |___ 
   \_/\_/       |_| \_||_| \_||____/|_____||_| \_(_)| |____/  \___/|_____|
                                                                          
                             W   A   N   D   E   R     B   O   T
```

---

## Table of Contents
- [✨ What it does](#-what-it-does)
- [🧠 How it works](#-how-it-works)
- [🧩 Tech Stack](#-tech-stack)
- [🚀 Quickstart](#-quickstart)
- [☁️ Deploy to Vercel](#️-deploy-to-vercel)
- [🛣️ Key Endpoints](#️-key-endpoints)
- [🧱 Important Files](#-important-files)
- [🔍 Image Strategy](#-image-strategy)
- [⚙️ Configuration Notes](#️-configuration-notes)
- [🧪 Troubleshooting](#-troubleshooting)
- [🗺️ Roadmap](#️-roadmap)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## ✨ What it does
- **Group-aware trip planning** — travelers, timeframe, preferences.
- **Smart fare estimates** — heuristic monthly averages per traveler.
- **Photo collages** — city-centric Wikimedia rails that inspire.
- **Interactive maps** — auto pins and sensible map centers.
- **Clear cost comparisons** — per-person and group totals.
- **Production-ready** — normalized JSON, Postgres, Zod-validated.

---

## 🧠 How it works
- **`/api/plan`** → model returns **5 destinations** (strict JSON).
- **Normalization** → smooth fares, fill months, clean markers, expand notes.
- **Image preload** → server calls **`/api/images`** (Wikimedia) for instant rails.
- **Persistence** → `plans` + `destinations` in Postgres.
- **Results UI** → thick center analytics, image rails left/right.

---

## 🧩 Tech Stack
- **Next.js 15 (App Router)** + **TypeScript**
- **OpenAI** Chat/Responses (configurable model)
- **Postgres** (SQL helper `q`)
- **Zod** (strict validation)
- **Leaflet** maps
- **Wikimedia Commons** images (`/api/images`)
- **Tailwind** UI

---

## 🚀 Quickstart

### 1) Clone & install
```bash
git clone https://github.com/yourname/wanderbot.git
cd wanderbot
npm i
```

### 2) Environment variables
Create a **`.env.local`** file at the project root:

```dotenv
# OpenAI
OPENAI_API_KEY=sk-***
OPENAI_MODEL=gpt-4.1

# Database (Postgres)
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DB

# App
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NEXT_PUBLIC_MOCK=0
```

### 3) Database (minimal schema)
```sql
-- plans
create table if not exists plans (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  timeframe jsonb not null,
  travelers jsonb not null,
  suggestions text,
  model text,
  final_recommendation text,
  summary jsonb,
  model_output jsonb,
  group_fit jsonb
);

-- destinations
create table if not exists destinations (
  id uuid default gen_random_uuid() primary key,
  plan_id uuid references plans(id) on delete cascade,
  slug text not null,
  name text not null,
  narrative text,
  months jsonb,
  per_traveler_fares jsonb,
  totals jsonb,
  analysis jsonb
);
```

### 4) Run locally
```bash
npm run dev
# open http://localhost:3000
```

---

## ☁️ Deploy to Vercel

### A) Project setup
1. **New Project → Import GitHub Repo** in Vercel.
2. **Framework Preset:** Next.js (auto-detected).
3. **Environment Variables** (Production + Preview):
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL` (e.g., `gpt-4.1`)
   - `DATABASE_URL`
   - `NEXT_PUBLIC_BASE_URL` → your prod URL (e.g., `https://your-app.vercel.app`)
   - `NEXT_PUBLIC_MOCK` → `0`
4. **Build**: defaults are fine for Next 15.

### B) Postgres options
Use Neon, Supabase, or Vercel Postgres. Ensure your connection string works in serverless.

### C) Image hosts on Vercel
Wikimedia hosts are whitelisted in `next.config.mjs` (see below).

### D) Production URL back-reference
Set `NEXT_PUBLIC_BASE_URL` to the **exact** deployed origin (no trailing `/`).  
Server-side image preload in `/api/plan` calls `/api/images` using this value.

---

## 🛣️ Key Endpoints

**POST `/api/plan`**
```json
{
  "travelers": [{ "id": "t1", "name": "Alex", "homeLocation": "Seattle" }],
  "timeframe": { "startMonth": "2026-02", "endMonth": "2026-05" },
  "suggestions": "beach, food, museums"
}
```
→
```json
{ "planId": "uuid..." }
```

**POST `/api/images`**
```json
{ "terms": ["Barcelona beach", "Barcelona Gothic Quarter"], "count": 12 }
```
→
```json
{ "images": [{ "url": "...", "title": "...", "source": "wikimedia" }] }
```

---

## 🧱 Important Files
```
app/
  api/
    plan/route.ts          # prompt, normalization, persistence, image preload
    images/route.ts        # Wikimedia fetch + filtering
  results/[id]/page.tsx    # summary, charts, map, destination cards
  results/[id]/dest/[slug]/page.tsx  # detail analytics page

components/
  LivePhotoPane.tsx        # left/right collages (vacationy, landmark-centric)
  LiveCollage.tsx          # responsive rails + wide center
  DestDetailClient.tsx     # charts, notes, map, tables (no inline photos)
  DestinationCard.tsx      # destination teaser cards
  MapLeaflet.tsx, MonthLine.tsx, SectionCard.tsx, BackgroundMap.tsx

lib/
  db.ts                    # SQL helper (q)

app/layout.tsx             # site metadata (title/description)
next.config.mjs            # remote image hosts (Wikimedia)
```

---

## 🔍 Image Strategy
- Short, **city-anchored** queries (e.g., `Tokyo Shibuya`, `Lisbon Alfama`, `Barcelona beach`).
- Server-side preload for a handful per destination (faster initial paint).
- Filter non-photos via Wikimedia metadata (exclude categories like documents, logos, flags, maps).
- `next/image` handles responsive optimization; Wikimedia hosts are whitelisted.

---

## ⚙️ Configuration Notes

**`app/layout.tsx`**
```ts
export const metadata = {
  title: { default: "Wanderbot", template: "%s · Wanderbot" },
  description: "Plan smarter trips with airfare insights and gorgeous collages.",
};
```

**`next.config.mjs`** (remote image hosts)
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "commons.wikimedia.org" }
    ],
  },
  experimental: { optimizeCss: false },
  headers: async () => [
    {
      source: "/api/images",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=60, s-maxage=600, stale-while-revalidate=86400",
        },
      ],
    },
  ],
};

export default nextConfig;
```

---

## 🧪 Troubleshooting

- **No images / 401 from `/api/images`**
  - Ensure `NEXT_PUBLIC_BASE_URL` matches your deployed URL (e.g., `https://your-app.vercel.app`).
  - Confirm `next.config.mjs` includes Wikimedia `remotePatterns`.
  - In Vercel: set env vars for **Production** and **Preview**.

- **405 on `/api/images`**
  - Client method mismatch. This repo expects `POST` for `/api/images`.

- **Slow first load of rails**
  - Preload uses server fetch + caching headers; verify they’re present (see config above).
  - Reduce preload `count` if bandwidth constrained.

- **“This page could not be found” after form submission**
  - Verify `app/results/[id]/page.tsx` exists and client routes to `/results/${planId}`.

- **TypeScript prop errors**
  - Ensure `LivePhotoPane` props match usage (`terms`, `count`, optional `side`/`orientation`, `className`).
  - Update all call sites when refactoring prop names.

---

## 🗺️ Roadmap
- ✈️ Real fare integrations by origin airport
- 🧭 Day-by-day micro-itineraries
- 🧪 Image-term strategy A/Bs
- 🧑‍🤝‍🧑 Share/collab mode
- 📦 Export (PDF / Notion)

---

## 🤝 Contributing
PRs welcome. Please:
- Validate inputs/outputs with Zod.
- Prefer server-side preloading for expensive operations.
- Keep the UI airy, readable, and photo-forward.

---

## 📄 License
MIT © Wanderbot
