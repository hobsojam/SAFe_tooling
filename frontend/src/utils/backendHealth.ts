export function isBackendUnavailable(error: unknown): boolean {
  if (error instanceof TypeError) return true; // network / CORS / fetch failed
  if (error instanceof Error) return /^50[234]:/.test(error.message); // 502, 503, 504
  return false;
}
