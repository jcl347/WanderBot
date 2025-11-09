**╔══════════════════════════════════════════════════════════════╗
║  W A N D E R B O T    •   plan smarter • see more • relax    ║
╠══════════════════════════════════════════════════════════════╣
║  Cities ▸ Fares ▸ Maps ▸ Photo Collages (Wikimedia Commons)  ║
╚══════════════════════════════════════════════════════════════╝
**

<img width="1501" height="900" alt="image" src="https://github.com/user-attachments/assets/d069e526-e7ea-4ff9-8d01-60c452e732a2" />🌍 Wanderbot

Plan beautiful, data-smart trips in minutes. Wanderbot blends airfare heuristics, curated photo collages, and interactive maps into a clean, shareable plan for your crew.

Live demo: https://wander-bot-puce.vercel.app/

<p align="center"> <img alt="Wanderbot hero" src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Tokyo_Montage.jpg/640px-Tokyo_Montage.jpg" /> </p>
✨ What it does

Group-aware trip planning – Input travelers (home city, preferences), a month window, and ideas.

Smart fare estimates – Heuristic monthly averages by traveler (short/medium/long-haul bands, competition, seasonality).

Photo collages that inspire

Interactive maps – Auto-placed pins and centers per destination.

Clear cost comparisons – Per-person and group totals you can act on.

Production-friendly outputs – Normalized JSON, Postgres persistence, Zod-validated schema.

🧠 How it works (high level)

/api/plan – Takes your group + timeframe → asks the model for 5 destinations (strict JSON), including fares, highlights, map pins, and image search terms.

Normalization – Cleans/smooths fare curves, fills missing months, normalizes map markers, expands monthly notes.

Image preload – Server fetches preview photos from Wikimedia via /api/images so the UI loads instantly.

Persistence – Saves the plan and destination details to Postgres (plans, destinations).

Results UI – Shows a thick, center analytics pane (charts, notes, tables) with photo collages on both sides.

🖼️ Screens (concept)


	
🧩 Tech Stack

Next.js 15 (App Router) + TypeScript

OpenAI Responses / Chat Completions (configurable model)

Postgres (SQL helper via q)

Zod (strict runtime validation)

Leaflet maps

Wikimedia Commons images (via custom /api/images)

Tailwind UI vibes (clean cards, spacious grid, balanced typography)

🚀 Quickstart
1) Clone & install
git clone https://github.com/yourname/wanderbot.git
cd wanderbot
npm i

2) Environment variables

Create .env.local:

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1

# Database
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DB



3) DB tables (minimal)
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

4) Run dev
npm run dev



🛣️ Key endpoints
POST /api/plan

Input: { travelers: [...], timeframe: { startMonth, endMonth }, suggestions? }

Output: { planId }

Side effects: saves plan + 5 destinations.

POST /api/images

Input: { terms: string[], count?: number }

Output: { images: Array<{ url, title?, source: "wikimedia" }> }

Uses Wikimedia’s image search with light filtering and returns preload-friendly URLs.

🧱 Important files
app/
  api/
    plan/route.ts         # model prompt, normalization, persistence, image preload
    images/route.ts       # Wikimedia fetch + filtering
  results/[id]/page.tsx   # summary, charts, map, destination cards
  results/[id]/dest/[slug]/page.tsx  # detail analytics page

components/
  LivePhotoPane.tsx       # left/right collages
  LiveCollage.tsx         # responsive rails + wide center
  DestDetailClient.tsx    # charts, notes, map, tables
  DestinationCard.tsx     # destination teaser cards
  MapLeaflet.tsx, MonthLine.tsx, SectionCard.tsx, BackgroundMap.tsx

lib/
  db.ts                   # SQL helper (q)

🔍 Image strategy (vacation-focused)

LLM generates city-anchored image terms (e.g., “Barcelona Gothic Quarter”, “Barcelona tapas bar”, “Barcelona beach sunset”), keeping queries short & location-centric.

Server preloads a handful of images per destination so the rails feel instant.

Filtering removes non-photo content (scans Wikimedia metadata for categories like portrait, document, logo, map, flag, seal, etc.).

Next/Image handles responsive layout & caching; Next config whitelists Wikimedia hosts.

⚙️ Configuration notes

Change the site title in app/layout.tsx metadata:

export const metadata = {
  title: { default: "Wanderbot", template: "%s · Wanderbot" },
  description: "Plan smarter trips with airfare insights and gorgeous collages.",
};


Remote image hosts are configured in next.config.mjs (Wikimedia, Openverse optional).

You can use NEXT_PUBLIC_MOCK=1 to drive demo/mock content while testing the UI.

🗺️ Roadmap

✈️ Real fare integrations by origin airport (optionally cache)

🧭 Day-by-day micro-itineraries with time blocks

🧪 A/B variants for image term strategies

🧑‍🤝‍🧑 Collab links + “share this plan” mode

📦 Export to PDF / Notion

🤝 Contributing

PRs welcome! Please:

Validate all API inputs/outputs with Zod.

Favor server-side preloading for anything expensive.

📄 License

MIT © Wanderbot

Build delightful, decisive travel planning.
Questions or ideas? Open an issue in the repo or reach out via the demo site.
