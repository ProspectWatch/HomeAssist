/**
 * Why the site said no, in terms that tell you what to do about it.
 *
 * A bare "(403)" reads as a bug in the app. Most of the time it is a bot wall:
 * the site is sitting behind a challenge that expects a real browser to run
 * JavaScript, and no server-side fetch will ever get through it — not with a
 * different user-agent, not on a retry. Saying that plainly points at the
 * screenshot, which does work, instead of inviting people to try the link
 * again and get the same answer.
 *
 * Lives apart from the fetcher because that module is `server-only` and cannot
 * be imported into a test; this part is pure and is the part worth testing.
 */
export function refusalMessage(response: Response): string {
  const challenged =
    response.headers.get("cf-mitigated") === "challenge" ||
    (response.status === 403 && (response.headers.get("server") ?? "").toLowerCase().includes("cloudflare"));

  if (challenged) {
    return "That site puts a bot check in front of its pages, so it can't be read from here however many times we ask. A screenshot works.";
  }
  switch (response.status) {
    case 404:
      return "That page doesn't exist any more.";
    case 401:
    case 402:
      return "That page is behind a login or paywall. Try a screenshot instead.";
    case 429:
      return "That site is asking us to slow down. Wait a minute, or use a screenshot.";
    default:
      return `That site wouldn't let us read the page (${response.status}). Try a screenshot instead.`;
  }
}
