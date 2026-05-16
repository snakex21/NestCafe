// ============================================================
// JSON utility functions — safe parsing, serialization helpers.
// ============================================================

/**
 * Safely parses a JSON string, returning the default value on failure.
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Safely stringifies a value, returning the fallback string on failure.
 */
export function safeJsonStringify(value: unknown, fallback = '{}'): string {
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}
