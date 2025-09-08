// scripts/test-openai.mjs
import 'dotenv/config';                          // loads .env (we’ll point it to .env.local below)
import fs from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';

// Prefer .env.local if present
const envLocal = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocal)) {
  const dotenv = await import('dotenv');
  dotenv.config({ path: envLocal, override: true });
}

if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is missing. Put it in .env.local and restart.');
  process.exit(1);
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

try {
  const resp = await client.responses.create({
    model: 'gpt-5',
    input: 'Reply with exactly one word: pong',
  });
  console.log('OpenAI OK →', resp.output_text); // should print: pong
} catch (err) {
  console.error('OpenAI request failed:', err?.message || err);
  process.exit(1);
}
