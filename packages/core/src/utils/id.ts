// ============================================================
// ID generation utilities — pure functions, safe for browser.
// ============================================================

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Generates a short, URL-safe unique ID (e.g., "xk3m9a2b").
 * Not cryptographically secure — use crypto.randomUUID() for security IDs.
 */
export function generateId(length = 8): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return result;
}

/**
 * Generates a prefixed ID for type-safe identification.
 * Example: generateTypedId('task') → "task_xk3m9a2b"
 */
export function generateTypedId(prefix: string, length = 8): string {
  return `${prefix}_${generateId(length)}`;
}
