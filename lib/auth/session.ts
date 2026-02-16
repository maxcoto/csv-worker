import { nanoid } from "nanoid";

const SESSION_COOKIE_NAME = "session_id";
const SESSION_MAX_AGE_DAYS = 365;

/**
 * Reads session ID from the request cookie. Returns null if missing.
 */
export function getSessionIdFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  const match = cookieHeader
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${SESSION_COOKIE_NAME}=`));

  if (!match) return null;
  const value = match.slice(SESSION_COOKIE_NAME.length + 1).trim();
  return value.length > 0 ? value : null;
}

/**
 * Generates a new session ID (e.g. for setting as cookie when none present).
 */
export function createSessionId(): string {
  return nanoid(24);
}

/**
 * Builds the Set-Cookie header value for the session cookie.
 */
export function buildSessionCookieHeader(sessionId: string): string {
  const maxAge = SESSION_MAX_AGE_DAYS * 24 * 60 * 60;
  return `${SESSION_COOKIE_NAME}=${sessionId}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax`;
}
