// lib/db.ts
import { Pool } from "pg";

const conn = process.env.POSTGRES_URL;
if (!conn) {
  throw new Error("POSTGRES_URL is not set (Vercel → Settings → Environment Variables).");
}

export const pool = new Pool({ connectionString: conn });

export async function q<T = any>(sql: string, params: any[] = []) {
  const { rows } = await pool.query(sql, params);
  return rows as T[];
}
