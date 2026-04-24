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
- Chips: All, Music, Live, Gaming, News, Comedy, Sports, Tech, Podcasts, Movies, Vlogs (no "Shorts" chip — Shorts now appear as a horizontal shelf injected after the 4th video on "All").
- "All" = 3 random search seeds + 4-region trending in parallel; videos with `duration <= 60` filtered out (those go in the Shorts shelf).
- Shorts shelf (`home-shorts-shelf` query) pulls from regional trending + "shorts viral / funny shorts / music shorts" search seeds, items with `duration <= 60` or `isShort`. Tapping a tile opens `/shorts?start=<videoId>`.

### Shorts (`app/shorts.tsx`)
- Vertical paged FlatList by screen height; `pagingEnabled`, `snapToInterval`. Each page: full-bleed `useVideoPlayer` with `loop=true`, autoplay only on the active page (70% viewport threshold via `onViewableItemsChanged`).
- Right-side actions column: avatar+subscribe, like, comments, save, share, audio. Bottom overlay: title, uploader, view count.
- Accepts `?start=<videoId>` to seed first page. Registered in `_layout.tsx` with slide-from-bottom modal animation.

### Music (`app/(tabs)/music.tsx`)
- YT Music dark style: `#030303` bg, `#ff0844` accent. White brand mark with circular play. Pill chips (Trending/Bangla/Hindi/English/Lo-fi/Workout/Chill/Devotional).
- Hero "Top pick for you" card with blurred-thumbnail bg + Play button. Sections: Quick picks (2-col grid), Albums, Music videos, Artists, Made for you.
- Clicking album/playlist → `app/playlist/[id].tsx` with **Download all** (m4a loop + per-item progress).

### Audio playback fix (critical)
- `/api/proxy` strips `Content-Disposition` headers from upstream and forces `Content-Disposition: inline`. Normalizes `Content-Type` from the `?mime=` query hint or URL extension to keep browsers from treating audio/mp4 as a download. Sends a desktop-Chrome User-Agent upstream and exposes `Content-Length, Content-Range, Accept-Ranges` for seeking.
- `mediaProxy(url, mime?)` in `lib/piped.ts` passes the mime hint; `PlayerContext.play()` forwards `audio.mimeType`.
- Verified end-to-end: HEAD on a proxied audio URL returns `206 Partial Content`, `Content-Type: audio/mp4`, `Content-Disposition: inline`.

### Downloads (`lib/downloads.ts`)
- Web: anchor + `/api/download` for forced attachment.
- Native: `expo-file-system/legacy` `createDownloadResumable` + persisted in `LibraryContext`.

### Brand & nav
- Color: `#E53935`. Tab icons: red YouTube play (Home) + circular YT-Music style (Music) in `app/(tabs)/_layout.tsx`.
