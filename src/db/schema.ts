import { index, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const cache = pgTable(
  "cache",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull(),
    data: jsonb("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("idx_cache_key_created").on(table.key, table.createdAt)],
);
