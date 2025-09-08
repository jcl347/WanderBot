import { Pool } from "pg";

// prefer POSTGRES_URL; fallback to DATABASE_URL if you ever need it
const connectionString =
  process.env.POSTGRES_URL || process.env.DATABASE_URL || "";

export const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
});

export async function q<T=any>(sql: string, params: any[] = []) {
  const { rows } = await pool.query(sql, params);
  return rows as T[];
}
