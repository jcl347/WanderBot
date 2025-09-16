// lib/db.ts
import "server-only";
import { sql } from "@vercel/postgres";

// Simple wrapper matching your current q() usage
export async function q<T = any>(query: string, params: any[] = []): Promise<T[]> {
  const res = await sql.query<T>(query, params);
  // @ts-ignore – sql.query<T> has imperfect typing, rows is correct
  return res.rows as T[];
}

export { sql };
