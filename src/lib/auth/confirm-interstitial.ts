/**
 * The page an emailed sign-in link lands on.
 *
 * Magic links were being spent before the recipient ever saw them. Both
 * accounts on this project show the same fingerprint: the one-time token
 * consumed 12–16 seconds after the email was sent, with no session created.
 * That is an email security scanner (Outlook/Hotmail Safe Links and its
 * equivalents) fetching every URL in a message to check it for malware. The
 * fetch redeems the token, and by the time a person taps the link it is
 * genuinely spent — so the honest error message, "already used or expired",
 * was correct and useless.
 *
 * The fix is that landing on the link no longer signs anyone in. A GET renders
 * this page; the sign-in happens on POST, when someone taps the button.
 * Scanners follow links, they do not submit forms. The cost is one extra tap;
 * the alternative is an account nobody can get into.
 *
 * No JavaScript: the form posts on its own, so this works in whatever browser
 * the mail app happens to open.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type InterstitialFields = Record<string, string>;

export function renderConfirmInterstitial(options: {
  action: string;
  fields: InterstitialFields;
  /** Shown when a previous attempt failed, so the retry isn't silent. */
  error?: string | null;
}): string {
  const hidden = Object.entries(options.fields)
    .map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`)
    .join("");

  const error = options.error
    ? `<p class="error">${escapeHtml(options.error)}</p>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<!-- The token is in this page's URL; don't leak it in a Referer header. -->
<meta name="referrer" content="no-referrer">
<title>Sign in to HomeAssist</title>
<style>
  :root { color-scheme: light; }
  body { margin:0; min-height:100dvh; display:flex; align-items:center; justify-content:center;
         background:#f7f5f0; color:#26221d; padding:24px;
         font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  .card { background:#fff; border:1px solid #e6e1d8; border-radius:16px; padding:28px 24px;
          width:100%; max-width:380px; text-align:center; box-shadow:0 1px 3px rgba(0,0,0,.05); }
  h1 { font-family:Georgia,"Times New Roman",serif; font-size:28px; margin:0 0 6px; font-weight:400; }
  p { font-size:14px; line-height:1.5; color:#6b6459; margin:0 0 20px; }
  .error { color:#b5482f; font-weight:600; }
  button { width:100%; padding:14px; font-size:16px; font-weight:600; color:#fff; background:#26221d;
           border:0; border-radius:12px; cursor:pointer; }
  small { display:block; margin-top:14px; font-size:12px; color:#9a9287; }
</style>
</head>
<body>
  <div class="card">
    <h1>HomeAssist</h1>
    ${error}
    <p>You're one tap from signing in.</p>
    <form method="post" action="${escapeHtml(options.action)}">
      ${hidden}
      <button type="submit">Sign in</button>
    </form>
    <small>This step keeps automatic email scanners from using up your sign-in link before you do.</small>
  </div>
</body>
</html>`;
}

export function interstitialResponse(html: string): Response {
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Never cached or stored by an intermediary: the URL carries a secret.
      "Cache-Control": "no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
