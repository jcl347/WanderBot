import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.POSTGRES_URL?.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
});

(async () => {
  try {
    const res = await pool.query("SELECT now()");
    console.log("DB time:", res.rows[0]);
  } catch (err) {
    console.error("DB connection failed:", err);
  } finally {
    await pool.end();
  }
})();