// lib/db.ts
import "server-only";
import { Pool } from "pg";

// Prefer POSTGRES_URL (Neon), fallback to DATABASE_URL if needed
const connectionString =
  process.env.POSTGRES_URL || process.env.DATABASE_URL || "";

export const pool = new Pool({
  connectionString,
  // Neon requires TLS; this toggle lets local dev work too
  ssl: connectionString.includes("neon.tech")
    ? { rejectUnauthorized: false }
    : undefined,
});

export async function q<T = any>(sql: string, params: any[] = []) {
  const { rows } = await pool.query(sql, params);
  return rows as T[];
}
