ALTER TABLE "panier_cache" RENAME TO "cache";--> statement-breakpoint
DROP INDEX "idx_panier_cache_key_created";--> statement-breakpoint
CREATE INDEX "idx_cache_key_created" ON "cache" USING btree ("key","created_at");