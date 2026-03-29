import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

import * as schema from "./schema";

let _db: NeonHttpDatabase<typeof schema> | null | undefined;

export function getDb(): NeonHttpDatabase<typeof schema> | null {
  if (_db !== undefined) return _db;

  if (!process.env.DATABASE_URL) {
    _db = null;
    return null;
  }

  if (process.env.NEON_LOCAL_FETCH_ENDPOINT) {
    neonConfig.fetchEndpoint = process.env.NEON_LOCAL_FETCH_ENDPOINT;
    neonConfig.useSecureWebSocket = false;
    neonConfig.poolQueryViaFetch = true;
  }

  const sql = neon(process.env.DATABASE_URL);
  _db = drizzle({ client: sql, schema });
  return _db;
}
