/**
 * Whether a request really came from the scheduler.
 *
 * The scheduled scan acts without a signed-in user, so this header is the only
 * thing standing between the outside world and a job that writes to every
 * household. Two rules, both deliberate:
 *
 *   * no configured secret means no access, ever. A missing environment
 *     variable must fail closed — an endpoint that runs for anyone when it is
 *     misconfigured is worse than one that never runs.
 *   * the comparison is length-safe and constant-time, so a caller cannot
 *     learn the secret one character at a time from response timings.
 */
export function isCronAuthorized(
  authorizationHeader: string | null | undefined,
  secret: string | undefined,
): boolean {
  if (!secret) return false;
  if (!authorizationHeader) return false;

  const expected = `Bearer ${secret}`;
  return timingSafeEqual(authorizationHeader, expected);
}

/** Compares without leaking where two strings first differ. */
function timingSafeEqual(a: string, b: string): boolean {
  // Length is not secret — it leaks from the header itself — but the
  // comparison below must still run over a fixed number of characters.
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return difference === 0;
}
