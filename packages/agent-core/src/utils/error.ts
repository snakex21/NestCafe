/**
 * Coerce an unknown value to a string for use in error messages.
 *
 * The OpenCode stream parser casts JSON.parse output via a type assertion,
 * so values typed as `string` at compile time may be objects at runtime.
 * This function ensures a usable string regardless of the actual type.
 */
export function serializeError(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message || error.name || 'Unknown error';
  }
  if (error && typeof error === 'object') {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === 'string' && maybeMessage.trim().length > 0) {
      return maybeMessage;
    }
    const nestedError = (error as { error?: unknown }).error;
    if (nestedError !== undefined && nestedError !== error) {
      return serializeError(nestedError);
    }
    try {
      const stringified = JSON.stringify(error, null, 2);
      if (stringified && stringified !== '{}') {
        return stringified;
      }
    } catch {
      // Fall through to String coercion.
    }
  }
  const coerced = String(error);
  return coerced && coerced !== '[object Object]' ? coerced : 'Unknown error';
}
