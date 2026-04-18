# Paniers de l'Adour API

An ElysiaJS API that scrapes and serves structured data from [panierdeladour.com](https://www.panierdeladour.com), deployed on Vercel.

## Development

```bash
bun install
bun run dev
```

Open http://localhost:3000/ to see the result.

## Database

### Architecture

The API uses a two-tier caching strategy to minimize upstream scraping:

1. **L1 — In-memory** (`src/modules/paniers/cache.ts`): TTL-based `Map` cache. Fastest, but lost on every Vercel cold start.
2. **L2 — Neon PostgreSQL** (`src/db/cache-repository.ts`): Persistent cache using Drizzle ORM over `@neondatabase/serverless`. Survives cold starts. Stores up to 4 historical entries per cache key.
3. **Upstream scrape**: Falls through to scraping when both caches miss.

### Environment Variables

| Variable                    | Required | Description                                                                                                                                  |
| --------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`              | No       | Neon PostgreSQL connection string for the persistent L2 cache. Without it, the API falls back to in-memory cache plus live upstream fetches. |
| `NEON_LOCAL_FETCH_ENDPOINT` | No       | Set to `http://localhost:5432/sql` when using neon-local for local dev.                                                                      |
| `POSTHOG_API_KEY`           | No       | Enables PostHog server-side telemetry and error tracking.                                                                                    |
| `POSTHOG_HOST`              | No       | Override the PostHog host when using a region-specific or self-hosted instance.                                                              |
| `POSTHOG_UPLOAD_SOURCEMAPS` | No       | Set to `true` in production only after the build environment has been configured for PostHog CLI sourcemap uploads.                          |

### Local Database Setup

1. Add to `.env.local`:

   ```
   NEON_API_KEY=<your-neon-api-key>
   NEON_PROJECT_ID=<your-neon-project-id>
   BRANCH_ID=<your-neon-branch-id>
   DATABASE_URL=postgres://neon:npg@localhost:5432/neondb
   NEON_LOCAL_FETCH_ENDPOINT=http://localhost:5432/sql
   ```

2. Start neon-local:

   ```bash
   docker compose up -d
   ```

3. Push the schema:
   ```bash
   DATABASE_URL=postgres://neon:npg@localhost:5432/neondb bunx drizzle-kit push
   ```

> `bunx drizzle-kit` does **not** auto-load `.env.local` — pass `DATABASE_URL` explicitly or use `bun --env-file=.env.local x drizzle-kit push`.

### Migrations

Schema is defined in `src/db/schema.ts`. Migrations live in `drizzle/` and are committed to git.

| Command               | Description                                                        |
| --------------------- | ------------------------------------------------------------------ |
| `bun run db:generate` | Generate a migration from schema changes (commit the result)       |
| `bun run db:push`     | Push schema directly to the database (dev only, no migration file) |
| `bun run db:migrate`  | Apply pending migrations (production)                              |
| `bun run db:studio`   | Open Drizzle Studio for visual DB inspection                       |

After changing `src/db/schema.ts`, run `db:generate` and commit the resulting migration file.

## Testing

| Command                    | What it covers                         | Requirements   |
| -------------------------- | -------------------------------------- | -------------- |
| `bun run test:unit`        | Cache logic + HTML parsing             | None           |
| `bun run test:db`          | Database integration (CacheRepository) | `DATABASE_URL` |
| `bun run test:integration` | Endpoint tests (live scraping)         | Network access |

When `DATABASE_URL` is unset, `test/cache-repository.test.ts` is skipped so a plain `bun test` can still run in environments without Neon configured.
