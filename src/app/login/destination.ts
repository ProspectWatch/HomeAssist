/**
 * Where a person should land after signing in.
 *
 * Middleware sends a signed-out visitor to /login with the query string they
 * arrived with, so an invite link's ?code= survives that far — but only that
 * far. Without resolving it here the code is dropped at the door and the
 * person is asked to type it after all, which is the friction the link exists
 * to remove.
 */
export function resolveSignInDestination(params: {
  code?: string;
  next?: string;
}): string {
  if (params.code) return `/join?code=${encodeURIComponent(params.code)}`;
  return safeNext(params.next);
}

/**
 * Only ever an in-app path. A crafted ?next= must not be able to bounce
 * someone to another site immediately after they authenticate.
 */
export function safeNext(next: string | undefined): string {
  if (!next) return "/home";
  if (!next.startsWith("/")) return "/home";
  // "//evil.com" is protocol-relative and leaves the site.
  if (next.startsWith("//")) return "/home";
  if (next.includes("\\")) return "/home";
  return next;
}
