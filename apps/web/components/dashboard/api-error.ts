/**
 * Pulls a human-readable message out of an unknown thrown value.
 *
 * Axios puts the API's message at `error.response.data.message`; everything
 * else falls back to the caller's copy. Typed against `unknown` so call sites
 * do not need `catch (err: any)`.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null) {
    const response = (error as { response?: { data?: { message?: unknown } } })
      .response;
    const message = response?.data?.message;
    if (typeof message === "string" && message.trim()) return message;
    if (Array.isArray(message)) {
      // class-validator returns an array of constraint messages.
      const joined = message
        .filter((item) => typeof item === "string")
        .join(", ");
      if (joined) return joined;
    }
  }
  return fallback;
}
