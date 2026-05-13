# Concerts directory

## Goal

Build a curated directory of concerts around Thanaen's area, focused on events
that are personally interesting enough to track, expose through the public API,
consume from RSS, and manage from another agent such as Moka.

The project should stay LLM-friendly: stable field names, explicit enums, clear
validation errors, idempotent writes, and MCP tools that describe exactly what
happened and what to do next.

## Scope

### In scope

- Store discovered concerts in Neon/PostgreSQL.
- Create, update, delete, and upsert concerts through protected endpoints.
- Expose public read endpoints for upcoming concerts.
- Expose an RSS feed.
- Expose MCP tools matching the REST API.
- Protect every mutating REST and MCP operation with an API key.
- Keep enough source metadata to debug and improve importers later.

### Out of scope for v1

- User accounts or OAuth.
- Ticket purchase flows.
- Complex artist identity resolution.
- Full-text search beyond simple filters.
- Automatic scraping/import workers inside this API.

External systems can discover concerts and push them into this API.

## Data model principles

1. **Events are editable records, not immutable scrape results.** Imported data can
   be corrected manually or by an agent.
2. **Keep raw source context.** Store the normalized fields used by the API and the
   raw payload used to create/update them.
3. **Prefer safe deletion.** Default deletion should be a soft delete via
   `deletedAt`; hard deletion can be added later only if needed.
4. **Optimize for idempotent imports.** External importers should be able to retry
   without creating duplicates.
5. **Use closed enums where possible.** This makes OpenAPI, MCP, and LLM usage more
   predictable.
6. **Keep public identifiers stable.** Slugs and RSS GUIDs must not change because
   an agent edits a title.

## Cross-cutting decisions

These decisions bind the database, REST API, MCP tools, client package, and RSS
feed together.

### Slugs

- `venues.slug` and `concerts.slug` are server-derived from `name` / `title`, with
  deterministic numeric suffixes for collisions, e.g. `foo`, `foo-2`, `foo-3`.
- Slugs are immutable once created.
- `PATCH` does not regenerate a slug when `name` or `title` changes.
- Importers and MCP clients should not supply slugs in v1. If manual slug editing
  is ever added, it must be an explicit protected operation.

### Date-time wire format

- Date-time fields are stored as `timestamptz` and returned on the wire as UTC ISO
  8601 strings.
- `timezone` is returned as a separate IANA timezone string, defaulting to
  `Europe/Paris`.
- Clients, RSS rendering, and MCP consumers should localize display from the UTC
  instant plus `timezone`; the API should not return pre-formatted local strings.

### Public response envelope

Concert endpoints should follow the existing module convention and return a
`{ data, lastUpdated }` envelope.

- Collection endpoints: `lastUpdated` is the maximum `updatedAt` among returned
  rows, or the request time for an empty result set.
- Detail endpoints: `lastUpdated` is the concert row's `updatedAt`.
- RSS remains XML and does not use this JSON envelope.

### Public vs private fields

- `interestLevel` is intentionally public. The directory is curated around
  Thanaen's interest, and exposing `maybe` / `interested` / `must_go` makes the
  catalogue and RSS more useful.
- `notes` is private and must not be exposed by public REST endpoints, public MCP
  tools, or RSS. It may be returned only from protected/admin surfaces.

### Primary source URL

- `concert_sources.sourceUrl` stores per-source/importer URLs.
- `concerts.sourceUrl` is a curator-controlled primary public source URL used for
  display, public detail links, and RSS fallback links.
- Import/upsert operations may set `concerts.sourceUrl` when creating a concert or
  when it is currently empty, but they must not overwrite an existing primary
  source URL unless the request explicitly asks to replace it.

### Hard deletion and source rows

Soft delete is the v1 default. If a future hard-delete option is implemented,
`concert_sources.concertId` should use `on delete restrict`. A hard delete must
therefore either fail with a clear `409 CONFLICT` while source rows exist or use an
explicit admin operation that first removes source rows.

## Proposed database tables

### `venues`

Venues are normalized because they are useful for filtering, display, and dedupe.

| Column       | Type                                 | Notes                                              |
| ------------ | ------------------------------------ | -------------------------------------------------- |
| `id`         | `serial primary key`                 | Internal venue ID.                                 |
| `name`       | `text not null`                      | Display name.                                      |
| `slug`       | `text not null unique`               | Server-derived, immutable URL-friendly identifier. |
| `address`    | `text`                               | Street address when known.                         |
| `postalCode` | `text`                               | Postal code.                                       |
| `city`       | `text not null`                      | City is required for local discovery.              |
| `country`    | `text not null default 'FR'`         | ISO-like country code.                             |
| `latitude`   | `double precision`                   | Optional.                                          |
| `longitude`  | `double precision`                   | Optional.                                          |
| `websiteUrl` | `text`                               | Optional official venue URL.                       |
| `createdAt`  | `timestamptz not null default now()` | Audit field.                                       |
| `updatedAt`  | `timestamptz not null default now()` | Audit field.                                       |

### `concerts`

| Column           | Type                                   | Notes                                                |
| ---------------- | -------------------------------------- | ---------------------------------------------------- |
| `id`             | `serial primary key`                   | Internal concert ID.                                 |
| `slug`           | `text not null unique`                 | Server-derived, immutable URL-friendly identifier.   |
| `title`          | `text not null`                        | Human-readable event title.                          |
| `headlineArtist` | `text`                                 | Main artist when obvious.                            |
| `artists`        | `jsonb not null default '[]'`          | Array of `{ name, role? }`. Keeps v1 simple.         |
| `description`    | `text`                                 | Public description.                                  |
| `startsAt`       | `timestamptz not null`                 | Main event start instant. Returned as UTC ISO.       |
| `endsAt`         | `timestamptz`                          | Optional end instant. Returned as UTC ISO.           |
| `doorsAt`        | `timestamptz`                          | Optional doors opening instant. Returned as UTC ISO. |
| `timezone`       | `text not null default 'Europe/Paris'` | IANA timezone for display localization.              |
| `venueId`        | `integer references venues(id)`        | Optional until venue is known.                       |
| `status`         | `text not null default 'scheduled'`    | See enum below.                                      |
| `interestLevel`  | `text not null default 'interested'`   | Public curated interest level. See enum below.       |
| `genres`         | `jsonb not null default '[]'`          | Array of strings.                                    |
| `tags`           | `jsonb not null default '[]'`          | Agent/user-defined labels.                           |
| `ticketUrl`      | `text`                                 | Ticketing URL.                                       |
| `sourceUrl`      | `text`                                 | Curator-controlled primary public source URL.        |
| `imageUrl`       | `text`                                 | Poster/cover image URL.                              |
| `priceMin`       | `numeric(10,2)`                        | Optional structured price.                           |
| `priceMax`       | `numeric(10,2)`                        | Optional structured price.                           |
| `priceCurrency`  | `text not null default 'EUR'`          | Currency for structured prices.                      |
| `priceText`      | `text`                                 | Human-readable fallback, e.g. `12€ / 15€ sur place`. |
| `notes`          | `text`                                 | Private/editorial notes for protected surfaces only. |
| `discoveredAt`   | `timestamptz not null default now()`   | First discovery time.                                |
| `lastSeenAt`     | `timestamptz`                          | Last importer confirmation.                          |
| `createdAt`      | `timestamptz not null default now()`   | Audit field and RSS `pubDate`.                       |
| `updatedAt`      | `timestamptz not null default now()`   | Audit field and JSON `lastUpdated` source.           |
| `deletedAt`      | `timestamptz`                          | Soft-delete marker.                                  |

Suggested indexes:

- `concerts_starts_at_idx` on `startsAt`.
- `concerts_status_starts_at_idx` on `(status, startsAt)`.
- `concerts_interest_level_idx` on `interestLevel`.
- `concerts_deleted_at_idx` on `deletedAt`.
- `venues_city_idx` on `city`.

### `concert_sources`

A separate table keeps source/import metadata extensible and supports multiple
sources pointing to the same curated concert.

| Column        | Type                                                          | Notes                                                            |
| ------------- | ------------------------------------------------------------- | ---------------------------------------------------------------- |
| `id`          | `serial primary key`                                          | Internal source row ID.                                          |
| `concertId`   | `integer not null references concerts(id) on delete restrict` | Curated concert.                                                 |
| `sourceName`  | `text not null`                                               | Importer/source name, e.g. `facebook`, `venue-site`, `songkick`. |
| `externalId`  | `text`                                                        | Source-specific stable ID when available.                        |
| `sourceUrl`   | `text`                                                        | Source URL used by importer.                                     |
| `contentHash` | `text`                                                        | Hash of normalized relevant source content.                      |
| `rawPayload`  | `jsonb`                                                       | Original source payload or extracted data.                       |
| `firstSeenAt` | `timestamptz not null default now()`                          | First source sighting.                                           |
| `lastSeenAt`  | `timestamptz not null default now()`                          | Last source sighting.                                            |
| `createdAt`   | `timestamptz not null default now()`                          | Audit field.                                                     |
| `updatedAt`   | `timestamptz not null default now()`                          | Audit field.                                                     |

Suggested constraints:

- Unique `(sourceName, externalId)` when `externalId is not null`.
- Unique `(sourceName, sourceUrl)` when `sourceUrl is not null`.

When neither `externalId` nor `sourceUrl` is available, importers should use a
best-effort dedupe key based on normalized `title + startsAt + venue/city` and
return a warning.

## Enums

### `ConcertStatus`

- `scheduled` — event is planned and available.
- `postponed` — date changed or pending new date.
- `cancelled` — event cancelled.
- `sold_out` — event still happens but tickets are unavailable.
- `past` — event is historical; usually derived from date, but can be explicit.

### `ConcertInterestLevel`

- `maybe` — worth keeping, low priority.
- `interested` — default curated interest.
- `must_go` — high priority.

## REST API plan

### Public read endpoints

- `GET /concerts`
  - Defaults to future, non-deleted concerts.
  - Query filters: `from`, `to`, `city`, `venueId`, `status`, `interestLevel`,
    `tag`, `includePast`.
  - Pagination: `limit` with default `50` and max `100`; `cursor` for stable
    pagination.
  - Cursor sort key: upcoming first by `(startsAt, id)`.
  - Response shape: `{ data, lastUpdated, pagination }`.
- `GET /concerts/:idOrSlug`
  - Returns one non-deleted concert.
  - Accepts either numeric ID or immutable slug.
  - Response shape: `{ data, lastUpdated }`.
- `GET /concerts/feed.xml` or `GET /concerts.rss`
  - RSS feed for upcoming concerts.

### Protected write endpoints

All write endpoints require `x-api-key` and compare it with a server-side secret
such as `CONCERTS_API_KEY` or `ADMIN_API_KEY`.

- `POST /concerts`
  - Create one concert.
  - Server derives immutable slug.
- `POST /concerts/import`
  - Idempotent create/update from source metadata.
  - Best fit for external discovery systems.
  - Uses source constraints first, then best-effort dedupe.
- `PATCH /concerts/:idOrSlug`
  - Partial update.
  - Does not regenerate slug from changed title.
- `DELETE /concerts/:idOrSlug`
  - Soft-delete by default.
  - Optional future `?hard=true` should remain protected and explicit.
  - Future hard-delete attempts should respect `on delete restrict` source rows
    and return `409 CONFLICT` if import history still exists.

## MCP plan

MCP tools should mirror the REST API and be explicit enough for Moka or another
LLM agent to use safely.

### Public/read tools

- `list_concerts`
  - Filters and pagination mirror `GET /concerts`.
- `get_concert_detail`
  - Input: `idOrSlug`.

### Protected/write tools

Every mutating tool must require API key protection. Preferred design:

- Keep the current public MCP endpoint for read-only tools.
- Add a protected MCP endpoint, for example `/mcp/admin`, that registers mutating
  tools only after validating `x-api-key`.

Protected tools:

- `create_concert`
- `update_concert`
- `delete_concert`
- `upsert_concert_from_source`

### LLM-friendly response shape

Mutating MCP tools should return structured results such as:

```json
{
  "ok": true,
  "action": "created",
  "concert": {},
  "warnings": [],
  "dedupeDecision": {
    "matchedBy": "sourceName+externalId",
    "existingConcertId": null
  },
  "nextSuggestedAction": "Review the venue if city or address is missing."
}
```

Errors should also be structured and actionable:

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "startsAt must be an ISO 8601 date-time string.",
  "fieldErrors": [{ "field": "startsAt", "message": "Required" }]
}
```

## RSS feed decisions

RSS should target human consumption and simple automation.

Recommended fields:

- Item title: `title` plus city/date context.
- Item link: public concert detail URL when available; fallback to
  `concerts.sourceUrl`.
- Item GUID: stable API concert numeric ID, not slug.
- Item pubDate: `createdAt`, so feed readers see newly inserted rows as new even
  if `discoveredAt` was back-dated by an importer.
- Item description: date, venue, price, artists, public interest level, tags, and
  source link.

Default feed order should be discovery/insert order (`createdAt desc`) because
feed readers are optimized around newly published items. Public API list endpoints
should sort by event date for planning.

## Open questions

- Exact API key environment variable name: `CONCERTS_API_KEY` vs `ADMIN_API_KEY`.
- Whether venue creation should be separate or embedded in concert create/upsert.
- Which nearby geography is considered “in the area” for default filtering.
