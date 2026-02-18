/**
 * Basic domain sanitization for expansion engine.
 * No override file or DB overrides; consistent rules for joinable domains.
 */

/**
 * Sanitize a raw domain or URL for use as canonical domain key.
 * - Lowercase
 * - Remove www. prefix
 * - Remove query string and hash
 * - Extract host (no path); normalize to apex/second-level where appropriate
 */
export function sanitizeDomain(input: string): string {
  if (!input || typeof input !== "string") {
    return "";
  }

  let s = input.trim().toLowerCase();

  // Remove protocol if present
  const protocolMatch = /^https?:\/\//i.exec(s);
  if (protocolMatch) {
    s = s.slice(protocolMatch[0].length);
  }

  // Remove path, query, hash (take only host part)
  const slashIdx = s.indexOf("/");
  if (slashIdx !== -1) {
    s = s.slice(0, slashIdx);
  }
  const qIdx = s.indexOf("?");
  if (qIdx !== -1) {
    s = s.slice(0, qIdx);
  }
  const hIdx = s.indexOf("#");
  if (hIdx !== -1) {
    s = s.slice(0, hIdx);
  }

  // Remove www. prefix
  if (s.startsWith("www.")) {
    s = s.slice(4);
  }

  // Remove trailing dot
  s = s.replace(/\.+$/, "");

  // Empty or invalid
  if (!s || s.length > 253) {
    return "";
  }

  return s;
}
