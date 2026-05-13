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
7. **Model importer uncertainty.** Agent-discovered concerts can be incomplete or
   ambiguous; preserve confidence, warnings, and review state instead of forcing
   false precision.

## Cross-cutting decisions

These decisions bind the database, REST API, MCP tools, client package, and RSS
feed together.

### Slugs

- `venues.slug` and `concerts.slug` are server-derived from `name` / `title`, with
  deterministic numeric suffixes for collisions, e.g. `foo`, `foo-2`, `foo-3`.
- Generated slugs must never be all digits. If slugification produces an all-digit
  slug, prefix it with the resource type, e.g. `concert-2024` or `venue-404`.
- `:idOrSlug` resolvers should therefore treat all-digit path parameters as IDs
  and every other value as a slug.
- Slugs are immutable once created.
- `PATCH` and `POST /concerts/import` do not regenerate a slug when `name` or
  `title` changes on an existing record.
- Importers and MCP clients should not supply slugs in v1. If manual slug editing
  is ever added, it must be an explicit protected operation.

### Date-time wire format

- Date-time fields are stored as `timestamptz` and returned on the wire as UTC ISO
  8601 strings.
- Write inputs must be ISO 8601 date-time strings with either `Z` or an explicit
  numeric offset, e.g. `2026-06-12T18:00:00Z` or `2026-06-12T20:00:00+02:00`.
  Naive local strings such as `2026-06-12T20:00:00` are rejected.
- `timezone` is returned as a separate IANA timezone string, defaulting to
  `Europe/Paris`.
- Clients, RSS rendering, and MCP consumers should localize display from the UTC
  instant plus `timezone`; the API should not return pre-formatted local strings.

### Public response envelope

Concert read endpoints should keep the existing public API's outer
`{ data, lastUpdated }` envelope, but use concert-specific `lastUpdated`
semantics because concerts are pushed into the database rather than scraped as a
single upstream snapshot.

- Collection endpoints: `lastUpdated` is the maximum `updatedAt` among returned
  rows, or the request time for an empty result set.
- Detail endpoints: `lastUpdated` is the concert row's `updatedAt`.
- `GET /concerts` adds a concerts-only `pagination` object. This does not create
  a shared pagination convention for existing modules.
- Public MCP read tools should return the same envelopes as the corresponding
  REST read endpoints.
- Protected REST writes and protected MCP writes should both return the richer
  mutation result shape documented in [LLM-friendly response shape](#llm-friendly-response-shape).
- RSS remains XML and does not use this JSON envelope.

### Public vs private fields

- `interestLevel` is intentionally public. The directory is curated around
  Thanaen's interest, and exposing `maybe` / `interested` / `must_go` makes the
  catalogue and RSS more useful.
- `publicationStatus` controls visibility. Public REST, public MCP, and RSS should
  expose only `published` concerts by default. Protected/admin surfaces can see
  `draft` and `archived` concerts.
- `notes`, `importNotes`, `agentWarnings`, `confidence`, `needsHumanReview`, and
  source `rawPayload` are private/admin fields unless explicitly promoted later.

### Primary source URL

- `concert_sources.sourceUrl` stores per-source/importer URLs.
- `concerts.sourceUrl` is a curator-controlled primary public source URL used for
  display, public detail links, and RSS fallback links.
- Import/upsert operations may set `concerts.sourceUrl` when creating a concert or
  when it is currently empty, but they must not overwrite an existing primary
  source URL unless the request explicitly asks to replace it with
  `replacePrimarySourceUrl: true`.

### Hard deletion and source rows

Soft delete is the v1 default. If a future hard-delete option is implemented,
`concert_sources.concertId` should use `on delete restrict`. A hard delete must
therefore either fail with a clear `409 CONFLICT` while source rows exist or use an
explicit admin operation that first removes source rows.

### Import uncertainty and review flow

Moka's current concert watch can reliably find titles, dates, venues/cities,
source URLs, rough styles/tags, and subjective interest, but some fields are often
missing or fragile: exact prices, doors/end times, stable external IDs, images,
lineups for festivals, and cancellation/postponement status.

The import contract should therefore support:

- `publicationStatus = draft` when the event should be stored but hidden from
  public API/RSS until reviewed;
- `needsHumanReview = true` when dedupe, venue, date, price, status, or geography
  is uncertain;
- `confidence` as a coarse global score from `0` to `1` for importer certainty;
- `agentWarnings` as structured warning codes/messages that can be returned to
  Moka and stored for later review;
- `importNotes` as private free-text context from the importer;
- `regionScope` to encode local filtering decisions such as Pays basque, Sud
  Landes, or stricter Spain handling.

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

| Column              | Type                                   | Notes                                                |
| ------------------- | -------------------------------------- | ---------------------------------------------------- |
| `id`                | `serial primary key`                   | Internal concert ID.                                 |
| `slug`              | `text not null unique`                 | Server-derived, immutable URL-friendly identifier.   |
| `title`             | `text not null`                        | Human-readable event title.                          |
| `headlineArtist`    | `text`                                 | Main artist when obvious.                            |
| `artists`           | `jsonb not null default '[]'`          | Array of `{ name, role? }`. Keeps v1 simple.         |
| `description`       | `text`                                 | Public description.                                  |
| `startsAt`          | `timestamptz not null`                 | Main event start instant. Returned as UTC ISO.       |
| `endsAt`            | `timestamptz`                          | Optional end instant. Returned as UTC ISO.           |
| `doorsAt`           | `timestamptz`                          | Optional doors opening instant. Returned as UTC ISO. |
| `timezone`          | `text not null default 'Europe/Paris'` | IANA timezone for display localization.              |
| `venueId`           | `integer references venues(id)`        | Optional until venue is known.                       |
| `status`            | `text not null default 'scheduled'`    | See enum below.                                      |
| `publicationStatus` | `text not null default 'draft'`        | Public visibility. See enum below.                   |
| `interestLevel`     | `text not null default 'interested'`   | Public curated interest level. See enum below.       |
| `regionScope`       | `text`                                 | Local scope/category for geography filtering.        |
| `confidence`        | `numeric(3,2)`                         | Importer certainty from `0` to `1`.                  |
| `needsHumanReview`  | `boolean not null default false`       | Whether an admin/agent should review before publish. |
| `genres`            | `jsonb not null default '[]'`          | Array of strings.                                    |
| `tags`              | `jsonb not null default '[]'`          | Agent/user-defined labels.                           |
| `ticketUrl`         | `text`                                 | Ticketing URL.                                       |
| `sourceUrl`         | `text`                                 | Curator-controlled primary public source URL.        |
| `imageUrl`          | `text`                                 | Poster/cover image URL.                              |
| `priceMin`          | `numeric(10,2)`                        | Optional structured price.                           |
| `priceMax`          | `numeric(10,2)`                        | Optional structured price.                           |
| `priceCurrency`     | `text not null default 'EUR'`          | Currency for structured prices.                      |
| `priceText`         | `text`                                 | Human-readable fallback, e.g. `12€ / 15€ sur place`. |
| `notes`             | `text`                                 | Private/editorial notes for protected surfaces only. |
| `importNotes`       | `text`                                 | Private importer notes, not public.                  |
| `agentWarnings`     | `jsonb not null default '[]'`          | Structured private warning codes/messages.           |
| `discoveredAt`      | `timestamptz not null default now()`   | First discovery time.                                |
| `lastSeenAt`        | `timestamptz`                          | Last importer confirmation.                          |
| `createdAt`         | `timestamptz not null default now()`   | Audit field and RSS `pubDate`.                       |
| `updatedAt`         | `timestamptz not null default now()`   | Audit field and JSON `lastUpdated` source.           |
| `deletedAt`         | `timestamptz`                          | Soft-delete marker.                                  |

Suggested indexes:

- `concerts_starts_at_idx` on `startsAt`.
- `concerts_status_starts_at_idx` on `(status, startsAt)`.
- `concerts_interest_level_idx` on `interestLevel`.
- `concerts_publication_status_starts_at_idx` on `(publicationStatus, startsAt)`.
- `concerts_needs_human_review_starts_at_idx` on `(startsAt)` where
  `needsHumanReview = true`.
- `concerts_deleted_at_idx` on `deletedAt`.
- `venues_city_idx` on `city`.

Suggested constraints:

- `CHECK (confidence is null or (confidence >= 0 and confidence <= 1))`.

### `concert_sources`

A separate table keeps source/import metadata extensible and supports multiple
sources pointing to the same curated concert.

| Column           | Type                                                          | Notes                                                            |
| ---------------- | ------------------------------------------------------------- | ---------------------------------------------------------------- |
| `id`             | `serial primary key`                                          | Internal source row ID.                                          |
| `concertId`      | `integer not null references concerts(id) on delete restrict` | Curated concert.                                                 |
| `sourceName`     | `text not null`                                               | Importer/source name, e.g. `facebook`, `venue-site`, `songkick`. |
| `externalId`     | `text`                                                        | Source-specific stable ID when available.                        |
| `sourceUrl`      | `text`                                                        | Source URL used by importer.                                     |
| `contentHash`    | `text`                                                        | Hash of normalized relevant source content.                      |
| `sourcePriority` | `integer not null default 100`                                | Lower number wins when source data conflicts.                    |
| `rawPayload`     | `jsonb`                                                       | Original source payload or extracted data.                       |
| `firstSeenAt`    | `timestamptz not null default now()`                          | First source sighting.                                           |
| `lastSeenAt`     | `timestamptz not null default now()`                          | Last source sighting.                                            |
| `createdAt`      | `timestamptz not null default now()`                          | Audit field.                                                     |
| `updatedAt`      | `timestamptz not null default now()`                          | Audit field.                                                     |

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

### `PublicationStatus`

- `draft` — stored for review but hidden from public API/RSS by default.
- `published` — visible in public API/RSS.
- `archived` — hidden from default public listings without being deleted.

### `RegionScope`

Initial values can stay string-based until geography is better understood, but
Moka identified these useful buckets:

- `pays_basque`
- `sud_landes`
- `spain_priority_only`
- `other`

## REST API plan

### Public read endpoints

- `GET /concerts`
  - Defaults to future, published, non-deleted concerts.
  - Query filters: `from`, `to`, `city`, `venueId`, `status`, `interestLevel`,
    `regionScope`, `tag`, `includePast`.
  - Pagination: `limit` with default `50` and max `100`; `cursor` for stable
    pagination.
  - Cursor sort key: upcoming first by `(startsAt, id)`.
  - Response shape: `{ data, lastUpdated, pagination }`.
  - `pagination` shape: `{ nextCursor: string | null, hasMore: boolean }`.
- `GET /concerts/:idOrSlug`
  - Returns one published, non-deleted concert.
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
  - Does not regenerate slug when an existing concert is updated from an import.
  - Accepts `replacePrimarySourceUrl: true` to overwrite an existing
    `concerts.sourceUrl`; otherwise imports only fill it when empty.
  - Accepts importer uncertainty fields: `confidence`, `agentWarnings`,
    `importNotes`, `needsHumanReview`, `publicationStatus`, and `regionScope`.
- `PATCH /concerts/:idOrSlug`
  - Partial update.
  - Does not regenerate slug from changed title.
  - Accepts `replacePrimarySourceUrl: true` when the request intentionally changes
    an existing primary source URL.
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
  - Public tool returns published concerts only by default.
- `get_concert_detail`
  - Input: `idOrSlug`.

### Protected/admin tools

Admin tools must require API key protection. Preferred design:

- Keep the current public MCP endpoint for read-only tools.
- Add a protected MCP endpoint, for example `/mcp/admin`, that registers admin
  tools only after validating `x-api-key`.

Protected read tools:

- `list_concerts_for_review` for draft / `needsHumanReview` queues.

Protected write tools:

- `create_concert`
- `update_concert`
- `delete_concert`
- `upsert_concert_from_source`

### LLM-friendly response shape

Protected REST write endpoints and mutating MCP tools should return structured
results such as the following. The response `warnings` array is the persisted
`agentWarnings` array for the affected row, returned under the shorter response
name for readability:

```json
{
  "ok": true,
  "action": "created",
  "concert": {},
  "warnings": [{ "code": "MISSING_PRICE", "message": "No reliable price found in source." }],
  "needsHumanReview": false,
  "confidence": 0.86,
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

## Moka integration check

Moka is expected to be the first automated consumer/writer for this feature. A
first sync confirmed the design is **OK with minor adjustments**.

Moka can reliably provide:

- title and approximate headline artist;
- start date/time when available, usually local source time;
- venue and city;
- source/ticket URL when stable;
- rough genres/tags;
- short description;
- subjective interest level for Thanaen;
- discovery and last-seen timestamps.

Moka flagged these fields as often fragile or missing:

- end time and doors time;
- exact price and sold-out state;
- stable external ID;
- image URL;
- source-provided timezone;
- complete lineup for festivals / multi-band evenings;
- reliable cancellation or postponement status.

Moka prefers protected MCP admin tools when available because they are easier for
an agent to call with structured errors and managed `x-api-key` auth. REST remains a
good fallback for scripts or cron jobs.

Moka-specific edge cases to handle:

- same concert appears through both venue and ticketing sources;
- titles vary across sources, especially `artist + guests`, themed evenings, and
  festivals;
- reported concerts can keep the same URL while date/status changes;
- cancellations can be silent;
- some sources lack stable URLs;
- multi-day festivals may need one concert per day/session;
- Spain should be imported only for high-interest events, not blindly.

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
- Only `published` concerts are included by default.

Default feed order should be discovery/insert order (`createdAt desc`) because
feed readers are optimized around newly published items. Public API list endpoints
should sort by event date for planning.

## Open questions

- Exact API key environment variable name: `CONCERTS_API_KEY` vs `ADMIN_API_KEY`.
- Whether venue creation should be separate or embedded in concert create/upsert.
- Whether Moka needs batch import in v1 or one upsert per concert is enough.
- Exact default geography behind `regionScope` values and public filters.
- Whether imports should default to `draft` or allow selected trusted sources to
  create `published` concerts directly.
