# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Nixo (mobile artifact)

Ad-free YouTube/YT Music style app. Bengali-friendly. Tabs: Home / Music / Downloads.

### Stream/data flow
- Piped scraping via `artifacts/api-server` proxy: `/api/piped/*` (Express; 60s cache; trending/search no-cache; 15 instance fallback).
- `/api/streams/:id` — merges Piped metadata with **yt-dlp** (system pkg) progressive audio/video URLs. Fixes empty audio/videoStreams + null uploadDate from live trending items. 30-min cache.
- `/api/proxy?url=` — used on web to bypass CORS for media; native uses URLs directly.
- `/api/download?url=&name=` — forces attachment; used by web download flow.
- Asset rewriter (`lib/piped.ts:unpipeUrl/rewriteAssets`) bypasses dead `pipedproxy.wireway.ch` by rewriting `https://<piped-proxy>/...?host=X` → `https://X/...` for thumbnails/avatars (preserves stream URLs).

### Home (`app/(tabs)/index.tsx`)
- Chips: All, Shorts, Music, Live, Gaming, News, Comedy, Sports, Tech, Podcasts, Movies, Vlogs.
- "All" = 3 random search seeds + 4-region trending in parallel (Piped trending currently 100% live globally; search seeds drive variety). Live & shorts filtered out.

### Music (`app/(tabs)/music.tsx`)
- Sections: Quick picks, Albums & playlists, New singles, Trending artists, Made for you. Sub-chips: Trending/Bangla/Hindi/English/Lo-fi/Workout/Chill/Devotional.
- Clicking album/playlist → `app/playlist/[id].tsx` with **Download all** (m4a loop + per-item progress).

### Downloads (`lib/downloads.ts`)
- Web: anchor + `/api/download` for forced attachment.
- Native: `expo-file-system/legacy` `createDownloadResumable` + persisted in `LibraryContext`.

### Brand & nav
- Color: `#E53935`. Tab icons: red YouTube play (Home) + circular YT-Music style (Music) in `app/(tabs)/_layout.tsx`.
