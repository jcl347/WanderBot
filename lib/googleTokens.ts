import { cookies } from "next/headers";
import { getSessionId, getTokenSet, saveTokenSet } from "@/lib/session";
import { getGoogleClient } from "@/lib/googleClient";
import { refreshTokenGrant } from "openid-client";

export type FreshTokens = {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
};

// Refresh when close to expiry (30s) or when missing access token but we have a refresh token
const EXPIRY_SKEW_MS = 30_000;

export async function getFreshAccessToken(): Promise<FreshTokens> {
  const jar = await cookies();
  const sessionId = await getSessionId();
  const tokenSet = getTokenSet(sessionId);

  let accessToken = jar.get("gc_access_token")?.value || tokenSet?.access_token;
  let refreshToken = jar.get("gc_refresh_token")?.value || tokenSet?.refresh_token;
  const expiresAtStr =
    jar.get("gc_expires_at")?.value ||
    (tokenSet?.expires_at != null ? String(tokenSet.expires_at) : undefined);
  let expiresAt = expiresAtStr ? Number(expiresAtStr) : undefined;

  const now = Date.now();
  const isExpiringSoon = expiresAt != null && now > expiresAt - EXPIRY_SKEW_MS;
  const shouldRefresh = Boolean(refreshToken && (!accessToken || isExpiringSoon));

  if (shouldRefresh) {
    try {
      const config = await getGoogleClient();
      const refreshed = await refreshTokenGrant(config, refreshToken!);
      accessToken = refreshed.access_token || accessToken;
      refreshToken = refreshed.refresh_token || refreshToken;
      expiresAt =
        refreshed.expires_in != null ? now + refreshed.expires_in * 1000 : expiresAt;

      // Persist refreshed tokens
      const cookieOptions = {
        httpOnly: true as const,
        sameSite: "lax" as const,
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 7,
      };
      if (accessToken) jar.set("gc_access_token", accessToken, cookieOptions);
      if (refreshToken) jar.set("gc_refresh_token", refreshToken, cookieOptions);
      if (expiresAt) jar.set("gc_expires_at", String(expiresAt), cookieOptions);
      if (sessionId) {
        const existing = tokenSet || {};
        saveTokenSet(sessionId, {
          ...existing,
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAt,
        });
      }
    } catch {
      // If refresh fails, fall through and return whatever we have
    }
  }

  return { accessToken, refreshToken, expiresAt };
}
