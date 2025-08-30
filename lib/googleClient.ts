import { discovery, Configuration } from "openid-client";

let cachedConfig: Configuration | null = null;

export async function getGoogleClient(): Promise<Configuration> {
  if (cachedConfig) return cachedConfig;

  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env as Record<
    string,
    string | undefined
  >;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error(
      "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables"
    );
  }

  // Discover Google's Authorization Server metadata and configure the client
  cachedConfig = await discovery(
    new URL("https://accounts.google.com"),
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET
  );

  return cachedConfig;
}

export function getRedirectUri(): string {
  const { GOOGLE_REDIRECT_URI } = process.env as Record<string, string | undefined>;
  return GOOGLE_REDIRECT_URI || "http://localhost:3000/api/google/callback";
}

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events.readonly", // Read access to Calendar events
  "https://www.googleapis.com/auth/gmail.readonly", // Read access to Gmail
];
